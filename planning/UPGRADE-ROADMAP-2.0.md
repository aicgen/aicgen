# aicgen 2.0 Upgrade Roadmap

Status (2026-11-17): Phases 0, 1 (core), 2 and parts of 3-4 are implemented in the working tree; see "Implementation status" at the end.
Baseline: aicgen 1.2.0 / aicgen-data 1.2.0 (last commits 26 May 2026).

Evidence base: vendor docs read on 2026-11-17 (Claude Code, Codex, Copilot,
Antigravity, Rust release blog, OWASP). Items marked **[verify]** were only
partly confirmed and must be re-checked against live docs before coding.

---

## 0. Goals and non-goals

Goals
1. Generated files are valid for the current version of each assistant.
2. Rules content is current, language-aware, and Rust is first-class.
3. Doc drift is caught by CI instead of by users.
4. One release (v2.0.0) with a migration path for existing generated configs.

Non-goals
- Supporting every assistant (Cursor, Windsurf, Aider, Gemini CLI). Revisit
  after 2.0 via the capability matrix (Phase 1).
- Rewriting the CLI in another language.

---

## Phase 0 - Correctness fixes (target: 1.3.0 patch release)

Everything here is a bug in current output. Ship before any redesign.

| # | Fix | Where | Acceptance |
|---|-----|-------|------------|
| 0.1 | Claude hooks: matcher matches tool name only. Use `matcher: "Read"` plus handler-level `if: "Read(.env*)"`. Read file path from stdin JSON (`tool_input.file_path`), not `${CLAUDE_FILE}`. Block with exit 2 + stderr. | `src/services/hook-generator.ts`, `aicgen-data/templates/hooks/*.json`, `.claude/settings.json` | A fixture test feeds a PreToolUse JSON for `.env` and asserts exit 2. [verify exit-code table] |
| 0.2 | Remove invalid `sandbox.allowInternetAccess` and `sandbox.workingDirectory`. If sandbox is wanted, use `sandbox.enabled`, `sandbox.network.allowedDomains`, `sandbox.filesystem.*`. Never write the author's absolute path. | `hook-generator.ts` `generateClaudeCodeSettings` | Generated settings validate against the current settings schema [verify schema URL]. |
| 0.3 | Subagent frontmatter: delete `temperature`; use `name`, `description`, `tools`, `model` (alias or `inherit`). | `subagent-generator.ts`, `aicgen-data/templates/agents/*`, `config.ts`, `ai-providers.config.ts` | No unknown frontmatter keys in generated agents. |
| 0.4 | Model defaults: replace `claude-3-5-sonnet-20241022`, `gpt-4o`, `gemini-2.0-flash-exp`, `claude-opus-4-5`, `claude-sonnet-4-5` with current IDs; sub-agents default to aliases. Keep env/config overrides. | `ai-providers.config.ts`, `config.yml`, `config.example.yml` | Models resolved at runtime from one table; README documents overrides. |
| 0.5 | Fix the `||` fallback chains in config parsing (`parseFloat(...) || userConfig... || default` treats an explicit temperature of 0 as unset). | `ai-providers.config.ts` | Unit test with temperature `0`. |
| 0.6 | Repo hygiene: remove committed `.vs/`, add to `.gitignore`; fix version mismatches (tap is 1.2.1, others 1.2.0). | repo roots | Clean `git status` after build. |

---

## Phase 1 - Assistant surface alignment (target: 2.0.0-alpha)

### 1.1 Capability matrix as code
- Convert `aicgen-data/agentic/capabilities.yml` into a versioned, typed matrix
  with: surface path, frontmatter schema, size limits, docs URL,
  `verifiedOn` date.
- Add `scripts/check-capabilities` that fails CI when `verifiedOn` is older
  than 90 days (forces periodic re-verification).

### 1.2 AGENTS.md as the shared base
- Generate one canonical `AGENTS.md` (<= 32 KiB, Codex default limit; keep
  well under that).
- Claude Code: generate `CLAUDE.md` that `@AGENTS.md`-imports it so there is
  one source of truth (Claude reads AGENTS.md natively only when no CLAUDE.md
  exists; v2.1.277+ [verify]).
- Copilot and Antigravity read AGENTS.md natively; keep their own files thin.

### 1.3 Per-assistant output

| Assistant | Generate | Retire / change |
|-----------|----------|-----------------|
| Claude Code | `CLAUDE.md`, `.claude/rules/*.md` with `paths:` globs (per language/category), `.claude/skills/<name>/SKILL.md` (SDLC workflows become skills), `.claude/agents/*.md`, hooks via `if` | `.claude/commands/` kept only as compat flag |
| Copilot | `.github/copilot-instructions.md`, `.github/instructions/*.instructions.md` (`applyTo`), `.github/prompts/*.prompt.md`, `.github/agents/*.agent.md`, `.github/skills/`, optional `.github/hooks/*.json` | `.github/chatmodes/` -> agents [verify rename] |
| Antigravity | `.agents/rules/*.md` (frontmatter `trigger`, `description`, `globs`; <= 24 KB each, flat dir), `.agents/skills/` | `.agent/` legacy path (still read, do not write); workflows are deprecated -> skills |
| Codex | `AGENTS.md`, `.agents/skills/`, root `plugin.json` (+ `.codex-plugin/plugin.json` fallback), `.agents/plugins/marketplace.json`, `.codex/hooks.json` | custom prompts (`/prompts:`) not generated |

Rule-mode mapping: guideline `levels`/`languages` map to Antigravity
`trigger: glob` + `globs`, Claude `paths:`, Copilot `applyTo`. This lets a Rust
rule load only when `.rs` files are touched, which keeps context small.

### 1.4 Migration
- `aicgen update` detects 1.x-generated files via a marker (comment/hash),
  rewrites them, and moves `.agent/` -> `.agents/` with a diff preview.
- `aicgen clear` knows both old and new targets.
- User-edited files are never overwritten without confirmation.

### 1.5 Gemini
- Keep `.gemini` clear-target for legacy cleanup only. Gemini CLI is now
  enterprise-scoped; Antigravity CLI (`agy`) covers individuals.

---

## Phase 2 - Rust first-class (target: 2.0.0-beta)

### 2.1 Rules (aicgen-data/language/rust/), rewritten and expanded

| File | Contents |
|------|----------|
| `index.md` | Overview, edition (2024), MSRV policy, toolchain pinning (`rust-toolchain.toml`) |
| `basics.md` | Project layout, workspaces, `&str`/`&[T]` params, ownership, iterators, let chains (1.88+, 2024 edition), `Option`/`Result` combinators, clippy-clean style |
| `error-handling.md` | `thiserror` in libraries, `anyhow`/`eyre` in binaries, `#[from]`, context, no `unwrap()` in non-test code, panics policy |
| `types-traits.md` | Newtypes, builder pattern, typestate, trait design, `impl Trait`, async fn in traits, RPIT capture rules (2024), `Send`/`Sync` |
| `async.md` | tokio, cancellation safety, `select!`, `spawn_blocking`, no blocking in async, structured concurrency, channels |
| `testing.md` | Rewrite: unit/integration/doc-tests, `cargo nextest`, `proptest`, `insta`, `mockall` vs hand-written fakes, `tokio::test`, test layout |
| `tooling.md` | `cargo fmt --check`, `clippy -D warnings`, `[workspace.lints]`, `cargo-deny`, `cargo-audit`, `cargo-udeps`, `cargo-semver-checks`, Cargo `[lints.cargo]` and publish-age cooldown (1.100) |
| `unsafe-ffi.md` | `unsafe_op_in_unsafe_fn`, `unsafe extern`, `// SAFETY:` comments, Miri, `bindgen`/`cbindgen`, `set_var` unsafe in 2024 |
| `performance.md` | Allocation, `Cow`, iterators vs loops, `criterion`/`divan`, profiling, `cargo build` profiles, LTO |
| `web-cli.md` | axum/tower layering, `serde`, `clap` derive, `tracing`, config, graceful shutdown |

Also add Rust cases to cross-cutting rules: security (injection, secrets,
`cargo-audit`), error-handling, API, database (`sqlx`), DevOps (CI caching,
`cargo-chef` Docker), performance.

Guideline mapping: levels `basic` = basics + error-handling; `standard` adds
types-traits, async, testing, tooling; `full` adds unsafe-ffi, performance,
web-cli.

### 2.2 CLI support
- `project-analyzer.ts`: parse `Cargo.toml` (workspace members, `edition`,
  `rust-version`, dependencies) -> frameworks (axum, actix-web, rocket, tokio,
  bevy, tauri, clap), testing hints (nextest, proptest), project type hints
  (bin vs lib vs workspace), package manager `cargo`, `build.rs`/`.cargo/config`.
- `config-generator.ts`: remove duplicate Rust detection, reuse analyzer.
- `hook-generator.ts`: opt-in Rust format hook (`cargo fmt` on PostToolUse for
  Edit|Write when path ends `.rs`, via `if`/stdin path); never run clippy or
  tests in hooks (keep the "use /check" rule).
- Permissions: allow `Bash(cargo check *)`, `Bash(cargo fmt *)`,
  `Bash(cargo clippy *)`, `Bash(cargo test *)`; ask for `cargo publish`,
  `cargo install`; deny `cargo login`.
- Subagent templates: language-aware sections (Rust: unsafe audit, error
  types, clone/alloc hot spots, lifetimes), replacing the TypeScript-only text.
- `/check` workflow: Rust command set (`cargo fmt --check`, `cargo clippy
  --all-targets -- -D warnings`, `cargo nextest run` or `cargo test`,
  `cargo deny check`).
- Tests: analyzer fixtures for a lib crate, bin crate, and workspace; snapshot
  tests for generated `.claude/rules/rust.md`, `.agents/rules/rust.md`,
  Copilot `applyTo: "**/*.rs"`.

### 2.3 Acceptance
- `aicgen init` in a fresh `cargo new` project selects Rust, generates all four
  assistants with Rust rules, no unknown frontmatter keys, files under size
  limits.
- Rust rules compile-checked: extract code blocks and run them through
  `rustc`/`cargo check` in CI (`scripts/validate-data` extension). Mark
  non-compiling illustrative blocks with `rust,ignore`.

---

## Phase 3 - Rules content refresh (target: 2.0.0-rc)

3.1 Language-aware examples
- Today security, API, DevOps, testing and error-handling examples are
  TypeScript only. Restructure as concept file + per-language snippets, or
  generate per-language variants from one template, so a Python/Go/Rust project
  does not receive TypeScript code.

3.2 Security
- Move to OWASP Top 10:2025 (add Software Supply Chain Failures and
  Mishandling of Exceptional Conditions; check where SSRF lands [verify]).
- New: supply chain (lockfiles, provenance, dependency cooldowns, SBOM),
  secrets scanning, SSRF, AI-assisted-coding risks (prompt injection via repo
  content, MCP server trust, reviewing generated code, never auto-running
  untrusted instructions).

3.3 Per-language upgrades
- TypeScript: TS 5.x/6.x features, ESM-only, `satisfies`, `using`, strict flags,
  Node 22/24 LTS, Vitest option beside Jest.
- Python: 3.13/3.14, `uv`, `ruff`, `pyright`/`mypy`, free-threaded notes,
  `pydantic` v2, `pytest`.
- Go: 1.2x generics/iterators, `slog`, `errors.Join`, `go tool`, fuzzing.
- Java/C#/Ruby/Kotlin/PHP: thin sets (Kotlin 124 lines, PHP 129) brought to
  parity; current LTS versions.

3.4 DevOps
- CI examples: current action versions, Node/Python/Go/Rust matrices,
  OIDC for deploys, pinned actions by SHA, caching.

3.5 Quality gates for rules
- Size budget per guideline (<= 6 KB) and per assembled output (<= 24 KB per
  Antigravity file, <= 32 KiB AGENTS.md).
- `validate-data` additions: frontmatter lint, broken link check, code-block
  language tag check, "last reviewed" date per file.

---

## Phase 4 - App and tooling hygiene (parallel with Phase 3)

- Dependencies: bump `@anthropic-ai/sdk`, `openai`, `commander`, `ora`,
  `@inquirer/*`, `typescript`; migrate Gemini SDK (`@google/generative-ai`
  appears superseded by `@google/genai` [verify]); ESLint 9 flat config with
  `typescript-eslint` 8; Prettier config committed.
- Tests: 12 test files today. Add generator snapshot tests for every
  assistant x level x language; coverage threshold in CI; update or remove
  the hard-coded "144 tests" badge.
- `embedded-data.ts` (1,728 lines) is generated: stop committing it or keep the
  freshness check but make it deterministic.
- CI: `setup-bun` v2 pinned version, Node matrix for the npm package, Windows
  and macOS runners for the binary build, `npm publish --provenance`.
- Packaging: update Homebrew formula automation, `.deb`/`.rpm`/NSIS specs for
  2.0; consider `cargo`-free single binary via `bun build --compile` (already
  used).
- Website (`aicgen.github.io`): update counts, assistants, Rust page, install
  docs; keep numbers generated from `version.json`.
- Docs: README, CONTRIBUTING, migration guide 1.x -> 2.0.

---

## Phase 5 - Release

1. 2.0.0-alpha: phases 0-1 behind `--next` flag.
2. 2.0.0-beta: Rust pack and CLI support.
3. 2.0.0-rc: rules refresh, migration tested on 3-5 real repos (TS, Python,
   Go, Rust, mixed monorepo).
4. 2.0.0: data repo tagged first, CLI embeds it, npm + Homebrew + binaries.

---

## Effort and order

| Phase | Rough size | Depends on |
|-------|-----------|------------|
| 0 | 1-2 days | - |
| 1 | 1-2 weeks | 0 |
| 2 | 1-1.5 weeks (rules ~60%, CLI ~40%) | 0; benefits from 1.3 rule-scoping |
| 3 | 2-3 weeks (content heavy) | 1 for per-language structure |
| 4 | 3-5 days, parallel | - |
| 5 | 2-3 days | all |

Phases 0, 2-rules and 4 are independent and can run in parallel sessions.
Phase 1 and the CLI half of Phase 2 touch the same files
(`assistant-file-writer.ts`, `workflow-injector.ts`, `project-analyzer.ts`) and
must be sequential.

---

## Risks

- **Vendor doc churn.** These surfaces changed within months. Mitigation:
  capability matrix with `verifiedOn` + CI staleness check.
- **Breaking existing configs.** Mitigation: generation markers, diff preview,
  `aicgen update --dry-run`, `.agent/` read-compat.
- **Rule bloat hurting agent performance.** Mitigation: path-scoped rules,
  size budgets, fewer but sharper rules.
- **Unverified claims.** Hook exit-code table, Copilot chatmodes rename,
  Gemini SDK successor, OWASP SSRF placement, Claude AGENTS.md fallback
  version. Re-verify first.

## Decisions needed from the owner

1. **Version**: ship as 2.0.0 (breaking output paths) or keep 1.x with flags?
   Recommended: 2.0.0.
2. **AGENTS.md-first** (single source, thin per-tool files) vs per-tool full
   copies? Recommended: AGENTS.md-first.
3. **Skills vs commands/workflows**: move SDLC workflows to skills for all
   tools? Recommended: yes, keep commands as an opt-in compat flag.
4. **Additional assistants** (Cursor, Gemini CLI, Windsurf) in 2.0 or later?
   Recommended: later, after the matrix exists.
5. **AI analysis feature**: keep multi-provider (Claude/OpenAI/Gemini) API
   analysis, or reduce to one provider to cut dependencies? 
6. **Per-language concept files** vs generated language variants for the
   cross-cutting rules (Phase 3.1)?
7. **Rust scope**: include Rust web/embedded/WASM sub-packs now, or only
   core + web/CLI first? Recommended: core + web/CLI first.


---

## Implementation status (2026-11-17)

Verified against vendor docs on 2026-11-17 (Claude Code, GitHub Copilot and VS Code, OpenAI Codex, Google Antigravity). All work is uncommitted.

Done
- Phase 0: hooks (`matcher` + `if`, stdin JSON, exit 2), settings (only documented keys plus `$schema`; no invalid sandbox keys), sub-agent frontmatter, model defaults, `||` fallbacks.
- Phase 1: context budgets (`context-budget.ts`) and per-guideline delivery (`guideline-delivery.ts`): path-scoped rules (Claude `paths:`, Copilot `applyTo`, Antigravity `trigger: glob`) and on-demand skills (`.claude/skills`, `.github/skills`, `.agents/skills`, Antigravity `model_decision`); concise always-on files; Antigravity on `.agents/` with `aicgen-` prefixes; Copilot custom agents (`.github/agents/*.agent.md`) and a `preToolUse` guard hook (`.github/hooks/aicgen-guard.json`); SDLC workflows delivered as skills for Copilot and Antigravity (prompt files and chat modes removed); Codex portable `plugin.json` plus the compatibility manifest; `quick-add` on the same delivery layer; safe `clear` for shared folders; 1.x output migration; budget summary in `aicgen init`.
- Phase 2: nine Rust guidelines (26 snippets compile-checked), Cargo manifest analysis, Rust-aware permissions, hooks, sub-agents, commands and globs.
- Phase 3: supply-chain and AI-agent security guidelines; tooling guidelines for TypeScript, Python, Go, Java, C#, Ruby, Kotlin and PHP; CI example refresh.
- Phase 4: dependency major upgrades with a regenerated `bun.lock`, ESLint 10 flat config, `@google/genai`, Node 22 engines, 2.0.0 version bump across the CLI, data, packaging and website.
- Content sweep: every guideline has a rules-first section and a curated `description` ("what + Use when ...") in `guideline-mappings.yml`, used as the skill/rule description and enforced by `validate-data`; the two caching guidelines were split into non-overlapping files with distinct titles; the four oversized Swift guidelines were rewritten rules-first (all guidelines now under 3,000 tokens, enforced); `validate-data` also rejects duplicate titles.
- Verification: typecheck, ESLint (0 errors), 280 Jest tests (including a 48-combination generation e2e), `validate-data`, Rust snippet compile, frozen-lockfile install, bun build and standalone binary.

Done in the final pass
- Language-aware localization (`guideline-localizer.ts`): language-agnostic guidelines drop examples and sections for other languages; non-TypeScript projects receive about 40% fewer guideline tokens (for example Python full: 38k to 21k).
- Level dedupe: the beginner `testing-basics`, `error-handling-basics` and `api-basics` guidelines apply only at the basic level, so standard and full no longer load two guidelines for one topic; the REST guideline no longer repeats API versioning.
- `swift-basics` rewritten rules-first (every guideline is now under 2,500 tokens).
- Skill-selection retrieval proxy test (35 task prompts against descriptions: 97% top-1, 100% top-3). This is a proxy, not a test with a real assistant.
- Release workflow: Node 22 for npm publish; Homebrew formula now serves macOS arm64, macOS Intel and Linux x64 from three tarballs (the old arm64-only formula broke Intel Macs and Linuxbrew); `build:binary:macos-x64` added; stale `yarn.lock` removed.
- OpenAI (`gpt-6-astra`) and Gemini (`gemini-3.8-flash`) default model IDs confirmed against vendor model pages; example config model lists refreshed.
- Website builds (`vite build`).

Not done
- Go, C#, Ruby, Kotlin, PHP and Swift snippets are not compiled: those toolchains are not installed here and installing them was blocked.
- Behaviour with real assistants (skill loading, rule following) and the interactive `aicgen init` wizard were not exercised; no assistant CLI is installed here.
- The cross-compiled macOS and Linux release binaries, the new Homebrew formula (`brew audit`) and the release workflow only run on tag push in CI.
- The remaining example bodies are unchanged apart from localization; some legacy guidelines (error handling, testing, async) still overlap in rules.
- Nothing is committed, tagged or released; the Homebrew tap still shows 1.2.1 until the 2.0.0 tag is pushed.
