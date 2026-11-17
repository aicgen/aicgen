/**
 * End-to-end generation checks. These write real files to temporary projects using the
 * embedded guideline data, then validate the files on disk the way each assistant would
 * read them: frontmatter, names, sizes, JSON, cross references, idempotence, migration
 * from aicgen 1.x output and safe clearing.
 */
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, relative } from 'path';
import YAML from 'yaml';
import { ConfigGenerator } from '../../services/config-generator.js';
import { GuidelineLoader } from '../../services/guideline-loader.js';
import { EmbeddedDataSource } from '../../services/data-source.js';
import { AssistantFileWriter } from '../../services/assistant-file-writer.js';
import { WorkflowInjector } from '../../services/workflow-injector.js';
import { EMBEDDED_SDLC_CONTENT } from '../../embedded-data.js';
import { clearCommand } from '../../commands/clear.js';
import type { AIAssistant, Language } from '../../models/project.js';
import type { InstructionLevel, ProfileSelection } from '../../models/profile.js';

// clearCommand imports ESM-only UI packages that Jest's CJS transform cannot load; only
// their prompts/colours are replaced, all file-system behaviour below is real.
jest.mock('@inquirer/prompts', () => ({ confirm: jest.fn().mockResolvedValue(true) }));
jest.mock('chalk', () => ({
  __esModule: true,
  default: new Proxy({}, { get: () => (text: string) => text }),
}));

type GeneratorCtor = new (loader: GuidelineLoader, writer: AssistantFileWriter) => ConfigGenerator;

const ASSISTANTS: AIAssistant[] = ['claude-code', 'copilot', 'antigravity', 'codex'];
const LEVELS: InstructionLevel[] = ['basic', 'standard', 'full'];

const PROJECTS: Record<string, { language: Language; files: Record<string, string> }> = {
  rust: {
    language: 'rust',
    files: {
      'Cargo.toml': '[package]\nname = "demo"\nversion = "0.1.0"\nedition = "2024"\n',
      'src/main.rs': 'fn main() {}\n',
    },
  },
  typescript: {
    language: 'typescript',
    files: { 'package.json': '{"name":"demo"}', 'tsconfig.json': '{}', 'src/index.ts': 'export {};\n' },
  },
  python: {
    language: 'python',
    files: { 'pyproject.toml': '[project]\nname = "demo"\n', 'src/demo.py': 'x = 1\n' },
  },
  go: { language: 'go', files: { 'go.mod': 'module demo\n\ngo 1.24\n', 'main.go': 'package main\n' } },
};

async function createGenerator(): Promise<ConfigGenerator> {
  const loader = await GuidelineLoader.create(new EmbeddedDataSource());
  const writer = await AssistantFileWriter.create(WorkflowInjector.fromContent(EMBEDDED_SDLC_CONTENT), '2.0.0-test');
  return new (ConfigGenerator as unknown as GeneratorCtor)(loader, writer);
}

async function makeProject(name: keyof typeof PROJECTS): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), `aicgen-e2e-${name}-`));
  for (const [file, content] of Object.entries(PROJECTS[name].files)) {
    await mkdir(dirname(join(root, file)), { recursive: true });
    await writeFile(join(root, file), content);
  }
  return root;
}

async function listFiles(root: string, dir = ''): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(join(root, dir), { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...(await listFiles(root, rel)));
    else out.push(rel);
  }
  return out.sort();
}

function frontmatter(content: string): Record<string, unknown> | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) return null;
  return YAML.parse(match[1]) as Record<string, unknown>;
}

const GENERATED_ROOTS = ['.claude', '.github', '.agents', '.codex', 'plugins', '.aicgen', 'CLAUDE.md', 'AGENTS.md'];

async function generatedFiles(root: string): Promise<string[]> {
  return (await listFiles(root)).filter(file => GENERATED_ROOTS.some(r => file === r || file.startsWith(`${r}/`)));
}

/** Everything an assistant would parse, validated against the documented formats. */
async function validateTree(root: string, assistant: AIAssistant): Promise<string[]> {
  const problems: string[] = [];
  const files = await generatedFiles(root);

  for (const file of files) {
    const content = await readFile(join(root, file), 'utf-8');

    if (file.endsWith('.json')) {
      try {
        JSON.parse(content);
      } catch (error) {
        problems.push(`${file}: invalid JSON (${(error as Error).message})`);
      }
    }

    if (!file.endsWith('.md')) continue;

    // Stale references to files that no longer exist in the 2.0 layout
    for (const stale of ['.claude/guidelines', '.github/chatmodes', '.codex/instructions.md', 'workflows.instructions', '.agent/rules', '.agent/workflows']) {
      if (content.includes(stale)) problems.push(`${file}: stale reference to ${stale}`);
    }

    const fm = content.startsWith('---') ? safeFrontmatter(content, file, problems) : null;

    if (/\/SKILL\.md$/.test(file)) {
      const folder = file.split('/').slice(-2)[0];
      if (!fm) { problems.push(`${file}: skill without frontmatter`); continue; }
      if (fm.name !== folder) problems.push(`${file}: name "${String(fm.name)}" must match folder "${folder}"`);
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(String(fm.name)) || String(fm.name).length > 64) problems.push(`${file}: invalid skill name`);
      const description = String(fm.description ?? '');
      if (!description || description.length > 1024) problems.push(`${file}: description missing or over 1024 chars`);
      if (content.split('\n').length > 500) problems.push(`${file}: over 500 lines`);
    }

    if (file.startsWith('.claude/rules/')) {
      const paths = fm?.paths;
      if (!Array.isArray(paths) || paths.length === 0) problems.push(`${file}: Claude rule needs a paths list`);
      if (fm && Object.keys(fm).some(key => key !== 'paths')) problems.push(`${file}: unexpected frontmatter keys`);
    }

    if (file.startsWith('.github/instructions/')) {
      if (typeof fm?.applyTo !== 'string' || !fm.applyTo) problems.push(`${file}: Copilot instructions need applyTo`);
    }

    if (file.startsWith('.github/agents/')) {
      if (!fm?.name || !fm?.description) problems.push(`${file}: custom agent needs name and description`);
      if (content.length > 30_000) problems.push(`${file}: agent prompt over 30,000 characters`);
    }

    if (file.startsWith('.agents/rules/')) {
      const trigger = fm?.trigger;
      if (!['always_on', 'glob', 'model_decision', 'manual'].includes(String(trigger))) problems.push(`${file}: invalid or missing trigger`);
      if (trigger === 'glob' && !fm?.globs) problems.push(`${file}: glob trigger without globs`);
      if (trigger === 'model_decision' && !fm?.description) problems.push(`${file}: model_decision without description`);
      if (Buffer.byteLength(content) > 24_000) problems.push(`${file}: over 24,000 bytes`);
    }

    if (file === 'AGENTS.md' && Buffer.byteLength(content) > 32 * 1024) problems.push('AGENTS.md: over 32 KiB');
    if (file === 'CLAUDE.md' && content.split('\n').length > 200) problems.push('CLAUDE.md: over 200 lines');
  }

  // Every guideline named in the index must exist as a delivered file
  const indexFile = assistant === 'claude-code' ? 'CLAUDE.md' : 'AGENTS.md';
  const index = await readFile(join(root, indexFile), 'utf-8');
  const deliveredNames = new Set(
    files.flatMap(file => {
      const rule = file.match(/^(?:\.claude\/rules|\.github\/instructions|\.agents\/rules)\/(?:aicgen-)?(.+?)(?:\.instructions)?(?:-part-\d+)?\.md$/);
      const skill = file.match(/\/aicgen-([^/]+)\/SKILL\.md$/);
      return [rule?.[1], skill?.[1]].filter((name): name is string => Boolean(name));
    })
  );
  const listed = [
    ...[...index.matchAll(/^- `([a-z0-9-]+)` — /gm)].map(match => match[1]),
    // compact form: "- Category: name, name, ..."
    ...[...index.matchAll(/^- [A-Za-z ]+: ([a-z0-9-]+(?:, [a-z0-9-]+)*)$/gm)].flatMap(match => match[1].split(', ')),
  ];
  expect(listed.length).toBeGreaterThan(0);
  for (const name of listed) {
    const bare = name.replace(/^aicgen-/, '');
    if (!deliveredNames.has(bare)) problems.push(`${indexFile}: index lists "${name}" but no file delivers it`);
  }

  // Claude settings: only documented top-level keys, valid hook shapes
  if (assistant === 'claude-code' && existsSync(join(root, '.claude/settings.json'))) {
    const settings = JSON.parse(await readFile(join(root, '.claude/settings.json'), 'utf-8'));
    for (const key of Object.keys(settings)) {
      if (!['$schema', 'alwaysThinkingEnabled', 'hooks', 'permissions'].includes(key)) problems.push(`settings.json: unexpected key ${key}`);
    }
    for (const groups of Object.values(settings.hooks ?? {}) as Array<Array<{ matcher?: string; hooks: Array<{ if?: string }> }>>) {
      for (const group of groups) {
        if (group.matcher && /[()]/.test(group.matcher)) problems.push(`settings.json: matcher "${group.matcher}" contains argument syntax`);
      }
    }
  }

  return problems;
}

function safeFrontmatter(content: string, file: string, problems: string[]): Record<string, unknown> | null {
  try {
    return frontmatter(content);
  } catch (error) {
    problems.push(`${file}: frontmatter is not valid YAML (${(error as Error).message})`);
    return null;
  }
}

function selection(assistant: AIAssistant, language: Language, level: InstructionLevel, root: string): ProfileSelection {
  return {
    assistant,
    language,
    level,
    architecture: 'layered',
    projectType: 'cli',
    projectName: root.split('/').pop() ?? 'demo',
    datasource: 'none',
  };
}

describe('end-to-end generation', () => {
  let generator: ConfigGenerator;
  const cleanup: string[] = [];

  beforeAll(async () => {
    generator = await createGenerator();
  });

  afterAll(async () => {
    await Promise.all(cleanup.map(dir => rm(dir, { recursive: true, force: true })));
  });

  describe.each(Object.keys(PROJECTS))('%s project', projectName => {
    const { language } = PROJECTS[projectName];

    describe.each(ASSISTANTS)('%s', assistant => {
      it.each(LEVELS)('writes valid files at the %s level', async level => {
        const root = await makeProject(projectName);
        cleanup.push(root);

        const result = await generator.generate({ projectPath: root, selection: selection(assistant, language, level, root) });

        expect(result.errors).toEqual([]);
        expect(result.success).toBe(true);
        expect(result.budget?.warnings).toEqual([]);
        expect(await validateTree(root, assistant)).toEqual([]);

        const files = await generatedFiles(root);
        expect(files).toContain('AGENTS.md');
        // Guideline bodies are delivered as many small files, never one monolith
        expect(files.length).toBeGreaterThan(5);
      });
    });
  });

  it('the validator itself catches broken output (guards against a vacuous pass)', async () => {
    const root = await makeProject('rust');
    cleanup.push(root);
    await generator.generate({ projectPath: root, selection: selection('claude-code', 'rust', 'full', root) });

    await mkdir(join(root, '.claude/skills/wrong-folder'), { recursive: true });
    await writeFile(join(root, '.claude/skills/wrong-folder/SKILL.md'), '---\nname: other\ndescription: ""\n---\n');
    await writeFile(join(root, '.claude/rules/bad.md'), '---\ntitle: x\n---\nbody');
    await writeFile(join(root, '.claude/settings.json'), '{"aicgen": {}, "hooks": {"PreToolUse": [{"matcher": "Read(.env*)", "hooks": []}]}}');

    const problems = await validateTree(root, 'claude-code');
    expect(problems.join('\n')).toContain('must match folder');
    expect(problems.join('\n')).toContain('Claude rule needs a paths list');
    expect(problems.join('\n')).toContain('unexpected key aicgen');
    expect(problems.join('\n')).toContain('contains argument syntax');
  });

  it('is idempotent: a second run leaves every file byte-identical', async () => {
    for (const assistant of ASSISTANTS) {
      const root = await makeProject('rust');
      cleanup.push(root);
      const sel = selection(assistant, 'rust', 'full', root);

      await generator.generate({ projectPath: root, selection: sel });
      const first = new Map(await Promise.all((await generatedFiles(root)).map(async f => [f, await readFile(join(root, f), 'utf-8')] as const)));
      await generator.generate({ projectPath: root, selection: sel });
      const second = new Map(await Promise.all((await generatedFiles(root)).map(async f => [f, await readFile(join(root, f), 'utf-8')] as const)));

      expect([...second.keys()]).toEqual([...first.keys()]);
      for (const [file, content] of first) expect(second.get(file)).toBe(content);
    }
  });

  it('keeps always-on context small and grows with the profile level', async () => {
    const tokens: Record<string, number> = {};
    for (const level of LEVELS) {
      const root = await makeProject('rust');
      cleanup.push(root);
      const result = await generator.generate({ projectPath: root, selection: selection('claude-code', 'rust', level, root) });
      tokens[level] = result.budget!.alwaysOnTokens;
      expect(result.budget!.alwaysOnTokens).toBeLessThan(8000);
    }
    expect(tokens.basic).toBeLessThanOrEqual(tokens.full);
  });

  it('delivers Rust guidelines scoped to Rust files and security on demand', async () => {
    const root = await makeProject('rust');
    cleanup.push(root);
    await generator.generate({ projectPath: root, selection: selection('claude-code', 'rust', 'full', root) });

    const rule = await readFile(join(root, '.claude/rules/rust-basics.md'), 'utf-8');
    expect(rule).toContain('"**/*.rs"');
    expect(existsSync(join(root, '.claude/skills/aicgen-security-ai-agents/SKILL.md'))).toBe(true);

    const settings = JSON.parse(await readFile(join(root, '.claude/settings.json'), 'utf-8'));
    expect(settings.permissions.allow).toContain('Bash(cargo clippy *)');
  });

  it('migrates aicgen 1.x output and never touches user files', async () => {
    const root = await makeProject('typescript');
    cleanup.push(root);
    const write = async (file: string, content: string) => {
      await mkdir(dirname(join(root, file)), { recursive: true });
      await writeFile(join(root, file), content);
    };

    // aicgen 1.x output
    await write('.claude/guidelines/language.md', '# Language\n');
    await write('.github/instructions/security.instructions.md', '---\napplyTo: "**/*"\ndescription: "Security guidelines"\n---\n');
    await write('.github/chatmodes/aicgen-review.chatmode.md', '---\n---\n');
    await write('.github/instructions/workflows.instructions.md', '---\napplyTo: "**/*"\ndescription: "SDLC workflow slash commands"\n---\n');
    // user-owned files in the same folders
    await write('.github/instructions/team.instructions.md', '---\napplyTo: "**/*"\n---\nTeam rules\n');
    await write('.github/skills/my-skill/SKILL.md', '---\nname: my-skill\ndescription: "mine"\n---\n');

    for (const assistant of ['claude-code', 'copilot'] as const) {
      const result = await generator.generate({ projectPath: root, selection: selection(assistant, 'typescript', 'full', root) });
      expect(result.success).toBe(true);
    }

    expect(existsSync(join(root, '.claude/guidelines'))).toBe(false);
    expect(existsSync(join(root, '.github/instructions/security.instructions.md'))).toBe(false);
    expect(existsSync(join(root, '.github/chatmodes/aicgen-review.chatmode.md'))).toBe(false);
    expect(existsSync(join(root, '.github/instructions/workflows.instructions.md'))).toBe(false);
    expect(existsSync(join(root, '.github/instructions/team.instructions.md'))).toBe(true);
    expect(existsSync(join(root, '.github/skills/my-skill/SKILL.md'))).toBe(true);
  });

  it('clear removes aicgen output but preserves user skills, rules and agents', async () => {
    const root = await makeProject('rust');
    cleanup.push(root);
    const write = async (file: string) => {
      await mkdir(dirname(join(root, file)), { recursive: true });
      await writeFile(join(root, file), 'user\n');
    };

    for (const assistant of ['copilot', 'antigravity', 'codex'] as const) {
      await generator.generate({ projectPath: root, selection: selection(assistant, 'rust', 'full', root) });
    }
    await write('.github/skills/mine/SKILL.md');
    await write('.github/agents/mine.agent.md');
    await write('.github/hooks/mine.json');
    await write('.agents/rules/mine.md');
    await write('.agents/skills/mine/SKILL.md');

    const cwd = process.cwd();
    process.chdir(root);
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      await clearCommand({ force: true });
    } finally {
      log.mockRestore();
      process.chdir(cwd);
    }

    for (const kept of ['.github/skills/mine/SKILL.md', '.github/agents/mine.agent.md', '.github/hooks/mine.json', '.agents/rules/mine.md', '.agents/skills/mine/SKILL.md']) {
      expect(existsSync(join(root, kept))).toBe(true);
    }

    const leftovers = (await listFiles(root)).filter(file => /(^|\/)aicgen-/.test(file) || file.startsWith('.codex/') || file === 'AGENTS.md');
    expect(leftovers.filter(file => !file.startsWith('plugins/'))).toEqual([]);
    expect(relative(root, join(root, 'src/main.rs'))).toBe('src/main.rs');
    expect((await stat(join(root, 'src/main.rs'))).isFile()).toBe(true);
  });
});
