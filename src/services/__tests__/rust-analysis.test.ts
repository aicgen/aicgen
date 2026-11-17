import { ProjectAnalyzer } from '../project-analyzer';

jest.mock('fast-glob', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../utils/file', () => ({ exists: jest.fn(), readFile: jest.fn() }));

const glob = require('fast-glob').default as jest.Mock;
const { exists, readFile } = require('../../utils/file');

function mockProject(opts: {
  files: string[];
  dirs?: string[];
  present?: string[];
  contents?: Record<string, string>;
}) {
  glob.mockImplementation((_pattern: unknown, options: { onlyDirectories?: boolean }) =>
    Promise.resolve(options?.onlyDirectories ? (opts.dirs ?? []) : opts.files)
  );
  exists.mockImplementation((filepath: string) =>
    Promise.resolve((opts.present ?? []).some(name => filepath.endsWith(name)))
  );
  readFile.mockImplementation((filepath: string) => {
    const match = Object.entries(opts.contents ?? {}).find(([name]) => filepath.endsWith(name));
    return Promise.resolve(match ? match[1] : '{}');
  });
}

describe('ProjectAnalyzer: Rust projects', () => {
  const analyzer = () => new ProjectAnalyzer('/test/rust-project');

  beforeEach(() => jest.clearAllMocks());

  it('detects a Rust web service with frameworks, database and testing hints', async () => {
    mockProject({
      files: ['Cargo.toml', 'src/main.rs', 'src/lib.rs', 'tests/api.rs', 'tests/common/mod.rs', 'deny.toml'],
      present: ['Cargo.toml', 'deny.toml', 'rust-toolchain.toml'],
      contents: {
        'Cargo.toml': `
[package]
name = "svc"
edition = "2024"
rust-version = "1.88"

[dependencies]
axum = "0.8"
tokio = { version = "1", features = ["full"] }
sqlx = "0.8"
redis = "0.27"

[dev-dependencies]
proptest = "1"
insta = "1"
`,
      },
    });

    const { metadata } = await analyzer().analyze();

    expect(metadata.language).toBe('rust');
    expect(metadata.packageManager).toBe('cargo');
    expect(metadata.frameworks).toEqual(expect.arrayContaining(['Axum', 'Tokio']));
    expect(metadata.buildTools).toEqual(expect.arrayContaining(['Cargo', 'cargo-deny', 'rust-toolchain']));
    expect(metadata.databaseHints.hasSql).toBe(true);
    expect(metadata.databaseHints.hasNoSql).toBe(true);
    expect(metadata.databaseHints.detected).toEqual(expect.arrayContaining(['SQL (sqlx)', 'NoSQL (redis)']));
    expect(metadata.testingHints.frameworks).toEqual(expect.arrayContaining(['cargo test', 'proptest', 'insta (snapshots)']));
    // tests/api.rs counts; tests/common/mod.rs is a helper, not a test
    expect(metadata.testingHints.testFileCount).toBe(1);
    expect(metadata.testingHints.hasTests).toBe(true);
    expect(metadata.projectTypeHints).toEqual(expect.arrayContaining(['web-framework', 'rust-edition-2024']));
  });

  it('detects a Rust CLI', async () => {
    mockProject({
      files: ['Cargo.toml', 'src/main.rs'],
      present: ['Cargo.toml'],
      contents: { 'Cargo.toml': '[package]\nname = "tool"\n[dependencies]\nclap = "4"\n' },
    });

    const { metadata } = await analyzer().analyze();

    expect(metadata.projectTypeHints).toEqual(expect.arrayContaining(['cli-structure', 'rust-cli']));
    expect(metadata.frameworks).toContain('clap');
  });

  it('detects a library crate', async () => {
    mockProject({
      files: ['Cargo.toml', 'src/lib.rs'],
      present: ['Cargo.toml'],
      contents: { 'Cargo.toml': '[package]\nname = "lib"\n' },
    });

    const { metadata } = await analyzer().analyze();

    expect(metadata.projectTypeHints).toEqual(expect.arrayContaining(['library-entry', 'rust-library']));
  });

  it('merges member manifests of a Cargo workspace', async () => {
    mockProject({
      files: ['Cargo.toml', 'crates/api/Cargo.toml', 'crates/api/src/main.rs', 'crates/core/Cargo.toml', 'crates/core/src/lib.rs'],
      dirs: ['crates', 'crates/api', 'crates/core'],
      present: ['Cargo.toml'],
      contents: {
        'crates/api/Cargo.toml': '[package]\nname = "api"\n[dependencies]\nactix-web = "4"\n',
        'crates/core/Cargo.toml': '[package]\nname = "core"\n[dependencies]\nsqlx = "0.8"\n',
        'Cargo.toml': '[workspace]\nmembers = ["crates/*"]\nresolver = "3"\n',
      },
    });

    const { metadata } = await analyzer().analyze();

    expect(metadata.language).toBe('rust');
    expect(metadata.architectureHints).toContain('cargo-workspace');
    expect(metadata.frameworks).toContain('Actix Web');
    expect(metadata.databaseHints.hasSql).toBe(true);
  });

  it('prefers Rust over a bare package.json but not over tsconfig.json', async () => {
    mockProject({ files: ['Cargo.toml', 'package.json'], present: ['Cargo.toml', 'package.json'] });
    expect((await analyzer().analyze()).metadata.language).toBe('rust');

    mockProject({ files: ['Cargo.toml', 'package.json', 'tsconfig.json'], present: ['Cargo.toml', 'package.json', 'tsconfig.json'] });
    expect((await analyzer().analyze()).metadata.language).toBe('typescript');
  });

  it('samples Cargo.toml for AI analysis (case-sensitive filename)', async () => {
    mockProject({
      files: ['Cargo.toml', 'src/main.rs'],
      present: ['Cargo.toml'],
      contents: { 'Cargo.toml': '[package]\nname = "x"\n' },
    });

    const { samples } = await analyzer().analyze();

    expect(samples.map(s => s.path)).toContain('Cargo.toml');
  });

  it('does not treat non-Rust projects as Rust', async () => {
    mockProject({ files: ['package.json'], present: ['package.json'] });

    const { metadata } = await analyzer().analyze();

    expect(metadata.testingHints.frameworks).not.toContain('cargo test');
    expect(metadata.buildTools).not.toContain('Cargo');
  });
});
