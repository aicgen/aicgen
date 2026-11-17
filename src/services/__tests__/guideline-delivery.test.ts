import { buildGuidelineIndex, buildGuidelineUnits, renderGuidelineFiles, GuidelineSource } from '../guideline-delivery.js';
import { analyzeBudgets, classifyBudgetKind, estimateTokens, splitMarkdown } from '../context-budget.js';

const MAPPINGS: Record<string, { path: string; category: string; tags: string[]; body: string }> = {
  'rust-basics': { path: 'language/rust/basics.md', category: 'Language', tags: ['rust', 'ownership'], body: '# Rust Fundamentals\n\nBody A' },
  'rust-testing': { path: 'language/rust/testing.md', category: 'Language', tags: ['rust', 'testing'], body: '# Rust Testing\n\nBody T' },
  'security-injection': { path: 'security/injection.md', category: 'Security', tags: ['security', 'injection', 'sql'], body: '# Injection Prevention\n\nBody S' },
};

const source: GuidelineSource = {
  getMapping: id => MAPPINGS[id],
  loadGuideline: id => MAPPINGS[id]?.body ?? '',
};

const IDS = Object.keys(MAPPINGS);
const units = () => buildGuidelineUnits(IDS, source, 'rust');
const byPath = (files: { path: string; content: string }[], path: string) => files.find(f => f.path === path)!;

describe('buildGuidelineUnits', () => {
  it('classifies guidelines as source, test or on-demand', () => {
    expect(units().map(u => [u.slug, u.kind])).toEqual([
      ['rust-basics', 'source'],
      ['rust-testing', 'test'],
      ['security-injection', 'on-demand'],
    ]);
  });

  it('derives titles and short single-line descriptions', () => {
    const [basics, , security] = units();
    expect(basics.title).toBe('Rust Fundamentals');
    expect(basics.description).toContain('**/*.rs');
    expect(security.description).toBe('Injection Prevention. Use when the task involves security, injection, sql.');
    for (const unit of units()) expect(unit.description.length).toBeLessThanOrEqual(300);
  });

  it('prefers a curated mapping description over the generated fallback', () => {
    const curated = 'Prevents SQL and command injection. Use when handling user input or building queries.';
    const withDescription: GuidelineSource = {
      ...source,
      getMapping: id => (id === 'security-injection' ? { ...MAPPINGS[id], description: curated } : MAPPINGS[id]),
    };
    const [, , security] = buildGuidelineUnits(IDS, withDescription, 'rust');
    expect(security.description).toBe(curated);

    const skill = renderGuidelineFiles('claude-code', buildGuidelineUnits(IDS, withDescription, 'rust'))
      .find(f => f.path === '.claude/skills/aicgen-security-injection/SKILL.md')!;
    expect(skill.content).toContain(`description: ${JSON.stringify(curated)}`);
  });

  it('skips unknown or empty guidelines', () => {
    expect(buildGuidelineUnits(['nope', 'rust-basics'], { ...source, loadGuideline: id => (id === 'rust-basics' ? '' : '') }, 'rust')).toEqual([]);
  });
});

describe('renderGuidelineFiles', () => {
  it('Claude Code: path-scoped rules plus skills for on-demand topics', () => {
    const files = renderGuidelineFiles('claude-code', units());

    const rule = byPath(files, '.claude/rules/rust-basics.md').content;
    expect(rule).toMatch(/^---\npaths:\n {2}- "\*\*\/\*\.rs"\n {2}- "\*\*\/Cargo\.toml"\n---\n/);

    const skill = byPath(files, '.claude/skills/aicgen-security-injection/SKILL.md').content;
    expect(skill).toMatch(/^---\nname: aicgen-security-injection\ndescription: ".+"\n---\n/);
    expect(files.some(f => f.path.startsWith('.claude/guidelines/'))).toBe(false);
  });

  it('Copilot: applyTo instructions and .github/skills', () => {
    const files = renderGuidelineFiles('copilot', units());

    expect(byPath(files, '.github/instructions/rust-basics.instructions.md').content).toContain('applyTo: "**/*.rs, **/Cargo.toml"');
    expect(byPath(files, '.github/skills/aicgen-security-injection/SKILL.md').content).toContain('name: aicgen-security-injection');
  });

  it('Antigravity: every rule has trigger frontmatter and an aicgen- prefix', () => {
    const files = renderGuidelineFiles('antigravity', units());

    expect(files.map(f => f.path)).toEqual([
      '.agents/rules/aicgen-rust-basics.md',
      '.agents/rules/aicgen-rust-testing.md',
      '.agents/rules/aicgen-security-injection.md',
    ]);
    expect(files[0].content).toMatch(/^---\ntrigger: glob\nglobs: "\*\*\/\*\.rs, \*\*\/Cargo\.toml"\n/);
    expect(files[2].content).toMatch(/^---\ntrigger: model_decision\n/);
  });

  it('Antigravity: splits oversized guidelines below the 24,000-byte limit, frontmatter on each part', () => {
    const big = Array.from({ length: 40 }, (_, i) => `## Section ${i}\n\n${'x'.repeat(1500)}`).join('\n\n');
    const bigSource: GuidelineSource = { getMapping: () => ({ path: 'a.md', category: 'Language', tags: [] }), loadGuideline: () => `# Big\n\n${big}` };
    const files = renderGuidelineFiles('antigravity', buildGuidelineUnits(['big'], bigSource, 'rust'));

    expect(files.length).toBeGreaterThan(1);
    for (const file of files) {
      expect(Buffer.byteLength(file.content)).toBeLessThanOrEqual(24_000);
      expect(file.content.startsWith('---\ntrigger: glob')).toBe(true);
    }
    expect(files[1].path).toBe('.agents/rules/aicgen-big-part-2.md');
  });

  it('Codex: all guidelines become skills under .agents/skills', () => {
    const files = renderGuidelineFiles('codex', units());

    expect(files.map(f => f.path)).toEqual([
      '.agents/skills/aicgen-rust-basics/SKILL.md',
      '.agents/skills/aicgen-rust-testing/SKILL.md',
      '.agents/skills/aicgen-security-injection/SKILL.md',
    ]);
  });

  it('keeps skill names within 64 characters', () => {
    const longSource: GuidelineSource = { getMapping: () => ({ path: 'a.md', category: 'Security', tags: [] }), loadGuideline: () => '# T\n\nx' };
    const [file] = renderGuidelineFiles('claude-code', buildGuidelineUnits(['x'.repeat(100)], longSource, 'rust'));
    expect(file.content.match(/^name: (.+)$/m)![1].length).toBeLessThanOrEqual(64);
  });
});

describe('buildGuidelineIndex', () => {
  it('lists names but never guideline bodies', () => {
    const index = buildGuidelineIndex('claude-code', units());

    expect(index).toContain('`rust-basics` — Rust Fundamentals');
    expect(index).toContain('.claude/skills/');
    expect(index).not.toContain('Body A');
  });

  it('collapses to one line per category for many guidelines', () => {
    const many = Array.from({ length: 30 }, (_, i) => `g${i}`);
    const manySource: GuidelineSource = { getMapping: () => ({ path: 'a.md', category: 'Security', tags: [] }), loadGuideline: () => '# T\n\nx' };
    const index = buildGuidelineIndex('copilot', buildGuidelineUnits(many, manySource, 'rust'));

    expect(index.split('\n').filter(l => l.startsWith('- ')).length).toBe(1);
  });
});

describe('context budgets', () => {
  it('estimates roughly four characters per token', () => {
    expect(estimateTokens('a'.repeat(400))).toBe(100);
  });

  it('classifies generated paths', () => {
    expect(classifyBudgetKind('/p/CLAUDE.md')).toBe('always-on');
    expect(classifyBudgetKind('/p/.agents/rules/aicgen-instructions.md')).toBe('always-on');
    expect(classifyBudgetKind('/p/.agents/rules/aicgen-rust-basics.md')).toBe('scoped-rule');
    expect(classifyBudgetKind('/p/.claude/skills/x/SKILL.md')).toBe('skill');
    expect(classifyBudgetKind('/p/src/main.rs')).toBeNull();
  });

  it('flags hard-limit violations as errors and soft ones as warnings', () => {
    const findings = analyzeBudgets('antigravity', 'standard', [
      { path: '/p/.agents/rules/aicgen-big.md', content: 'x'.repeat(25_000) },
      { path: '/p/CLAUDE.md', content: 'line\n'.repeat(300) },
    ]);
    expect(findings[0].severity).toBe('error');

    const claude = analyzeBudgets('claude-code', 'basic', [{ path: '/p/CLAUDE.md', content: 'line\n'.repeat(300) }]);
    expect(claude[0].severity).toBe('warning');
  });

  it('splitMarkdown keeps small content intact', () => {
    expect(splitMarkdown('# A\n\nb', 1000)).toEqual(['# A\n\nb']);
  });
});
