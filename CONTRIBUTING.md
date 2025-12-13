# Contributing to aicgen

Thank you for your interest in contributing to **aicgen**! We welcome contributions of all kinds: bug reports, feature suggestions, documentation improvements, and code contributions.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Features](#suggesting-features)
  - [Improving Documentation](#improving-documentation)
  - [Contributing Code](#contributing-code)
- [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Testing Guidelines](#testing-guidelines)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Project Structure](#project-structure)
- [Adding New Guidelines](#adding-new-guidelines)
- [Building Binaries](#building-binaries)

---

## Code of Conduct

This project adheres to a code of conduct that promotes a welcoming and inclusive environment. By participating, you are expected to:

- Be respectful and considerate in all interactions
- Provide constructive feedback
- Focus on what is best for the community
- Show empathy towards other contributors

---

## How Can I Contribute?

### Reporting Bugs

Found a bug? Help us fix it by submitting a detailed bug report.

**Before Submitting:**
- Check the [existing issues](https://github.com/lpsandaruwan/aicgen/issues) to avoid duplicates
- Verify you're using the latest version
- Try to reproduce the bug with minimal steps

**Creating a Bug Report:**

Open a [new issue](https://github.com/lpsandaruwan/aicgen/issues/new) with the following information:

**Title:** Clear, concise description (e.g., "Init command fails on Windows with spaces in path")

**Template:**
```markdown
## Bug Description
A clear description of what the bug is.

## Steps to Reproduce
1. Run `aicgen init`
2. Select profile 'balanced'
3. ...

## Expected Behavior
What you expected to happen.

## Actual Behavior
What actually happened.

## Environment
- **OS:** Windows 11 / macOS 14.2 / Ubuntu 22.04
- **aicgen version:** 0.2.0
- **Bun version:** 1.1.0
- **Node version:** (if applicable)

## Additional Context
- Screenshots
- Error messages
- Logs (run with `--debug` flag)

## Possible Solution (Optional)
If you have ideas on how to fix this.
```

**Priority Labels:**
- `critical` - Blocks core functionality
- `high` - Significant impact on user experience
- `medium` - Affects some users
- `low` - Minor issue or edge case

---

### Suggesting Features

Have an idea to make aicgen better? We'd love to hear it!

**Before Suggesting:**
- Check [existing feature requests](https://github.com/lpsandaruwan/aicgen/issues?q=is%3Aissue+label%3Aenhancement)
- Review the [roadmap](README.md#-roadmap) to see if it's already planned
- Consider if it aligns with aicgen's core purpose

**Creating a Feature Request:**

Open a [new issue](https://github.com/lpsandaruwan/aicgen/issues/new) with the label `enhancement`:

**Template:**
```markdown
## Feature Request

### Problem Statement
What problem does this solve? What use case does it address?

### Proposed Solution
Describe your ideal implementation.

### Alternatives Considered
What other approaches did you consider?

### User Impact
Who benefits? How often will this be used?

### Example Usage
```bash
# Show how the feature would be used
aicgen new-command --example
```

### Additional Context
- Related issues
- Similar features in other tools
- Mockups or diagrams
```

**Feature Categories:**
- `enhancement:core` - Core CLI functionality
- `enhancement:guidelines` - New guidelines or categories
- `enhancement:ai` - AI analysis improvements
- `enhancement:ux` - User experience improvements
- `enhancement:docs` - Documentation additions

---

### Improving Documentation

Documentation improvements are always welcome! This includes:

- Fixing typos or grammatical errors
- Clarifying confusing sections
- Adding examples or use cases
- Improving code comments
- Writing tutorials or guides

**How to Contribute:**
1. Fork the repository
2. Make your changes
3. Submit a pull request with `docs:` prefix in the title

**Documentation Files:**
- `README.md` - Main project documentation
- `CLAUDE.md` - Development guidelines and architecture
- `CONTRIBUTING.md` - This file
- Guidelines in `data/guidelines/` - Content guidelines
- Code comments - In-code documentation

---

### Contributing Code

Ready to write some code? Great! Follow these steps.

---

## Development Setup

### Prerequisites

- **Bun** >= 1.0.0 ([Install Bun](https://bun.sh))
- **Git**
- **TypeScript** knowledge
- **Node.js** (optional, for compatibility testing)

### Clone and Install

```bash
# Fork the repository first, then:
git clone https://github.com/YOUR_USERNAME/aicgen.git
cd aicgen

# Install dependencies
bun install

# Verify setup
bun run typecheck
```

### Set Up API Keys (Optional)

For testing AI features:

```bash
# Claude
export ANTHROPIC_API_KEY=sk-ant-...

# Gemini
export GEMINI_API_KEY=...

# OpenAI
export OPENAI_API_KEY=sk-...
```

---

## Development Workflow

### Running in Development

```bash
# Watch mode (auto-reload on changes)
bun run dev

# Run commands directly
bun run start init
bun run start init --help

# Type checking
bun run typecheck

# Linting
bun run lint

# Format code
bun run format
```

### Testing Your Changes

```bash
# Run all tests
bun test

# Run specific test file
bun test src/services/__tests__/scanner.test.ts

# Run with coverage
bun test --coverage
```

### Building

```bash
# Standard build
bun run build

# Build binary for current platform
bun run build:binary

# Build for specific platform
bun run build:binary:windows
bun run build:binary:linux
bun run build:binary:macos

# Build all platforms
bun run build:all
```

---

## Code Standards

### TypeScript Standards

- **Strict Mode:** All checks enabled (`tsconfig.json`)
- **No `any` types** - Use `unknown` with type guards
- **Prefer interfaces** for public APIs, types for internal use
- **Export types** alongside implementations
- **Discriminated unions** for variant types

**Good:**
```typescript
interface Config {
  profile: 'basic' | 'balanced' | 'expert';
  guidelines: string[];
}

function processConfig(config: Config): void {
  // Implementation
}
```

**Bad:**
```typescript
function processConfig(config: any) {
  // Implementation
}
```

### Naming Conventions

- **Classes:** `PascalCase` (e.g., `ProjectScanner`)
- **Functions/Variables:** `camelCase` (e.g., `detectProjectType`)
- **Constants:** `UPPER_SNAKE_CASE` (e.g., `DEFAULT_PROFILE`)
- **Interfaces:** `PascalCase`, no `I` prefix (e.g., `Config`, not `IConfig`)
- **Types:** `PascalCase` (e.g., `ProfileType`)
- **Files:** `kebab-case` (e.g., `project-scanner.ts`)

### File Organization

```typescript
// 1. Node built-ins
import { readFile } from 'fs/promises';
import path from 'path';

// 2. External dependencies
import chalk from 'chalk';
import { Command } from 'commander';

// 3. Internal modules (grouped by layer)
import { ProjectScanner } from '@/services/scanner';
import { Config } from '@/models/config';
import { AicgenError } from '@/utils/errors';
```

### Function Guidelines

- **Max 50 lines** per function
- **Max 3 levels** of nesting
- **Extract complex conditionals** into named functions
- **Single responsibility** - one function, one purpose

**Good:**
```typescript
async function initializeProject(path: string): Promise<void> {
  validatePath(path);
  const config = await loadConfig(path);
  const scanner = new ProjectScanner(path);
  const results = await scanner.scan();
  await generateFiles(config, results);
}

function validatePath(path: string): void {
  if (!existsSync(path)) {
    throw new ProjectNotFoundError(path);
  }
}
```

**Bad:**
```typescript
async function initializeProject(path: string): Promise<void> {
  if (!existsSync(path)) {
    throw new Error('Not found');
  }
  const config = await readFile(path);
  if (config) {
    const scanner = new ProjectScanner(path);
    if (scanner) {
      const results = await scanner.scan();
      if (results) {
        // Deep nesting...
      }
    }
  }
}
```

### Error Handling

Use custom error classes that extend `AicgenError`:

```typescript
export class AicgenError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AicgenError';
  }
}

export class ProjectNotFoundError extends AicgenError {
  constructor(path: string) {
    super(
      `No project found at ${path}`,
      'PROJECT_NOT_FOUND',
      { path }
    );
  }
}
```

**Error Handling Best Practices:**
- Use specific error types
- Include actionable messages
- Log error details in debug mode
- Never expose internal errors to users
- Handle expected errors gracefully

### Async Operations

```typescript
// Good - Prefer async/await
async function loadMultipleFiles(paths: string[]): Promise<string[]> {
  return Promise.all(paths.map(p => readFile(p, 'utf-8')));
}

// Good - Handle partial failures
async function loadWithFallback(paths: string[]): Promise<SettledResult[]> {
  return Promise.allSettled(paths.map(p => readFile(p, 'utf-8')));
}

// Bad - Mixing promises and callbacks
function loadFile(path: string, callback: Function) {
  readFile(path).then(data => callback(null, data));
}
```

### Comments Policy

**NO REDUNDANT COMMENTS** - Code should be self-documenting.

**Only comment WHY, never WHAT:**

**Good:**
```typescript
// Normalize to forward slashes for cross-platform compatibility
const normalizedPath = path.replace(/\\/g, '/');

// Retry with exponential backoff to handle rate limits
await retryWithBackoff(() => apiCall());
```

**Bad:**
```typescript
// Set the path variable
const path = '/some/path';

// Call the function
doSomething();
```

**When to comment:**
- Complex algorithms that aren't obvious
- Workarounds for external library bugs
- Security-sensitive code
- Performance optimizations

---

## Testing Guidelines

### Test Structure

```typescript
import { describe, expect, it, beforeEach } from 'bun:test';
import { ProjectScanner } from '@/services/scanner';

describe('ProjectScanner', () => {
  let scanner: ProjectScanner;

  beforeEach(() => {
    scanner = new ProjectScanner('/test/path');
  });

  it('should detect TypeScript projects', async () => {
    const result = await scanner.detectLanguage();
    expect(result).toBe('typescript');
  });

  it('should throw error for invalid path', async () => {
    expect(() => new ProjectScanner('')).toThrow(ProjectNotFoundError);
  });
});
```

### What to Test

- **Unit Tests:** Individual functions and classes
- **Integration Tests:** Multiple components working together
- **E2E Tests:** Full command execution with fixtures
- **Edge Cases:** Empty inputs, missing files, invalid data
- **Error Paths:** Ensure errors are thrown correctly

### Mocking

```typescript
import { mock } from 'bun:test';

// Mock file system
mock.module('fs/promises', () => ({
  readFile: async () => 'mocked content',
  writeFile: async () => {},
}));

// Mock API calls
mock.module('@anthropic-ai/sdk', () => ({
  Anthropic: class {
    messages = {
      create: async () => ({ content: 'mocked response' }),
    };
  },
}));
```

---

## Commit Guidelines

### Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation only
- `style` - Code style (formatting, missing semicolons)
- `refactor` - Code change that neither fixes a bug nor adds a feature
- `perf` - Performance improvement
- `test` - Adding or updating tests
- `chore` - Maintenance tasks (deps, build scripts)

**Examples:**
```bash
feat(init): add support for custom profile templates

fix(scanner): resolve Windows path handling issue

docs(readme): update installation instructions

refactor(generator): extract template rendering logic
```

### Commit Best Practices

- **Atomic commits** - One logical change per commit
- **Clear messages** - Describe WHAT and WHY, not HOW
- **Reference issues** - Use `Fixes #123` or `Closes #456`
- **Test before committing** - Ensure tests pass
- **No merge commits** - Rebase before merging

---

## Pull Request Process

### Before Submitting

- [ ] Code follows project standards
- [ ] All tests pass (`bun test`)
- [ ] Type checking passes (`bun run typecheck`)
- [ ] Linting passes (`bun run lint`)
- [ ] Code is formatted (`bun run format`)
- [ ] Documentation is updated
- [ ] Commit messages follow conventions

### PR Template

**Title:** `feat(scope): add new feature` or `fix(scope): resolve bug`

**Description:**
```markdown
## Summary
Brief description of changes.

## Motivation
Why is this change needed? What problem does it solve?

## Changes
- Added X feature
- Updated Y component
- Fixed Z bug

## Testing
How was this tested?
- [ ] Unit tests added/updated
- [ ] Manual testing performed
- [ ] Edge cases considered

## Screenshots (if applicable)
Before/after screenshots or terminal output.

## Checklist
- [ ] Tests pass
- [ ] Documentation updated
- [ ] Breaking changes documented
- [ ] Backwards compatible (or migration guide provided)

## Related Issues
Fixes #123
Closes #456
```

### Review Process

1. **Automated checks** run (tests, linting, type checking)
2. **Maintainer review** - may request changes
3. **Address feedback** - make requested updates
4. **Approval** - maintainer approves PR
5. **Merge** - squash and merge to main

### PR Guidelines

- **Keep PRs focused** - One feature/fix per PR
- **Small is better** - Easier to review and merge
- **Respond promptly** - Address review feedback quickly
- **Be respectful** - Accept constructive criticism
- **Update branch** - Rebase on latest main before merging

---

## Project Structure

```
aicgen/
├── src/
│   ├── commands/          # CLI command handlers
│   │   ├── init.ts        # Init command
│   │   ├── stats.ts       # Stats command
│   │   └── ...
│   ├── config/            # Configuration
│   │   ├── profiles.ts    # Profile definitions
│   │   └── settings.ts    # Default settings
│   ├── models/            # Domain models
│   │   ├── config.ts      # Config interfaces
│   │   ├── guideline.ts   # Guideline models
│   │   └── project.ts     # Project models
│   ├── prompts/           # Interactive prompts
│   │   ├── profile-selection.ts
│   │   └── guideline-selection.ts
│   ├── services/          # Business logic
│   │   ├── ai/            # AI providers
│   │   │   ├── anthropic.ts
│   │   │   ├── gemini.ts
│   │   │   └── openai.ts
│   │   ├── scanner.ts     # Project scanner
│   │   ├── generator.ts   # Config generator
│   │   └── cache.ts       # Cache management
│   ├── utils/             # Utilities
│   │   ├── errors.ts      # Error classes
│   │   ├── logger.ts      # Logging
│   │   ├── file-ops.ts    # File operations
│   │   └── validators.ts  # Input validation
│   └── index.ts           # CLI entry point
├── data/                  # Guidelines (submodule)
│   ├── guidelines/        # Markdown guidelines
│   └── categories.json    # Category metadata
├── scripts/               # Build scripts
│   ├── embed-data.ts      # Embed guidelines in binary
│   └── build-binary.ts    # Build executables
└── tests/                 # Test fixtures
```

### Key Architecture Patterns

- **Command Pattern:** Each command is isolated
- **Strategy Pattern:** Profiles define different strategies
- **Repository Pattern:** Abstract file operations
- **Factory Pattern:** Generate configs based on context
- **Dependency Injection:** Pass dependencies explicitly

---

## Adding New Guidelines

Guidelines are markdown files in the `data/guidelines/` directory (Git submodule).

### Structure

```markdown
---
title: "Guideline Name"
category: "language|architecture|testing|security|devops|best-practices|..."
tags: ["tag1", "tag2"]
language: "typescript|python|go|rust|java|csharp|ruby|javascript|all"
difficulty: "beginner|intermediate|advanced"
---

# Guideline Title

## Overview
Brief description of what this guideline covers.

## Key Principles
- Principle 1
- Principle 2

## Best Practices
Detailed best practices with examples.

## Common Pitfalls
Things to avoid.

## Examples

### Good
```language
// Good example
```

### Bad
```language
// Bad example
```

## References
- [Link to documentation]
```

### Adding a New Guideline

1. **Navigate to data repository:**
   ```bash
   cd data
   ```

2. **Create guideline file:**
   ```bash
   touch guidelines/your-guideline.md
   ```

3. **Write content** following the structure above

4. **Update categories:**
   ```bash
   bun run scripts/add-categories.ts
   ```

5. **Test integration:**
   ```bash
   bun run embed
   bun run start init --debug
   ```

6. **Commit to data repository:**
   ```bash
   cd data
   git add guidelines/your-guideline.md
   git commit -m "feat: add [guideline name] guideline"
   git push
   ```

7. **Update submodule in main repo:**
   ```bash
   cd ..
   git add data
   git commit -m "chore: update guidelines submodule"
   ```

### Guideline Best Practices

- **Language-agnostic when possible** - Use `language: all`
- **Include practical examples** - Show good vs bad code
- **Link to authoritative sources** - Martin Fowler, official docs
- **Keep it concise** - 1-2 pages max
- **Focus on WHY** - Explain reasoning, not just rules
- **Use clear headers** - Easy to scan

---

## Building Binaries

### Single Platform

```bash
# Current platform
bun run build:binary

# Specific platform
bun run build:binary:windows   # aicgen.exe
bun run build:binary:linux     # aicgen-linux
bun run build:binary:macos     # aicgen-macos
```

### All Platforms

```bash
bun run build:all
```

Binaries are created in `dist/`:
- `aicgen.exe` (Windows)
- `aicgen-linux` (Linux x64)
- `aicgen-macos` (macOS ARM64)

### Testing Binaries

```bash
# Windows
.\dist\aicgen.exe init

# Linux/macOS
./dist/aicgen-linux init
./dist/aicgen-macos init
```

---

## Questions?

- **Bug reports:** [GitHub Issues](https://github.com/lpsandaruwan/aicgen/issues)
- **Feature requests:** [GitHub Issues](https://github.com/lpsandaruwan/aicgen/issues)
- **Discussions:** [GitHub Discussions](https://github.com/lpsandaruwan/aicgen/discussions)
- **Email:** [maintainer email]

---

## License

By contributing to aicgen, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to aicgen! Your efforts help make AI-assisted development more accessible and effective for everyone.