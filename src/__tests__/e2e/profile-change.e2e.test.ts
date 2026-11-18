/**
 * Re-running aicgen with a different profile must leave exactly what a clean run of the new
 * profile would produce: no stale rules, skills, agents or hooks from the previous profile.
 */
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { ConfigGenerator } from '../../services/config-generator.js';
import { GuidelineLoader } from '../../services/guideline-loader.js';
import { EmbeddedDataSource } from '../../services/data-source.js';
import { AssistantFileWriter } from '../../services/assistant-file-writer.js';
import { WorkflowInjector } from '../../services/workflow-injector.js';
import { EMBEDDED_SDLC_CONTENT } from '../../embedded-data.js';
import { clearCommand } from '../../commands/clear.js';
import type { AIAssistant } from '../../models/project.js';
import type { InstructionLevel, ProfileSelection } from '../../models/profile.js';

jest.mock('@inquirer/prompts', () => ({ confirm: jest.fn().mockResolvedValue(true) }));
jest.mock('chalk', () => ({ __esModule: true, default: new Proxy({}, { get: () => (text: string) => text }) }));

type GeneratorCtor = new (loader: GuidelineLoader, writer: AssistantFileWriter) => ConfigGenerator;
const ASSISTANTS: AIAssistant[] = ['claude-code', 'copilot', 'antigravity', 'codex'];

async function createGenerator(): Promise<ConfigGenerator> {
  const loader = await GuidelineLoader.create(new EmbeddedDataSource());
  const writer = await AssistantFileWriter.create(WorkflowInjector.fromContent(EMBEDDED_SDLC_CONTENT), '2.0.0-test');
  return new (ConfigGenerator as unknown as GeneratorCtor)(loader, writer);
}

async function project(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'aicgen-profile-'));
  await mkdir(join(root, 'src'), { recursive: true });
  await writeFile(join(root, 'Cargo.toml'), '[package]\nname = "demo"\nversion = "0.1.0"\n');
  await writeFile(join(root, 'src/main.rs'), 'fn main() {}\n');
  return root;
}

async function walk(root: string, dir = ''): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(join(root, dir), { withFileTypes: true })) {
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...await walk(root, rel));
    else out.push(rel);
  }
  return out.sort();
}

const selection = (assistant: AIAssistant, level: InstructionLevel): ProfileSelection => ({
  assistant, language: 'rust', level, architecture: 'layered', projectType: 'cli', projectName: 'demo', datasource: 'none',
});

describe('changing the profile', () => {
  const roots: string[] = [];
  afterEach(async () => { await Promise.all(roots.splice(0).map(r => rm(r, { recursive: true, force: true }))); });
  const newProject = async () => { const r = await project(); roots.push(r); return r; };

  it.each(ASSISTANTS)('%s: full then basic equals a clean basic run', async assistant => {
    const generator = await createGenerator();
    const changed = await newProject();
    const clean = await newProject();

    await generator.generate({ projectPath: changed, selection: selection(assistant, 'full') });
    const result = await generator.generate({ projectPath: changed, selection: selection(assistant, 'basic') });
    await generator.generate({ projectPath: clean, selection: selection(assistant, 'basic') });

    expect(result.removed!.length).toBeGreaterThan(0);
    expect(await walk(changed)).toEqual(await walk(clean));
    expect(await readFile(join(changed, 'Cargo.toml'), 'utf-8')).toContain('demo');
  });

  it('keeps stale files the user edited and reports them', async () => {
    const generator = await createGenerator();
    const root = await newProject();
    await generator.generate({ projectPath: root, selection: selection('claude-code', 'full') });

    const edited = join(root, '.claude/agents/guideline-checker.md');
    await writeFile(edited, `${await readFile(edited, 'utf-8')}\n# my team's addition\n`);
    const result = await generator.generate({ projectPath: root, selection: selection('claude-code', 'basic') });

    expect(result.keptModified).toContain('.claude/agents/guideline-checker.md');
    expect(existsSync(edited)).toBe(true);
    expect(existsSync(join(root, '.claude/agents/security-auditor.md'))).toBe(false);
  });

  it('does not touch the user\'s own rules, skills or agents', async () => {
    const generator = await createGenerator();
    const root = await newProject();
    for (const rel of ['.claude/skills/mine/SKILL.md', '.claude/agents/mine.md', '.github/skills/mine/SKILL.md']) {
      await mkdir(dirname(join(root, rel)), { recursive: true });
      await writeFile(join(root, rel), 'user content');
    }
    await generator.generate({ projectPath: root, selection: selection('claude-code', 'full') });
    await generator.generate({ projectPath: root, selection: selection('claude-code', 'basic') });

    for (const rel of ['.claude/skills/mine/SKILL.md', '.claude/agents/mine.md', '.github/skills/mine/SKILL.md']) {
      expect(await readFile(join(root, rel), 'utf-8')).toBe('user content');
    }
  });

  it('a dry run reports removals without deleting anything', async () => {
    const generator = await createGenerator();
    const root = await newProject();
    await generator.generate({ projectPath: root, selection: selection('copilot', 'full') });
    const before = await walk(root);

    const dry = await generator.generate({ projectPath: root, selection: selection('copilot', 'basic'), dryRun: true });

    expect(dry.removed!.length).toBeGreaterThan(0);
    expect(await walk(root)).toEqual(before);
  });

  it('clear removes the manifest along with the configuration', async () => {
    const generator = await createGenerator();
    const root = await newProject();
    await generator.generate({ projectPath: root, selection: selection('claude-code', 'standard') });
    expect(existsSync(join(root, '.aicgen/manifest.json'))).toBe(true);

    const cwd = process.cwd();
    process.chdir(root);
    try { await clearCommand({ force: true }); } finally { process.chdir(cwd); }

    expect(existsSync(join(root, '.aicgen'))).toBe(false);
    expect(await walk(root)).toEqual(['Cargo.toml', 'src/main.rs']);
  });
});
