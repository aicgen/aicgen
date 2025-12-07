# Project Structure (Cleaned)

## Directory Layout

```
aicgen/
├── chunks/                          # Markdown chunk system
│   ├── chunk-mappings.yml          # 53 chunk mappings
│   └── claude-code/                # All markdown chunks
│       ├── api/                    # API design (3 chunks)
│       ├── architecture/           # Architecture patterns (15 chunks)
│       ├── database/               # Database design (3 chunks)
│       ├── devops/                 # DevOps practices (2 chunks)
│       ├── error-handling/         # Error handling (1 chunk)
│       ├── language/               # Language support (12 chunks)
│       ├── patterns/               # Enterprise patterns (6 chunks)
│       ├── performance/            # Performance optimization (3 chunks)
│       ├── practices/              # Development practices (3 chunks)
│       ├── security/               # Security guidelines (4 chunks)
│       ├── style/                  # Code style (2 chunks)
│       └── testing/                # Testing practices (3 chunks)
│
├── src/
│   ├── commands/                   # CLI commands
│   │   ├── init.ts                # Interactive wizard
│   │   └── stats.ts               # Chunk statistics
│   │
│   ├── models/                     # TypeScript models
│   │   ├── chunk.ts               # Chunk interfaces
│   │   ├── profile.ts             # Profile types
│   │   └── project.ts             # Project fingerprint types
│   │
│   ├── services/                   # Core services
│   │   ├── ai/
│   │   │   └── anthropic.ts       # Anthropic API client (future use)
│   │   ├── assistant-file-writer.ts    # Generate assistant files
│   │   ├── config-generator.ts         # Main orchestrator
│   │   ├── markdown-chunk-loader.ts    # Load & filter chunks
│   │   ├── project-scanner.ts          # Project detection
│   │   └── recommender.ts              # Smart recommendations
│   │
│   ├── utils/                      # Utilities
│   │   ├── errors.ts              # Error classes
│   │   ├── file.ts                # File operations
│   │   ├── logger.ts              # Logging utilities
│   │   └── path.ts                # Path utilities
│   │
│   └── index.ts                    # CLI entry point
│
├── package.json                    # Dependencies & scripts
├── tsconfig.json                   # TypeScript config
├── README.md                       # Main documentation
├── BUILD.md                        # Build instructions
└── STRUCTURE.md                    # This file
```

## Source Files (16 files)

### Commands (2)
- `commands/init.ts` - Interactive wizard with project detection
- `commands/stats.ts` - Display chunk statistics

### Models (3)
- `models/chunk.ts` - Chunk metadata and interfaces
- `models/profile.ts` - Profile selection and config types
- `models/project.ts` - Project fingerprint types

### Services (6)
- `services/assistant-file-writer.ts` - Generate files for each AI assistant
- `services/config-generator.ts` - Orchestrate generation flow
- `services/markdown-chunk-loader.ts` - Load and filter markdown chunks
- `services/project-scanner.ts` - Detect language, framework, database
- `services/recommender.ts` - Suggest instruction level & architecture
- `services/ai/anthropic.ts` - Anthropic API (for future AI-assisted generation)

### Utils (4)
- `utils/errors.ts` - Custom error classes
- `utils/file.ts` - File system operations
- `utils/logger.ts` - Logging utilities
- `utils/path.ts` - Path manipulation

### Entry Point (1)
- `index.ts` - CLI setup with Commander.js

## Data Flow

```
1. User runs: aicgen init

2. ProjectScanner
   └─> Analyzes project directory
   └─> Detects language, framework, database, team size
   └─> Returns ProjectFingerprint

3. ProfileRecommender
   └─> Takes ProjectFingerprint
   └─> Suggests InstructionLevel (basic/standard/expert/full)
   └─> Suggests ArchitectureType (modular-monolith/microservices/refactor)

4. Interactive Wizard (if no CLI flags)
   └─> Shows detected project info
   └─> Shows recommendations
   └─> Prompts for: Assistant, Level, Architecture
   └─> Returns ProfileSelection

5. MarkdownChunkLoader
   └─> Reads chunk-mappings.yml
   └─> Filters chunks by: language, level, architecture
   └─> Loads matching .md files
   └─> Concatenates with separators
   └─> Returns assembled markdown content

6. AssistantFileWriter
   └─> Takes assembled content + assistant type
   └─> Adds assistant-specific headers/footers
   └─> Generates file(s) for selected assistant:
       - Claude Code → claude.md
       - Copilot → .github/copilot-instructions.md
       - Gemini → .gemini/instructions.md
       - Antigravity → .agent/rules/instructions.md
       - Codex → .codex/instructions.md

7. File Writer
   └─> Creates directories
   └─> Writes files atomically (temp → rename)
   └─> Returns list of generated files
```

## Removed (Old Implementation)

The following were removed during cleanup:

### Directories
- ❌ `scripts/` - Old prebuild scripts (not needed with runtime chunk loading)
- ❌ `src/core/` - Duplicate of src/services/
- ❌ `src/domain/` - Unused domain layer
- ❌ `src/examples/` - Demo files
- ❌ `src/config/` - Old static config
- ❌ `src/data/` - Old profile data system

### Files
- ❌ `src/services/scanner.ts` - Duplicate of project-scanner.ts
- ❌ `src/services/generator.ts` - Old generator (replaced by config-generator.ts)
- ❌ `src/services/learner.ts` - Learning system (future feature)
- ❌ `src/services/profile-loader.ts` - Old profile system
- ❌ `src/services/template-renderer.ts` - Handlebars (switched to direct markdown)
- ❌ `src/services/prebuilt-loader.ts` - Old prebuilt system
- ❌ `src/services/chunk-assembler.ts` - Merged into markdown-chunk-loader.ts
- ❌ `src/services/prebuilt-chunk-loader.ts` - Old chunk system
- ❌ `src/models/guideline.ts` - Old guideline model
- ❌ `src/models/preference.ts` - Learning system model (future)

## Build Process

**No prebuild step needed!** Chunks are loaded at runtime.

```bash
# Just build the binary
bun run build:binary:windows

# Output: aicgen.exe (standalone, includes all chunks)
```

The binary includes:
- ✅ Bun runtime
- ✅ Compiled TypeScript code
- ✅ All dependencies (chalk, ora, inquirer, yaml, etc.)
- ✅ All 53 markdown chunks from chunks/claude-code/

Total size: ~45-50 MB standalone executable.
