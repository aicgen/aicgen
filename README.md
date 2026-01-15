<p align="center">
  <img src="assets/logo.svg" width="1000" alt="aicgen logo" />
</p>

<p align="center">
  <em>Configuration generator for AI coding assistants</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0--beta-cyan" alt="Version" />
  <img src="https://img.shields.io/badge/license-MIT-purple" alt="License" />
  <img src="https://img.shields.io/badge/bun-%3E%3D1.0.0-cyan" alt="Bun" />
  <img src="https://img.shields.io/github/actions/workflow/status/aicgen/aicgen/test.yml?branch=main&label=tests" alt="Tests" />
  <img src="https://img.shields.io/badge/coverage-94%25-brightgreen" alt="Coverage" />
</p>

---

**aicgen** makes your project AI-ready in seconds. Generate tailored instruction files for your AI coding assistant with an interactive CLI wizard.

## ✨ Features

- **🎯 Multi-Assistant Support** - Claude Code, GitHub Copilot, Gemini, Antigravity, Codex
- **📚 82+ Guidelines** - Organized into 12 categories (Language, Architecture, Testing, Security, etc.)
- **🎨 Interactive CLI** - Professional wizard with smart defaults and back navigation
- **⚡ Hooks & Sub-Agents** - Auto-generates Claude Code hooks and verification agents
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
4.  Generate the appropriate config files (`.claude/`, `.github/`, `.agent/`, etc.)

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
bun install
bun run build:binary
bun run start init
```

---

## 📚 Guideline System

aicgen uses a **modular guideline architecture** with **82+ guidelines** organized into **12 categories**.

```bash
# View guideline statistics
aicgen stats
```

**Categories:**
- **Language** - TypeScript, Python, Go, Rust, Java, C#, Ruby, JavaScript
- **Architecture** - Layered, Modular Monolith, Microservices, Event-Driven, Hexagonal
- **DevOps** - CI/CD, Docker, Observability (Log formats, Metrics)
- **Best Practices** - SOLID, DRY, Clean Code principles
- And more...

## 📁 Generated Outputs

### For Claude Code
```text
CLAUDE.md                      # Master instructions (project root)
.claude/
├── settings.json              # Hooks & permissions
├── guidelines/                # Modular guidelines
│   ├── language.md
│   ├── architecture.md
│   └── ...
└── agents/                    # Sub-agents
    └── guideline-checker.md
```

### For GitHub Copilot
```text
.github/
├── copilot-instructions.md    # Master instructions
└── instructions/              # Topic-specific files
```

### For Gemini / Antigravity
```text
.gemini/                       # or .agent/
└── instructions.md            # Consolidated system prompt
```

---

## 🗺️ Roadmap

### ✅ Completed

- [x] Interactive CLI wizard with back navigation
- [x] Multi-assistant support (Claude Code, Copilot, Gemini, Antigravity, Codex)
- [x] 82+ guidelines across 12 categories
- [x] Architecture-aware configuration (Layered, Modular Monolith, Microservices, etc.)
- [x] Auto-generated hooks and sub-agents for Claude Code
- [x] Custom guideline management (add/remove)
- [x] GitHub-based guideline updates

### 🚧 Future Enhancements

- [ ] Custom validation hooks
- [ ] Guideline versioning and diffing
- [ ] Project-specific guideline templates

## 🛠️ Development

### Running Tests

The project includes a comprehensive test suite with 60+ tests covering all core functionality:

```bash
# Run all tests
bun test

# Run tests with coverage report
bun test --coverage

# Run tests in watch mode
bun test --watch
```

### Test Coverage

Current test coverage: **94%** (93.44% function coverage, 94.52% line coverage)

**Test Suite Includes:**
- ✅ GuidelineLoader tests (filtering, level selection, architecture handling)
- ✅ Tarball extraction tests (CONFIG-based prefix validation)
- ✅ AssistantFileWriter tests (all 5 assistants - Claude Code, Copilot, Gemini, Antigravity, Codex)
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

MIT © 2025
