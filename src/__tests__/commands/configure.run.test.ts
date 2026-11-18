/**
 * Runs the real `configureCommand` (what `aicgen init` / `aicgen configure` execute) against a
 * temporary project with the embedded guideline data. Only interactive prompts, the spinner,
 * colours and the AI service are replaced, so file generation, migration and output are real.
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const mockSelect = jest.fn();
const mockConfirm = jest.fn();

jest.mock('@inquirer/prompts', () => ({
  select: (...args: unknown[]) => mockSelect(...args),
  confirm: (...args: unknown[]) => mockConfirm(...args),
  input: jest.fn(),
  password: jest.fn(),
}));
jest.mock('ora', () => ({
  __esModule: true,
  default: () => {
    const spinner: Record<string, unknown> = {};
    for (const method of ['start', 'succeed', 'fail', 'warn', 'stop', 'info']) spinner[method] = () => spinner;
    return spinner;
  },
}));
jest.mock('chalk', () => ({
  __esModule: true,
  default: new Proxy({}, { get: () => (text: string) => text }),
}));
jest.mock('../../utils/banner', () => ({ showBanner: jest.fn() }));
jest.mock('../../utils/formatting', () => ({ createSummaryBox: jest.fn() }));
jest.mock('../../services/ai-analysis/ai-analysis.service', () => ({ AIAnalysisService: class {} }));
jest.mock('../../services/credential-service', () => ({ CredentialService: class {} }));

import { configureCommand } from '../../commands/configure.js';

describe('configureCommand (real command, mocked prompts)', () => {
  const originalCwd = process.cwd();
  const originalHome = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE };
  let home: string;
  let projectRoot: string;
  let project: string;
  let logs: string[];

  /** Answers wizard prompts by their message; unknown prompts fail the test loudly. */
  function answer(overrides: Record<string, string> = {}) {
    const defaults: Record<string, string> = {
      'Select project type:': 'api',
      'Select architecture pattern:': 'layered',
      'Select datasource type:': 'sql',
      'Select instruction level:': 'standard',
      'Which coding assistant will use these guidelines?': 'claude-code',
      ...overrides,
    };
    mockSelect.mockImplementation(async ({ message }: { message: string }) => {
      if (!(message in defaults)) throw new Error(`Unexpected prompt: ${message}`);
      return defaults[message];
    });
    // "Use AI to analyze...?" -> no; "Detected rust. Use this?" -> yes.
    mockConfirm.mockImplementation(async ({ message }: { message: string }) => !message.startsWith('Use AI'));
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    projectRoot = await mkdtemp(join(tmpdir(), 'aicgen-configure-'));
    home = join(projectRoot, 'home');
    project = join(projectRoot, 'my-rust-service');
    await mkdir(join(project, 'src'), { recursive: true });
    await mkdir(home, { recursive: true });
    await writeFile(join(project, 'Cargo.toml'), '[package]\nname = "svc"\nversion = "0.1.0"\nedition = "2024"\n[dependencies]\naxum = "0.8"\n');
    await writeFile(join(project, 'src', 'main.rs'), 'fn main() {}\n');

    // Keep the developer's own ~/.aicgen custom data out of the run.
    process.env.HOME = home;
    process.env.USERPROFILE = home;
    process.chdir(project);

    logs = [];
    jest.spyOn(console, 'log').mockImplementation((...args: unknown[]) => { logs.push(args.join(' ')); });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    process.chdir(originalCwd);
    if (originalHome.HOME === undefined) delete process.env.HOME; else process.env.HOME = originalHome.HOME;
    if (originalHome.USERPROFILE === undefined) delete process.env.USERPROFILE; else process.env.USERPROFILE = originalHome.USERPROFILE;
    await rm(projectRoot, { recursive: true, force: true });
  });

  it('generates Claude Code output titled with the project directory name, not "my-project"', async () => {
    answer();
    await configureCommand({});

    const claudeMd = await readFile(join(project, 'CLAUDE.md'), 'utf-8');
    expect(claudeMd).toContain('# my-rust-service - Development Guidelines');
    expect(claudeMd).not.toContain('my-project');
    expect(claudeMd).toContain('cargo test');
  });

  it('skips the assistant prompt when --assistant is given', async () => {
    answer();
    await configureCommand({ assistant: 'codex' });

    const prompts = mockSelect.mock.calls.map(call => (call[0] as { message: string }).message);
    expect(prompts).not.toContain('Which coding assistant will use these guidelines?');
    expect(existsSync(join(project, 'AGENTS.md'))).toBe(true);
    expect(existsSync(join(project, 'CLAUDE.md'))).toBe(false);
  });

  it('rejects an unsupported --assistant before asking anything', async () => {
    answer();
    await expect(configureCommand({ assistant: 'gemini-cli' })).rejects.toThrow('Unsupported assistant "gemini-cli"');
    expect(mockSelect).not.toHaveBeenCalled();
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it('prints the context budget summary and next steps', async () => {
    answer({ 'Select instruction level:': 'full' });
    await configureCommand({});

    const output = logs.join('\n');
    expect(output).toMatch(/Context budget/);
    expect(output).toMatch(/Always-on instructions: ~\d+ tokens/);
    expect(output).toMatch(/guideline file\(s\) load only when relevant/);
    expect(output).toMatch(/Next steps/);
  });

  it('reports aicgen 1.x files it replaced', async () => {
    await mkdir(join(project, '.claude', 'guidelines'), { recursive: true });
    await writeFile(join(project, '.claude', 'guidelines', 'old.md'), '# old 1.x guideline\n');
    answer();
    await configureCommand({ force: true });

    expect(logs.join('\n')).toMatch(/Replaced \d+ aicgen 1\.x file\(s\)/);
    expect(existsSync(join(project, '.claude', 'guidelines'))).toBe(false);
  });
});
