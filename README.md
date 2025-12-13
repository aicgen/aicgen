<p align="center">
  <img src="assets/logo.svg" width="1000" alt="aicgen logo" />
</p>

<p align="center">
  <em>Configuration generator for AI coding assistants</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.0.15-cyan" alt="Version" />
  <img src="https://img.shields.io/badge/license-MIT-purple" alt="License" />
  <img src="https://img.shields.io/badge/bun-%3E%3D1.0.0-cyan" alt="Bun" />
</p>

---

**aicgen** makes your project AI-ready in seconds. Generate tailored instruction files for your AI coding assistant with an interactive CLI wizard.

## ✨ Features

- **🎯 Multi-Assistant Support** - Claude Code, GitHub Copilot, Gemini, Antigravity, Codex
- **📚 65+ Guidelines** - Organized into 12 categories (Language, Architecture, Testing, Security, etc.)
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

### From Binary (Standalone)

Download the latest binary for your platform from the [releases page](https://github.com/lpsandaruwan/aicgen/releases):

- **Windows**: `aicgen.exe`
- **Linux**: `aicgen-linux`
- **macOS**: `aicgen-macos`

```bash
# Windows
.\aicgen.exe init
```

### From Source

```bash
git clone https://github.com/lpsandaruwan/aicgen.git
cd aicgen
bun install
bun run build:binary
bun run start init
```

---

## 📚 Guideline System

aicgen uses a **modular guideline architecture** with **65+ guidelines** organized into **12 categories**.

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
- [x] 65+ guidelines across 12 categories
- [x] Architecture-aware configuration (Layered, Modular Monolith, Microservices, etc.)
- [x] Auto-generated hooks and sub-agents for Claude Code
- [x] Custom guideline management (add/remove)
- [x] GitHub-based guideline updates

### 🚧 Future Enhancements

- [ ] Custom validation hooks
- [ ] Guideline versioning and diffing
- [ ] Project-specific guideline templates

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## 📄 License

MIT © 2025
