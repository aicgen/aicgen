import { Language } from '../models/project.js';

export interface LanguageCommands {
  install: string;
  test: string;
  build: string;
  lint?: string;
  format?: string;
  /** Extra one-line hints shown next to the commands (e.g. doc tests). */
  notes?: string[];
}

export interface LanguageProfile {
  /** Globs (Copilot `applyTo` syntax) matching the language's source files. */
  sourceGlobs: string[];
  /** Globs for files where testing guidelines apply. */
  testGlobs: string[];
  /** Concrete project commands, or undefined to fall back to "check package.json". */
  commands?: LanguageCommands;
}

const DEFAULT_PROFILE: LanguageProfile = {
  sourceGlobs: ['**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx'],
  testGlobs: ['**/*.test.ts', '**/*.spec.ts', '**/tests/**'],
};

const PROFILES: Partial<Record<Language, LanguageProfile>> = {
  rust: {
    sourceGlobs: ['**/*.rs', '**/Cargo.toml'],
    // Rust unit tests live next to the code, so testing rules apply to all .rs files.
    testGlobs: ['**/*.rs'],
    commands: {
      install: 'cargo fetch --locked',
      test: 'cargo test --workspace --all-features',
      build: 'cargo build --workspace --locked',
      lint: 'cargo clippy --workspace --all-targets --all-features -- -D warnings',
      format: 'cargo fmt --all',
      notes: [
        'If you use cargo-nextest, also run `cargo test --workspace --doc` (nextest skips doc tests).',
        'Run `cargo deny check` before adding or upgrading dependencies.',
      ],
    },
  },
  go: {
    sourceGlobs: ['**/*.go', '**/go.mod'],
    testGlobs: ['**/*_test.go'],
    commands: {
      install: 'go mod download',
      test: 'go test ./...',
      build: 'go build ./...',
      lint: 'go vet ./...',
      format: 'gofmt -l -w .',
    },
  },
  python: {
    sourceGlobs: ['**/*.py', '**/pyproject.toml'],
    testGlobs: ['**/test_*.py', '**/*_test.py', '**/tests/**'],
    commands: {
      install: 'pip install -e ".[dev]"   # or: uv sync',
      test: 'pytest',
      build: 'python -m build',
    },
  },
};

export function getLanguageProfile(language: Language | string): LanguageProfile {
  return PROFILES[language as Language] ?? DEFAULT_PROFILE;
}

export function formatApplyTo(globs: string[]): string {
  return globs.join(', ');
}

/** Markdown bullet list used in the "Quick Reference" section of assistant files. */
export function quickReferenceLines(language: Language | string): string[] {
  const commands = getLanguageProfile(language).commands;
  if (!commands) {
    return ['- Run tests: Check package.json scripts', '- Build: Check package.json scripts'];
  }

  const lines = [`- Run tests: \`${commands.test}\``, `- Build: \`${commands.build}\``];
  if (commands.lint) lines.push(`- Lint: \`${commands.lint}\``);
  if (commands.format) lines.push(`- Format: \`${commands.format}\``);
  for (const note of commands.notes ?? []) lines.push(`- ${note}`);
  return lines;
}

/** Fenced command blocks for the universal AGENTS.md "Commands" section. */
export function commandsSection(language: Language | string): string {
  const commands = getLanguageProfile(language).commands;
  if (!commands) {
    return `**Install dependencies:**
\`\`\`bash
# Check package.json for package manager
npm install
# or yarn install
# or pnpm install
# or bun install
\`\`\`

**Run tests:**
\`\`\`bash
# Check package.json scripts section
npm test
\`\`\`

**Build:**
\`\`\`bash
# Check package.json scripts section
npm run build
\`\`\``;
  }

  const blocks = [
    ['Install dependencies', commands.install],
    ['Run tests', commands.test],
    ['Build', commands.build],
    ...(commands.lint ? [['Lint', commands.lint]] : []),
    ...(commands.format ? [['Format', commands.format]] : []),
  ].map(([title, command]) => `**${title}:**\n\`\`\`bash\n${command}\n\`\`\``);

  const notes = (commands.notes ?? []).map(note => `- ${note}`);
  return [...blocks, ...(notes.length ? [notes.join('\n')] : [])].join('\n\n');
}
