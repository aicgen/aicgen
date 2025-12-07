# aicgen - AI Config Generator

Automatically generate intelligent, context-aware configurations for AI coding assistants (Claude Code, GitHub Copilot, Google Antigravity) with smart project analysis and beautiful interactive wizards.

## ✨ Features

- **🎯 Multi-Assistant Support** - Claude Code, GitHub Copilot, Google Antigravity
- **🧠 Smart Project Analysis** - Detects language, framework, database, team size
- **📊 Intelligent Recommendations** - Suggests instruction level & architecture
- **🎨 Beautiful Interactive Wizard** - Colored output, spinners, clear prompts
- **⚡ Fast & Lightweight** - Built with Bun, compiles to standalone binaries
- **🔧 Fully Configurable** - Interactive or automated with CLI flags
- **📝 Context-Rich Instructions** - Generates detailed, project-specific guides
- **🏗️ Architecture Support** - Modular Monolith, Microservices, Refactor patterns

## 🚀 Quick Start

```bash
# Navigate to your project
cd my-project

# Run interactive wizard
aicgen init

# Or fully automated
aicgen init --assistant claude-code --level standard --architecture modular-monolith
```

## 📦 Installation

### From Binary (Recommended)

Download the latest binary for your platform from the [releases page](https://github.com/yourusername/aicgen/releases):

- **Windows**: `aicgen.exe`
- **Linux**: `aicgen-linux`
- **macOS**: `aicgen-macos`

```bash
# Linux/macOS: Make executable and move to PATH
chmod +x aicgen-linux
sudo mv aicgen-linux /usr/local/bin/aicgen

# Windows: Add to PATH or run directly
.\aicgen.exe init
```

### From Source

```bash
git clone https://github.com/yourusername/aicgen.git
cd aicgen
bun install
bun run build:binary

# Or run directly
bun run start init
```

## 📊 Chunk System

aicgen uses a modular **chunk-based architecture** with **53+ markdown chunks**:

```bash
# View chunk statistics
aicgen stats
```

**Available Chunks:**
- **Language**: TypeScript (8), Python (4)
- **Architecture**: SOLID, Clean Architecture, DDD, Event-Driven, Serverless, GUI, Feature Toggles
- **Patterns**: Enterprise patterns (6), Domain Logic, GoF patterns
- **Best Practices**: Testing (3), Security (4), Performance (3), Code Style (2)
- **DevOps**: CI/CD, Infrastructure as Code, Observability
- **Database**: Schema design, Indexing, Design patterns
- **API**: REST, Pagination, Versioning

Each chunk is a focused markdown file (50-200 lines) covering a specific topic.

## 🎮 Interactive Wizard

```
🤖 aicgen - AI Config Generator

✔ Project analyzed

📊 Project Detection:
  Name:          my-app
  Language:      typescript (90% confidence)
  Framework:     Next.js
  Database:      postgresql (drizzle)
  Team Size:     ~3 developers
  Files:         42 code files

💡 Recommended Configuration:
  Instruction Level: standard
  → Code style, testing, CI/CD, basic architecture
  → Best for: Startup MVPs, small production apps, 1-5 developers
  Architecture:      modular-monolith
  → Single deployment with clear module boundaries

❓ Which AI assistant are you configuring?
❯ Claude Code
  GitHub Copilot
  Google Antigravity

❓ Select instruction level:
❯ Standard - Production MVP / Small Teams (Recommended)
  Expert - Scale / Large Teams
  Full - Enterprise / All Guidelines

❓ Select architecture approach:
❯ Modular Monolith (Recommended)
  Microservices
  Refactor

✨ Generate configuration files? (Y/n)

✔ Configuration generated

📄 Generated files:
  ✓ .claude/instructions.md
  ✓ .claude/config.yml
  ✓ .claude/decisions.md
```

## 📚 Instruction Levels

| Level | Lines | Best For | Includes |
|-------|-------|----------|----------|
| **Basic** | ~200 | Scripts, POCs, learning | Code style, error handling |
| **Standard** | ~500 | MVPs, small teams (1-5) | + Testing, CI/CD, architecture basics |
| **Expert** | ~1000 | Scaling products (5-20) | + Advanced patterns, deployment, monitoring |
| **Full** | ~2000+ | Enterprise, complex systems | All available guidelines |

## 🏗️ Architecture Options

| Architecture | Complexity | Best For |
|-------------|------------|----------|
| **Modular Monolith** | Medium | Most projects (recommended) |
| **Microservices** | High | Large teams, clear boundaries |
| **Refactor** | Medium | Legacy code, gradual improvement |
| **Layered** | Low | Simple apps, traditional patterns |

## 🎛️ CLI Commands

### `aicgen init`

Initialize AI configuration in your project.

```bash
aicgen init [options]

Options:
  -a, --assistant <name>      AI assistant (claude-code|copilot|antigravity)
  -l, --level <level>         Instruction level (basic|standard|expert|full)
  --architecture <type>       Architecture (modular-monolith|microservices|refactor)
  -f, --force                 Overwrite existing configuration
  --dry-run                   Preview files without writing
  -h, --help                  Display help
```

### `aicgen stats`

Show statistics about available chunks.

```bash
aicgen stats
```

Displays:
- Total chunk count
- Chunks by language
- Chunks by instruction level
- Chunks by architecture
- Top tags

### Examples

```bash
# Interactive wizard (recommended)
aicgen init

# Skip assistant selection
aicgen init --assistant claude-code

# Fully automated
aicgen init \
  --assistant claude-code \
  --level expert \
  --architecture microservices

# Preview changes
aicgen init --dry-run

# Force overwrite
aicgen init --force
```

## 📁 Generated Files

### For Claude Code

```
.claude/
├── instructions.md        # Complete development guide (~500 lines)
│   ├── Project Overview
│   ├── Architecture: Modular Monolith
│   ├── Code Guidelines (TypeScript specific)
│   ├── Testing Strategy (Vitest)
│   ├── Error Handling Patterns
│   ├── Deployment & CI/CD
│   └── Logging Best Practices
│
├── config.yml
│   └── Project metadata & defaults
│
└── decisions.md
    └── Architecture Decision Records
```

### For GitHub Copilot

```
.github/
├── copilot-instructions.md    # Repository-wide instructions
└── instructions/              # Path-specific instructions
    ├── backend.instructions.md
    └── frontend.instructions.md
```

### For Google Antigravity

```
.agent/
├── rules/                     # Workspace-specific rules
│   ├── coding-style.md
│   ├── architecture.md
│   └── testing.md
└── workflows/                 # Saved prompts
    └── setup-api.md
```

## 🔍 Project Detection

aicgen automatically detects:

**Languages:**
- TypeScript, JavaScript, Python, Go, Rust, Java, C#, Ruby

**Frameworks:**
- Next.js, NestJS, Express, Fastify, React, Vue, Angular, Svelte
- Django, FastAPI, Flask

**Databases:**
- PostgreSQL, MySQL, MongoDB, SQLite, Redis
- ORMs: Prisma, Drizzle, TypeORM, Mongoose

**Project Characteristics:**
- Team size (estimated from codebase)
- Code complexity (simple/moderate/complex)
- Existing tests, CI/CD, Docker
- Package manager (npm, yarn, pnpm, bun, pip, cargo, go)

## 🛠️ Development

### Prerequisites

- [Bun](https://bun.sh) >= 1.0.0

### Setup

```bash
# Install dependencies
bun install

# Run examples
bun run examples/phase1-demo.ts    # Project scanning & recommendations
bun run examples/phase2-demo.ts    # Template rendering & generation

# Development mode
bun run dev

# Run directly
bun run start init
```

### Building

```bash
# TypeScript type checking
bun run typecheck

# Build for distribution
bun run build

# Compile to standalone binary
bun run build:binary              # Current platform
bun run build:binary:windows      # Windows (.exe)
bun run build:binary:linux        # Linux (x64)
bun run build:binary:macos        # macOS (ARM64)
bun run build:all                 # All platforms

# Run tests
bun test
```

## 📖 Documentation

- [PHASE1-COMPLETE.md](PHASE1-COMPLETE.md) - Foundation & Schema
- [PHASE2-COMPLETE.md](PHASE2-COMPLETE.md) - Template System
- [PHASE3-COMPLETE.md](PHASE3-COMPLETE.md) - Interactive CLI Wizard
- [CLAUDE.md](CLAUDE.md) - Project instructions for AI assistants

## 🗺️ Roadmap

### ✅ Completed

- [x] Phase 1: Foundation & Schema
  - [x] Project fingerprinting
  - [x] Smart recommendations
  - [x] Profile system
- [x] Phase 2: Template System
  - [x] Handlebars template engine
  - [x] First complete profile (Claude Code + TypeScript)
  - [x] Atomic file writes
- [x] Phase 3: Interactive CLI Wizard
  - [x] Beautiful prompts with Inquirer.js
  - [x] Colored output with Chalk
  - [x] Spinner animations with Ora
  - [x] Non-interactive mode

### 🚧 Future Enhancements

- [ ] More profiles (Python, Go, React, Vue, Next.js specific)
- [ ] More templates (CI/CD, Docker, README)
- [ ] Learning system (remember preferences)
- [ ] Context management commands (pin, decision, protect)
- [ ] Hook generation
- [ ] Sub-agent generation (for Claude Code)
- [ ] AI-powered customization (Anthropic API)
- [ ] npm publishing

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## 📄 License

MIT © 2024

## 🏆 Credits

Built with:
- [Bun](https://bun.sh) - Fast JavaScript runtime and bundler
- [Commander.js](https://github.com/tj/commander.js) - CLI framework
- [Inquirer.js](https://github.com/SBoudrias/Inquirer.js) - Interactive prompts
- [Handlebars](https://handlebarsjs.com/) - Template engine
- [Chalk](https://github.com/chalk/chalk) - Terminal styling
- [Ora](https://github.com/sindresorhus/ora) - Loading spinners
- [YAML](https://github.com/eemeli/yaml) - YAML parser

## 💬 Support

- 📝 [Issues](https://github.com/yourusername/aicgen/issues)
- 💬 [Discussions](https://github.com/yourusername/aicgen/discussions)
- 📧 Email: your@email.com

---

**Made with ❤️ for the AI coding community**
