# aicgen - AI Config Generator

## Project Overview

TypeScript-based CLI tool that automatically generates and manages AI coding assistant configurations with intelligent profile-based setups and learning capabilities.

**Runtime:** Bun >= 1.0.0
**Language:** TypeScript (strict mode)
**Binary Distribution:** Standalone executables via `bun build --compile`
**License:** MIT

## Core Architecture Principles

### Design Patterns
- **Command Pattern**: Each CLI command is a separate handler with clear responsibility
- **Strategy Pattern**: Profile system uses strategies for different configuration levels
- **Repository Pattern**: Abstracts file system operations for guidelines and cache
- **Factory Pattern**: Generate configurations based on project context and profiles
- **Observer Pattern**: Hook system notifies on CLI events

### Code Organization
```
src/
├── commands/         # CLI command handlers
├── config/           # Configuration (profiles, settings)
├── models/           # Domain models and interfaces
├── prompts/          # Interactive prompt definitions
├── services/         # Business logic (scanner, generator, AI)
├── utils/            # Utilities (errors, file ops, logging)
└── docs/             # Documentation and guidelines
    ├── architecture/        # Architecture patterns (Clean, DDD, SOLID, etc.)
    └── enterprise-patterns/ # Enterprise patterns (Repository, DTO, etc.)
```

### Key Technical Decisions

**CLI Framework:** Commander.js
- More intuitive API than Yargs
- Better TypeScript support
- Cleaner subcommand structure

**Prompt Library:** Inquirer.js
- Industry standard for interactive CLIs
- Extensive plugin ecosystem
- Strong TypeScript types

**Error Handling:**
- Custom error hierarchy extending base Error
- Structured error codes for programmatic handling
- User-friendly messages with actionable guidance
- No stack traces in production unless --debug flag

**Logging:**
- Use `debug` package for development logging
- Chalk for styled terminal output
- Ora for progress indicators
- Clear separation of user-facing vs debug output

**Testing Strategy:**
- Unit tests: Vitest (faster than Jest, better ESM support)
- E2E tests: Test actual CLI commands with fixtures
- Mock file system with memfs for fast tests
- Mock Anthropic API calls

## Critical Guidelines

### TypeScript Standards
- Use strict mode with all checks enabled
- Prefer interfaces for public APIs, types for internal use
- No `any` types - use `unknown` and type guards
- Use discriminated unions for variant types
- Leverage mapped types and utility types
- Export types alongside implementations

### Code Style
- **Naming:**
  - Classes: PascalCase
  - Functions/variables: camelCase
  - Constants: UPPER_SNAKE_CASE
  - Interfaces: PascalCase (no I prefix)
  - Types: PascalCase
  - Files: kebab-case

- **Structure:**
  - One class/interface per file (except closely related types)
  - Group related types in barrel exports (index.ts)
  - Keep functions under 50 lines
  - Max 3 levels of nesting
  - Extract complex conditionals into named functions

- **Imports:**
  - Group: node built-ins, external deps, internal modules
  - Use path aliases (@cli, @core, @domain, @infrastructure)
  - Avoid circular dependencies

### Error Handling
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

### Async Operations
- Prefer async/await over promises
- Use Promise.all() for independent operations
- Use Promise.allSettled() when partial failure is acceptable
- Implement timeouts for API calls
- Graceful degradation when optional operations fail

### File Operations
- Always use fs/promises API
- Check file existence before reading
- Use atomic writes (write to temp, rename)
- Handle ENOENT, EACCES, EEXIST errors specifically
- Normalize paths with path.normalize()
- Use path.join() for cross-platform compatibility

### API Integration (Anthropic)
- Use official @anthropic-ai/sdk
- Implement retry logic with exponential backoff
- Cache API responses when appropriate
- Stream responses for long generations
- Handle rate limits gracefully
- Never log API keys

### CLI Best Practices
- Validate all inputs before processing
- Show progress for operations >1 second
- Provide --verbose and --debug flags
- Support --help for all commands
- Exit with appropriate codes (0 success, 1+ errors)
- Support both interactive and non-interactive modes
- Enable piping and scripting

### Security
- Never commit API keys or secrets
- Sanitize file paths to prevent traversal
- Validate user input against injection
- Use safe YAML parsing (no code execution)
- Respect .gitignore when scanning projects

## Project-Specific Rules

### Cache Structure
```
~/.aicgen/
├── config.yml              # User config (API key, preferences)
├── guidelines/             # Shipped base guidelines (read-only)
├── user-guidelines/        # User additions
│   ├── preferences.yml     # Learned preferences
│   └── custom/             # Custom guideline files
└── cache/
    └── api-responses/      # Optional response cache
```

### Project Structure
```
.aicgen/
├── instructions.md         # Master context document
├── decisions.md           # Architecture Decision Records
├── claude.md              # Claude Code configuration
├── config.yml             # Project-specific overrides
└── hooks/                 # Optional pre-task hooks
    ├── pre-task.sh
    └── context-refresh.sh
```

### Profile System
- Profiles are immutable strategies
- Each profile defines: guidelines to include, strictness level, features
- Custom profiles extend base profiles
- Profile selection affects: guideline filtering, instructions.md verbosity, hook generation

### Learning System
- Track preferences with metadata: source project, date added, usage count
- Store as structured YAML for easy editing
- Support manual addition and automated extraction
- Preferences are fuzzy-matched against guidelines
- Never override explicit project configuration

### Generation Flow
1. **Scan Phase**: Analyze project structure, detect tech stack
2. **Selection Phase**: Choose guidelines based on profile + tech stack
3. **Merge Phase**: Combine base guidelines + user guidelines + project context
4. **Generation Phase**: Call AI API to generate contextual configs
5. **Write Phase**: Atomic write of all generated files
6. **Validation Phase**: Verify generated files are valid

### Context Management
- instructions.md is source of truth
- Auto-prune decisions older than 30 days (configurable)
- Pin feature prevents pruning
- Protect feature adds file-level warnings
- Refresh command displays current context in copy-friendly format

## Command Reference

### init
Initialize AI configuration in current project.

**Flags:**
- `--profile <name>`: Skip interactive selection (basic|balanced|expert|custom)
- `--force`: Overwrite existing .aicgen/ directory
- `--no-ai`: Generate without AI (use templates only)

**Interactive Flow:**
1. Detect project type
2. Select profile
3. Choose additional guidelines (if custom)
4. Configure AI generation
5. Generate files

### learn
Manage learned preferences.

**Subcommands:**
- `learn add <rule>`: Add explicit preference
- `learn remove <id>`: Remove preference by ID
- `learn list`: Display all preferences
- `learn extract <project-path>`: Extract patterns from existing project

### pin
Add critical constraint to instructions.md.

**Usage:** `aicgen pin "<constraint>"`

### decision
Log architecture decision.

**Flags:**
- `--why <reason>`: Justification (required)
- `--alternatives <options>`: Alternatives considered

### protect
Mark file as protected.

**Usage:** `aicgen protect <file-path> "<reason>"`

### refresh
Display current instructions for AI context.

**Flags:**
- `--copy`: Copy to clipboard
- `--format <type>`: Output format (markdown|plain|json)

### compact
Archive old decisions and summarize.

**Flags:**
- `--days <n>`: Archive items older than n days (default: 30)
- `--keep-pinned`: Keep pinned items (default: true)

## Development Workflow

### Setup
```bash
bun install
bun run build
```

### Development
```bash
bun run dev                 # Watch mode
bun run start init          # Run directly
bun run typecheck           # Type checking
```

### Building Binaries
```bash
bun run build:binary              # Current platform
bun run build:binary:windows      # Windows (.exe)
bun run build:binary:linux        # Linux (x64)
bun run build:binary:macos        # macOS (ARM64)
bun run build:all                 # All platforms
```

### Testing
```bash
bun test                    # Run all tests
```

### Release
```bash
bun run build:all           # Build all platform binaries
bun test                    # Run tests
# Upload binaries to GitHub Releases
```

## Success Metrics
- Init completes in <30 seconds
- Generated configs are contextually relevant
- Learning improves future generations
- instructions.md prevents AI context loss
- Fast and intuitive UX
- Clear error messages

## Critical Code Style Rule

**NO REDUNDANT COMMENTS**
- Code itself should be its documentation
- Use self-explanatory function and variable names
- Only comment WHY, never WHAT
- Prefer extracting complex logic into well-named functions
- Type definitions serve as documentation

## Anti-Patterns to Avoid
- ❌ God objects that do everything
- ❌ Tight coupling between CLI and core logic
- ❌ Synchronous file operations
- ❌ Unhandled promise rejections
- ❌ Generic error messages
- ❌ Hardcoded file paths
- ❌ Redundant comments that restate code
- ❌ Premature optimization
- ❌ Magic numbers without named constants
- ❌ Deep nesting (>3 levels)
- ❌ Over-engineering with unnecessary abstractions
