# Memory Lane - aicgen Project Context

## Last Updated
2024-12-16

## Project Overview
**aicgen** - CLI tool that generates AI coding assistant configuration files (CLAUDE.md, copilot-instructions.md, etc.) with embedded guidelines.

## Current Objective
Preparing v1.0 release - improving dataset coverage with basic-level guidelines.

## Recent Progress

### Completed
- ✅ Fixed CLAUDE.md location (now at project root, not `.claude/`)
- ✅ Fixed README guideline count claims (now accurate: 77 mappings)
- ✅ Added testing guidelines for Go, Rust, Java, C#, Ruby, JavaScript
- ✅ Added architecture depth for event-driven (messaging.md) and serverless (best-practices.md)
- ✅ Created `data/version.json` with accurate counts
- ✅ Created `data/README.md` contribution guide
- ✅ Added datasource selection (SQL/NoSQL/None) to wizard
- ✅ Created NoSQL database guidelines
- ✅ Added datasource filtering to guideline loader
- ✅ Fixed network permission gating by level (expert/full only)
- ✅ Added download safeguards (timeout, size limits)
- ✅ Added destructive regeneration warning in quick-add
- ✅ **Added 5 new basic-level guidelines (2024-12-16)**:
  - `testing-basics.md` - First unit test, assertions, running tests
  - `error-handling-basics.md` - Try/catch, throw, logging
  - `api-basics.md` - HTTP methods, status codes
  - `database-basics.md` - CRUD operations, SQL basics
  - `performance-basics.md` - Data structures, N+1 queries, indexing

### In Progress
- 🔄 No active work

### Pending
- ⏳ Consider project type expansion (frontend vs fullstack)

## Key Decisions
1. **Datasource dimension** - Users choose SQL, NoSQL, or None; database guidelines filtered accordingly
2. **Assistant-aware filtering** - Intentionally NOT implemented; all assistants share same guidelines (no assistant-specific content)
3. **Architecture options** - Added clean-architecture, ddd, serverless, hexagonal to wizard
4. **Level permissions** - Only expert/full levels get internet access (WebFetch, WebSearch)

## Important Files
- `src/commands/init.ts` - Main wizard flow
- `src/services/guideline-loader.ts` - Guideline filtering logic
- `src/models/profile.ts` - ProfileSelection interface with all dimensions
- `data/guideline-mappings.yml` - All guideline mappings
- `data/version.json` - Counts and metadata

## Technical Context
- Runtime: Bun
- Language: TypeScript (strict mode)
- CLI framework: Commander.js + @inquirer/prompts
- Embedded data pattern for binary distribution
- Auto-generated `src/embedded-data.ts` from `scripts/embed-data.ts`

## Architect Findings Status
| Issue | Status |
|-------|--------|
| guideline-loader ignores assistant | Documented as intentional |
| quick-add destructive without warning | ✅ Fixed |
| Download no timeout/size guards | ✅ Fixed |
| Default settings enable internet for all | ✅ Fixed (expert/full only) |
| Architecture wizard/data mismatch | ✅ Fixed |
| Language gaps outside TS/Python | ✅ Improved (basics + testing for 6 languages) |
| README claim mismatch | ✅ Fixed |
| Level imbalance | ✅ Fixed (basic: 12 → 17, +42% coverage) |

## Stats
- Total guidelines: 82 (up from 77)
- Languages: 8 (TS, Python, Go, Rust, Java, C#, Ruby, JS)
- Architectures: 8 (layered, modular-monolith, microservices, event-driven, hexagonal, clean-architecture, ddd, serverless)
- Levels: basic (17), standard (62), expert (76), full (82)
- Datasources: sql (3), nosql (1)
- Categories: Testing (4), Error Handling (2), API Design (4), Database (5), Performance (4)

## Next Session
1. Consider project type expansion (split "web" into "frontend" and "fullstack")
2. Consider running integration tests manually to verify wizard flow
3. Version bump for release
