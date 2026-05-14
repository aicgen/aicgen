# Workflow-Based Slash Commands — Design

**Date:** 2026-05-14  
**Status:** Approved  
**Author:** Lead Engineer

---

## Goal

Inject a structured SDLC workflow (as slash commands) into every generated assistant configuration. When a developer runs `aicgen init`, the output files for Claude Code, Copilot, Gemini, Codex, and Antigravity will all include a consistent set of 6 slash commands that guide them through the full software development lifecycle.

---

## Commands

The 6 commands, their flow, and their output artifacts:

| Command | Purpose | Artifact |
|---|---|---|
| `/spec [name]` | Capture feature requirements, user stories, acceptance criteria, constraints | `docs/specs/{name}.md` |
| `/research` | Internal codebase scan + web research for architecture patterns; prompts for infrastructure preference (serverless vs. fixed) | Appends `## Research Findings` to `docs/specs/{name}.md` |
| `/plan` | Produce a phased, checkpoint-driven implementation plan based on spec + research | `docs/plans/{name}.md` |
| `/build [phase?]` | Execute the next (or specified) plan phase; pauses between phases for review | *(code changes)* |
| `/check` | Verify implementation against spec — tests, code review, regression check | *(inline report)* |
| `/ship` | Pre-flight wrap-up — tests pass, docs updated, PR description drafted with links to spec and plan | *(PR ready)* |

**Natural flow:** `/spec` → `/research` → `/plan` → `/build` → `/check` → `/ship`

**Guard rails:**
- `/research` without a spec → prompt user to run `/spec` first
- `/plan` without research findings → warn and ask to confirm skip
- `/build` without a plan → prompt user to run `/plan` first

---

## `/research` — Detail

This command is two-part: internal + external.

**Steps:**
1. Read the active spec from `docs/specs/`
2. **Internal scan** — search codebase for related code, patterns, dependencies, conflicts
3. **Infrastructure preference prompt** — ask the user:
   > "Does this feature require infrastructure decisions?"
   > - **Cost-optimised / serverless** *(pay-per-use: Cloud Run, Cloud Functions, AWS Lambda, Fargate, etc.)*
   > - **Fixed / dedicated** *(predictable load: Kubernetes, EC2, GKE, dedicated VMs, etc.)*
   > - **No infrastructure involved**
4. **Web research** — search for architecture patterns, best practices, reference implementations relevant to the spec. Bias results toward the chosen infrastructure model.
5. Surface: recommended approaches, trade-offs, cost implications, reference links
6. Suggest improvements or clarifications to the spec
7. Append `## Research Findings` section to the spec doc
8. Prompt user to run `/plan`

For Claude Code this maps to WebSearch tool use. For other assistants it is a system instruction to use their built-in search capability.

---

## Output directory

All spec and plan artifacts are saved to the `docs/` directory in the user's project. If `docs/` does not exist, it is created.

```
docs/
├── specs/
│   └── {feature-name}.md
└── plans/
    └── {feature-name}.md
```

---

## Architecture

### Approach: Dedicated Workflow Layer (Approach B)

Workflows are a separate concern from guidelines. They get their own data file, their own service, and per-assistant formatting — no changes to `GuidelineLoader`, `guideline-mappings.yml`, or the CLI wizard.

```
data/
└── workflows/
    └── sdlc.md              ← single source of truth for all 6 commands

src/services/
├── workflow-injector.ts     ← NEW: reads sdlc.md, formats per-assistant
└── assistant-file-writer.ts ← MODIFIED: calls WorkflowInjector, always unconditional

aicgen-docs/
└── workflows/
    ├── README.md            ← overview, full flow diagram, when to use each command
    └── sdlc/
        ├── spec.md
        ├── research.md
        ├── plan.md
        ├── build.md
        ├── check.md
        └── ship.md
```

### Data flow

1. `aicgen init` runs — user picks assistant, language, level as today (no new wizard steps)
2. `AssistantFileWriter.generateFiles()` calls `WorkflowInjector.generateWorkflowFiles(assistant)`
3. `WorkflowInjector` reads `data/workflows/sdlc.md`, parses into 6 `WorkflowCommand` objects, returns `GeneratedFile[]` formatted for that assistant
4. Workflow files are merged with guideline files and written to disk

---

## Service Design

### `WorkflowInjector` (new)

```typescript
interface WorkflowCommand {
  name: string;        // 'spec' | 'research' | 'plan' | 'build' | 'check' | 'ship'
  description: string; // one-line summary for index/header files
  content: string;     // full command body from sdlc.md
}

export class WorkflowInjector {
  static async create(): Promise<WorkflowInjector>
  generateWorkflowFiles(assistant: AIAssistant): GeneratedFile[]
  buildWorkflowSection(): string  // for inline injection (gemini, codex)
}
```

### Per-assistant output

| Assistant | Format | File paths |
|---|---|---|
| `claude-code` | One file per command | `.claude/commands/{name}.md` |
| `copilot` | Single instructions file | `.github/instructions/workflows.instructions.md` |
| `gemini` | Injected section | Appended to `.gemini/instructions.md` |
| `codex` | Injected section | Appended to `.codex/instructions.md` |
| `antigravity` | One file per command | `.agent/workflows/{name}.md` |
| `AGENTS.md` | New "Workflows" section | Listed with one-line descriptions |

### `AssistantFileWriter` changes

- Add `workflowInjector: WorkflowInjector` field
- In `generateFiles()`, after guideline files are built, call `workflowInjector.generateWorkflowFiles(assistant)` and push results
- Add `## Workflows` section to CLAUDE.md listing the 6 commands
- Add workflow reference to AGENTS.md universal file
- For Gemini and Codex, pass `workflowInjector.buildWorkflowSection()` into the content builder

---

## `data/workflows/sdlc.md` Structure

Each command is a delimited block that `WorkflowInjector` parses by `##` heading:

```markdown
# SDLC Workflows

## /spec [name]
one-line description

**Steps:**
1. ...

---

## /research
one-line description

**Pre-condition:** ...

**Steps:**
1. ...

---
[... repeat for /plan, /build, /check, /ship ...]
```

---

## `aicgen-docs` Organization

```
aicgen-docs/workflows/
├── README.md          ← what SDLC workflows are, flow diagram, when to use
└── sdlc/
    ├── spec.md        ← full reference: purpose, steps, example output, tips
    ├── research.md
    ├── plan.md
    ├── build.md
    ├── check.md
    └── ship.md
```

These are human-readable contributor/user docs. They stay in sync with `data/workflows/sdlc.md` but are not parsed by the tool.

---

## Testing Plan

| Test | Type | What it checks |
|---|---|---|
| `WorkflowInjector` parses `sdlc.md` into 6 commands | Unit | Correct count, names, non-empty content |
| `generateWorkflowFiles('claude-code')` returns 6 files at correct paths | Unit | Paths match `.claude/commands/*.md` |
| `generateWorkflowFiles('copilot')` returns 1 file | Unit | Path matches `.github/instructions/workflows.instructions.md` |
| `AssistantFileWriter` output includes workflow files for each assistant | Integration | No regressions in existing file generation |
| `bun test` stays green | Regression | All existing tests pass |

---

## Out of scope

- Changes to `guideline-mappings.yml`
- Changes to `GuidelineLoader`
- Changes to the `aicgen init` CLI wizard (no new user-facing prompts)
- `aicgen-site` updates (separate effort)
