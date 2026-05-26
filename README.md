<p align="center">
  <img src="assets/logo.svg" width="1000" alt="aicgen logo" />
</p>

<p align="center">
  <em>Configuration generator for AI coding assistants</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.2.0-cyan" alt="Version" />
  <img src="https://img.shields.io/badge/license-MIT-purple" alt="License" />
  <img src="https://img.shields.io/badge/bun-%3E%3D1.0.0-cyan" alt="Bun" />
  <img src="https://img.shields.io/github/actions/workflow/status/aicgen/aicgen/test.yml?branch=main&label=tests" alt="Tests" />
  <img src="https://img.shields.io/badge/tests-144-brightgreen" alt="Tests" />
</p>

---

**aicgen** makes your project AI-ready in seconds. Generate tailored instruction files, workflows, skills, and guarded agentic surfaces for the coding tools your team actually uses.

## ✨ Features

- **🎯 Multi-Assistant Support** - Claude Code, GitHub Copilot, Antigravity, Codex
- **📚 99 Guidelines** - Organized into 12 categories (Language, Architecture, Testing, Security, etc.)
- **🎨 Interactive CLI** - Professional wizard with smart defaults and back navigation
- **⚡ Agentic Profiles** - Three progressive levels: `basic`, `standard`, and `full`
- **🔁 SDLC Workflows** - `/spec`, `/research`, `/plan`, `/build`, `/check`, and `/ship`
- **🧩 Codex SDLC Plugin** - Project-local `aicgen-sdlc` plugin with namespaced `/aicgen-*` skills
- **🏗️ Architecture Aware** - Supports Microservices, Modular Monoliths, Hexagonal, and more
- **📦 Zero External Dependencies** - All guideline data is embedded in the binary

## 🚀 Quick Start

Navigate to your project and run:

```bash
aicgen init
```

The CLI will:
1.  Detect your project language and structure
2.  Guide you through assistant, architecture, and detail level selection
3.  Let you customize which guidelines to include
4.  Generate the appropriate config files (`.claude/`, `.github/`, `.agent/`, `.codex/`, `AGENTS.md`, and local plugin files)

---

## 📦 Installation

### From npm (Easiest)

```bash
# Install globally
npm install -g @aicgen/aicgen

# Or use with npx (no installation)
npx @aicgen/aicgen init
```

### From Homebrew (macOS)

```bash
# Add the tap
brew tap aicgen/aicgen

# Install aicgen
brew install aicgen
```

### From Binary (Standalone)

Download the latest installer for your platform from the [releases page](https://github.com/aicgen/aicgen/releases):

- **Windows**: `aicgen-setup-x64.exe` installer
- **Linux (Debian/Ubuntu)**: `aicgen_amd64.deb`
- **Linux (Fedora/RHEL)**: `aicgen_x86_64.rpm`

```bash
# Windows - run the installer
aicgen-setup-x64.exe

# Linux (Debian/Ubuntu)
sudo dpkg -i aicgen_amd64.deb

# Linux (Fedora/RHEL)
sudo rpm -i aicgen_x86_64.rpm
```

### From Source

```bash
git clone https://github.com/aicgen/aicgen.git
cd aicgen
git submodule update --init --recursive data
bun install
bun run build:binary
bun run start init
```

---

## 📚 Guideline System

aicgen uses a **modular guideline architecture** with **99 guidelines** organized into **12 categories**. Release builds embed content from the `data/` submodule, or from `AICGEN_DATA_DIR` when developing against a sibling `aicgen-data` checkout.

**Release 1.2.0 stats:**

| Metric | Count |
|--------|-------|
| Guidelines | 99 |
| SDLC workflows | 6 |
| Categories | 12 |
| Languages | 12 |
| Architectures | 10 |
| Datasources | 2 |
| Profile levels | `basic`, `standard`, `full` |

```bash
# View guideline statistics
aicgen stats
```

**Categories:**
- **Language** - TypeScript, JavaScript, Python, Go, Rust, Java, C#, Ruby, Dart, Swift, Kotlin, PHP
- **Architecture** - Layered, Modular Monolith, Microservices, Event-Driven, Hexagonal
- **DevOps** - CI/CD, Docker, Observability (Log formats, Metrics)
- **Best Practices** - SOLID, DRY, Clean Code principles
- And more...

## 📁 Generated Outputs

Profile levels control how much AICGEN generates:

| Level | Output |
|-------|--------|
| `basic` | Stable repo instructions and rules only |
| `standard` | Instructions plus guided workflows, prompt files, and Codex SDLC skills |
| `full` | Full agentic setup with skills, subagents, guardrail hooks, plugins, and MCP templates |

### For Claude Code
```text
CLAUDE.md                      # Master instructions (project root)
.claude/
├── settings.json              # Guardrail hooks & permissions
├── guidelines/                # Modular guidelines
│   ├── language.md
│   ├── architecture.md
│   └── ...
├── agents/                    # Sub-agents
│   └── guideline-checker.md
└── skills/                    # Full profile project skills
```

### For GitHub Copilot
```text
.github/
├── copilot-instructions.md    # Master instructions
├── instructions/              # Topic-specific files
├── prompts/                   # Standard+ reusable prompt files
└── chatmodes/                 # Full profile VS Code chat modes
```

### For Antigravity
```text
.agent/
├── rules/
│   └── instructions.md        # Workspace rule index
└── workflows/                 # Profile-enabled workflows
```

### For Codex
```text
AGENTS.md                      # First-class Codex instructions
.codex/
├── instructions.md            # Codex development guide
├── hooks.json                 # Full profile session reminder hook
└── hooks/                     # Full profile hook scripts
.agents/
└── plugins/marketplace.json   # Project-local plugin install entry
plugins/
└── aicgen-sdlc/               # SDLC lifecycle plugin
    ├── .codex-plugin/plugin.json
    └── skills/aicgen-*/SKILL.md
```

> Gemini CLI generation has been removed from active assistant targets. Use Antigravity for Google-side agentic coding profiles.

---

## 🗺️ Roadmap

### ✅ Completed

- [x] Interactive CLI wizard with back navigation
- [x] Multi-assistant support (Claude Code, Copilot, Antigravity, Codex)
- [x] 99 guidelines across 12 categories
- [x] Architecture-aware configuration (Layered, Modular Monolith, Microservices, etc.)
- [x] Profile-gated agentic surfaces for workflows, skills, plugins, hooks, and MCP templates
- [x] Custom guideline management (add/remove)
- [x] GitHub-based guideline updates

### 🚧 Future Enhancements

- [ ] Custom organization policy packs
- [ ] Guideline versioning and diffing
- [ ] Project-specific guideline templates

## 🛠️ Development

### Running Tests

The project includes a comprehensive test suite with 144 tests covering all core functionality:

```bash
# Check embedded instruction data is fresh
bun run check:embedded-data

# Validate the data submodule
data/scripts/validate-data

# Typecheck
bun run typecheck

# Run all tests
bun run test -- --runInBand

# Run tests with coverage report
bun run test:coverage -- --runInBand

# Run tests in watch mode
bun run test:watch
```

### Test Coverage

Current release validation: embedded data freshness, data schema validation, typecheck, Jest tests, and Bun build.

**Test Suite Includes:**
- ✅ GuidelineLoader tests (filtering, level selection, architecture handling)
- ✅ Tarball extraction tests (CONFIG-based prefix validation)
- ✅ AssistantFileWriter tests (Claude Code, Copilot, Antigravity, Codex)
- ✅ Agentic capability matrix and profile gating tests
- ✅ Codex project-local plugin generation tests
- ✅ File generation and path handling (cross-platform compatibility)
- ✅ Content validation and metadata inclusion

Tests are automatically excluded from builds via `tsconfig.json`.

### Project Structure

```
src/
├── __tests__/              # Test suite
│   └── services/
│       ├── guideline-loader.test.ts
│       ├── tarball-extraction.test.ts
│       └── assistant-file-writer.test.ts
├── commands/               # CLI commands (init, update, quick-add)
├── services/               # Core business logic
└── config.ts              # Configuration management
```

---

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## 📄 License

MIT © 2026
