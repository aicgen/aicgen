# Workflow Slash Commands Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Inject 6 SDLC slash commands (`/spec`, `/research`, `/plan`, `/build`, `/check`, `/ship`) into every generated assistant configuration file, unconditionally, for all 5 supported assistants.

**Architecture:** A new `WorkflowInjector` service reads `data/workflows/sdlc.md` (the single source of truth) and returns `GeneratedFile[]` formatted per-assistant. `AssistantFileWriter` calls it after building guideline files. No changes to the wizard, `GuidelineLoader`, or `guideline-mappings.yml`.

**Tech Stack:** TypeScript, ESM modules, Jest + ts-jest, `fs/promises`, existing `GeneratedFile` interface from `src/services/assistant-file-writer.ts`.

---

## Task 1: Create the workflow data file

**Files:**
- Create: `data/workflows/sdlc.md`

### Step 1: Create `data/workflows/sdlc.md`

This is the single source of truth. `WorkflowInjector` will parse it by `##` headings — each heading becomes one command. The first line after the heading is the one-line description; everything else is the command body.

```markdown
# SDLC Workflows

## /spec [name]
Capture the full specification for a feature or task before any code is written.

**Steps:**
1. Ask for a feature name if not provided as an argument
2. Ask the user to describe: goal, user stories, acceptance criteria, constraints, and what is explicitly out of scope
3. Create `docs/specs/` directory if it does not exist
4. Save the gathered information to `docs/specs/{name}.md` using the template below
5. Confirm the file was saved and prompt the user to run `/research`

**Output template (`docs/specs/{name}.md`):**
```markdown
# Spec: {name}

## Goal
{goal}

## User Stories
{user stories}

## Acceptance Criteria
{acceptance criteria}

## Constraints
{constraints}

## Out of Scope
{out of scope}
```

---

## /research
Analyze the active spec with internal codebase scanning and external web research.

**Pre-condition:** An active spec must exist in `docs/specs/` — if none is found, tell the user to run `/spec` first and stop.

**Steps:**
1. Read the most recently modified spec from `docs/specs/`
2. **Internal scan:** Search the codebase for related code, existing patterns, similar implementations, dependencies, and potential conflicts relevant to the spec
3. **Infrastructure prompt:** Ask the user:
   > "Does this feature require infrastructure decisions?"
   > - Cost-optimised / serverless (pay-per-use: Cloud Run, Cloud Functions, AWS Lambda, Fargate, etc.)
   > - Fixed / dedicated (predictable load: Kubernetes, EC2, GKE, dedicated VMs, etc.)
   > - No infrastructure involved
4. **Web research:** Search for architecture patterns, best practices, reference implementations, and cost comparisons relevant to the spec. Bias results toward the chosen infrastructure model if one was selected.
5. Surface: recommended approaches, trade-offs, cost implications, and links to reference material
6. Suggest any improvements or clarifications to the spec based on findings
7. Append a `## Research Findings` section to the active spec file containing: internal findings, web research summary, infrastructure recommendation (if applicable), and suggested spec improvements
8. Prompt the user to run `/plan`

---

## /plan
Produce a phased, checkpoint-driven implementation plan based on the spec and research findings.

**Pre-condition:** An active spec with a `## Research Findings` section must exist — if research has not been run, warn the user and ask them to confirm they want to skip it before proceeding.

**Steps:**
1. Read the active spec (including research findings) from `docs/specs/`
2. Analyse the codebase to understand existing structure, patterns, and conventions
3. Break the implementation into phases — each phase must be independently verifiable
4. For each phase, list: files to create or modify, key decisions, and how to verify it is complete
5. Identify risks and propose mitigations
6. Create `docs/plans/` directory if it does not exist
7. Save the plan to `docs/plans/{spec-name}.md`
8. Confirm the file was saved and prompt the user to run `/build`

---

## /build [phase]
Execute the next (or a specified) phase of the current implementation plan.

**Pre-condition:** An active plan must exist in `docs/plans/` — if none is found, tell the user to run `/plan` first and stop.

**Steps:**
1. Read the active plan from `docs/plans/`
2. Determine the next incomplete phase (or the phase specified by the argument)
3. Announce which phase is being executed and what it covers
4. Implement the phase step by step, following existing codebase patterns and conventions
5. After completing the phase, summarise what was changed and what was created
6. Mark the phase as complete in the plan file
7. Run any tests relevant to the completed phase and report results
8. Pause and ask: "Phase {n} complete. Continue to phase {n+1}?" before proceeding

---

## /check
Verify the current implementation against the active spec — tests, code review, and regression check.

**Steps:**
1. Read the active spec from `docs/specs/` and the active plan from `docs/plans/`
2. Run the full test suite and report results
3. Review all changed files against the spec's acceptance criteria — flag any gaps
4. Check for regressions by reviewing changed files for unintended side effects
5. Produce a structured report:
   - ✅ Acceptance criteria met
   - ❌ Acceptance criteria not met (with details)
   - ⚠️ Potential regressions (with details)
   - 📋 Suggested fixes
6. If all criteria are met and no regressions are found, prompt the user to run `/ship`

---

## /ship
Pre-flight wrap-up — verify everything is ready, then draft a PR description.

**Steps:**
1. Run the full test suite — stop and report if any tests fail
2. Read the active spec and plan
3. Verify that `docs/specs/{name}.md` and `docs/plans/{name}.md` are up to date
4. Check for uncommitted changes and list them
5. Draft a PR description referencing the spec and plan:
   ```
   ## Summary
   {goal from spec}

   ## Changes
   {summary of phases completed}

   ## Spec
   docs/specs/{name}.md

   ## Plan
   docs/plans/{name}.md

   ## Test plan
   {acceptance criteria from spec as a checklist}
   ```
6. Present the PR description to the user for review
7. Ask: "Ready to commit and push?" — if yes, stage all changes and create a commit with a conventional commit message
```

### Step 2: Verify the file was created

```bash
cat /mnt/f/aicgen/aicgen/data/workflows/sdlc.md | head -20
```

Expected: First 20 lines of the file with `# SDLC Workflows` at the top.

### Step 3: Commit

```bash
cd /mnt/f/aicgen/aicgen
git add data/workflows/sdlc.md
git commit -m "feat(data): add SDLC workflow slash commands source template"
```

---

## Task 2: Create the `WorkflowInjector` service (TDD)

**Files:**
- Create: `src/services/__tests__/workflow-injector.test.ts`
- Create: `src/services/workflow-injector.ts`

### Step 1: Write the failing tests

Create `src/services/__tests__/workflow-injector.test.ts`:

```typescript
import { WorkflowInjector } from '../workflow-injector.js';

const SAMPLE_SDLC_CONTENT = `# SDLC Workflows

## /spec [name]
Capture the full specification for a feature or task.

**Steps:**
1. Ask for a feature name

---

## /research
Analyze the active spec with codebase scanning and web research.

**Pre-condition:** Active spec must exist.

**Steps:**
1. Read the spec

---

## /plan
Produce a phased implementation plan.

**Steps:**
1. Read the spec

---

## /build [phase]
Execute the next phase of the current plan.

**Steps:**
1. Read the plan

---

## /check
Verify implementation against the active spec.

**Steps:**
1. Run tests

---

## /ship
Pre-flight wrap-up and PR draft.

**Steps:**
1. Run tests
`;

describe('WorkflowInjector', () => {
  let injector: WorkflowInjector;

  beforeEach(() => {
    injector = WorkflowInjector.fromContent(SAMPLE_SDLC_CONTENT);
  });

  describe('parsing', () => {
    it('should parse all 6 commands from sdlc content', () => {
      const commands = injector.getCommands();
      expect(commands).toHaveLength(6);
    });

    it('should parse command names correctly', () => {
      const commands = injector.getCommands();
      const names = commands.map(c => c.name);
      expect(names).toEqual(['spec', 'research', 'plan', 'build', 'check', 'ship']);
    });

    it('should parse one-line description for each command', () => {
      const commands = injector.getCommands();
      expect(commands[0].description).toBe('Capture the full specification for a feature or task.');
      expect(commands[1].description).toBe('Analyze the active spec with codebase scanning and web research.');
    });

    it('should include the full body content for each command', () => {
      const commands = injector.getCommands();
      expect(commands[0].content).toContain('**Steps:**');
      expect(commands[1].content).toContain('**Pre-condition:**');
    });
  });

  describe('generateWorkflowFiles - claude-code', () => {
    it('should return 6 files for claude-code', () => {
      const files = injector.generateWorkflowFiles('claude-code');
      expect(files).toHaveLength(6);
    });

    it('should place files at .claude/commands/{name}.md', () => {
      const files = injector.generateWorkflowFiles('claude-code');
      expect(files[0].path).toBe('.claude/commands/spec.md');
      expect(files[1].path).toBe('.claude/commands/research.md');
      expect(files[5].path).toBe('.claude/commands/ship.md');
    });

    it('should mark files as type workflow', () => {
      const files = injector.generateWorkflowFiles('claude-code');
      expect(files.every(f => f.type === 'workflow')).toBe(true);
    });

    it('should include command content in each file', () => {
      const files = injector.generateWorkflowFiles('claude-code');
      expect(files[0].content).toContain('**Steps:**');
    });
  });

  describe('generateWorkflowFiles - copilot', () => {
    it('should return 1 file for copilot', () => {
      const files = injector.generateWorkflowFiles('copilot');
      expect(files).toHaveLength(1);
    });

    it('should place file at .github/instructions/workflows.instructions.md', () => {
      const files = injector.generateWorkflowFiles('copilot');
      expect(files[0].path).toBe('.github/instructions/workflows.instructions.md');
    });

    it('should include all 6 commands in the single file', () => {
      const files = injector.generateWorkflowFiles('copilot');
      const content = files[0].content;
      expect(content).toContain('/spec');
      expect(content).toContain('/research');
      expect(content).toContain('/plan');
      expect(content).toContain('/build');
      expect(content).toContain('/check');
      expect(content).toContain('/ship');
    });

    it('should include applyTo frontmatter', () => {
      const files = injector.generateWorkflowFiles('copilot');
      expect(files[0].content).toContain('applyTo:');
    });
  });

  describe('generateWorkflowFiles - gemini', () => {
    it('should return empty array for gemini (inline injection)', () => {
      const files = injector.generateWorkflowFiles('gemini');
      expect(files).toHaveLength(0);
    });
  });

  describe('generateWorkflowFiles - codex', () => {
    it('should return empty array for codex (inline injection)', () => {
      const files = injector.generateWorkflowFiles('codex');
      expect(files).toHaveLength(0);
    });
  });

  describe('generateWorkflowFiles - antigravity', () => {
    it('should return 6 files for antigravity', () => {
      const files = injector.generateWorkflowFiles('antigravity');
      expect(files).toHaveLength(6);
    });

    it('should place files at .agent/workflows/{name}.md', () => {
      const files = injector.generateWorkflowFiles('antigravity');
      expect(files[0].path).toBe('.agent/workflows/spec.md');
      expect(files[5].path).toBe('.agent/workflows/ship.md');
    });
  });

  describe('buildWorkflowSection', () => {
    it('should return a markdown string with all 6 commands', () => {
      const section = injector.buildWorkflowSection();
      expect(section).toContain('## SDLC Workflows');
      expect(section).toContain('/spec');
      expect(section).toContain('/ship');
    });
  });
});
```

### Step 2: Run the tests to confirm they fail

```bash
cd /mnt/f/aicgen/aicgen
npx jest src/services/__tests__/workflow-injector.test.ts --no-coverage
```

Expected: All tests fail with `Cannot find module '../workflow-injector.js'`.

### Step 3: Implement `WorkflowInjector`

Create `src/services/workflow-injector.ts`:

```typescript
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { AIAssistant } from '../models/project.js';
import { GeneratedFile } from './assistant-file-writer.js';

export interface WorkflowCommand {
  name: string;
  description: string;
  content: string;
}

export class WorkflowInjector {
  private constructor(private readonly commands: WorkflowCommand[]) {}

  static fromContent(sdlcContent: string): WorkflowInjector {
    return new WorkflowInjector(WorkflowInjector.parse(sdlcContent));
  }

  static async create(): Promise<WorkflowInjector> {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const sdlcPath = join(__dirname, '../../data/workflows/sdlc.md');
    const content = await readFile(sdlcPath, 'utf-8');
    return WorkflowInjector.fromContent(content);
  }

  private static parse(content: string): WorkflowCommand[] {
    const commands: WorkflowCommand[] = [];
    // Split on ## headings that start with /
    const blocks = content.split(/\n(?=## \/)/);

    for (const block of blocks) {
      const lines = block.trim().split('\n');
      const heading = lines[0];
      if (!heading.startsWith('## /')) continue;

      // Extract name: "## /spec [name]" -> "spec"
      const nameMatch = heading.match(/^## \/(\w+)/);
      if (!nameMatch) continue;
      const name = nameMatch[1];

      // Second line is the one-line description
      const description = lines[1]?.trim() ?? '';

      // Rest is the body (skip heading, description, and trailing ---)
      const body = lines
        .slice(2)
        .join('\n')
        .replace(/\n---\s*$/, '')
        .trim();

      commands.push({ name, description, content: body });
    }

    return commands;
  }

  getCommands(): WorkflowCommand[] {
    return this.commands;
  }

  generateWorkflowFiles(assistant: AIAssistant): GeneratedFile[] {
    switch (assistant) {
      case 'claude-code':
        return this.commands.map(cmd => ({
          path: `.claude/commands/${cmd.name}.md`,
          content: this.formatClaudeCommand(cmd),
          type: 'workflow' as const,
        }));

      case 'copilot':
        return [{
          path: '.github/instructions/workflows.instructions.md',
          content: this.formatCopilotInstructions(),
          type: 'workflow' as const,
        }];

      case 'antigravity':
        return this.commands.map(cmd => ({
          path: `.agent/workflows/${cmd.name}.md`,
          content: this.formatAntigravityWorkflow(cmd),
          type: 'workflow' as const,
        }));

      case 'gemini':
      case 'codex':
        // Inline injection — AssistantFileWriter calls buildWorkflowSection() directly
        return [];

      default:
        return [];
    }
  }

  buildWorkflowSection(): string {
    const commandDocs = this.commands
      .map(cmd => `### /${cmd.name}\n${cmd.description}\n\n${cmd.content}`)
      .join('\n\n---\n\n');

    return `## SDLC Workflows

The following slash commands guide you through a structured SDLC. Always start with \`/spec\` and follow the flow: \`/spec\` → \`/research\` → \`/plan\` → \`/build\` → \`/check\` → \`/ship\`.

All spec and plan artifacts are saved to the \`docs/\` directory (created automatically if it does not exist).

${commandDocs}`;
  }

  private formatClaudeCommand(cmd: WorkflowCommand): string {
    return `# /${cmd.name}

${cmd.description}

${cmd.content}
`;
  }

  private formatCopilotInstructions(): string {
    const commandDocs = this.commands
      .map(cmd => `### /${cmd.name}\n${cmd.description}\n\n${cmd.content}`)
      .join('\n\n---\n\n');

    return `---
applyTo: "**/*"
description: "SDLC workflow slash commands"
---

# SDLC Workflows

Follow this structured workflow for every feature. Start with \`/spec\` and proceed in order.

Flow: \`/spec\` → \`/research\` → \`/plan\` → \`/build\` → \`/check\` → \`/ship\`

All spec and plan artifacts are saved to the \`docs/\` directory.

${commandDocs}

---
*Generated by aicgen*
`;
  }

  private formatAntigravityWorkflow(cmd: WorkflowCommand): string {
    return `---
description: ${cmd.description}
---

${cmd.content}
`;
  }
}
```

### Step 4: Run the tests to confirm they pass

```bash
cd /mnt/f/aicgen/aicgen
npx jest src/services/__tests__/workflow-injector.test.ts --no-coverage
```

Expected: All tests pass.

### Step 5: Run the full suite to confirm no regressions

```bash
cd /mnt/f/aicgen/aicgen
npx jest --no-coverage
```

Expected: All existing tests continue to pass.

### Step 6: Commit

```bash
cd /mnt/f/aicgen/aicgen
git add src/services/workflow-injector.ts src/services/__tests__/workflow-injector.test.ts
git commit -m "feat(services): add WorkflowInjector service with unit tests"
```

---

## Task 3: Extend `GeneratedFile` type and update `AssistantFileWriter`

**Files:**
- Modify: `src/services/assistant-file-writer.ts`
- Create: `src/services/__tests__/assistant-file-writer-workflows.test.ts`

### Step 1: Add `'workflow'` to the `GeneratedFile` type

In `src/services/assistant-file-writer.ts`, find line 12:

```typescript
type: 'main' | 'guideline' | 'config' | 'agent' | 'universal';
```

Change to:

```typescript
type: 'main' | 'guideline' | 'config' | 'agent' | 'universal' | 'workflow';
```

### Step 2: Write the failing integration test

Create `src/services/__tests__/assistant-file-writer-workflows.test.ts`:

```typescript
import { AssistantFileWriter } from '../assistant-file-writer.js';
import { WorkflowInjector } from '../workflow-injector.js';

const SAMPLE_SDLC_CONTENT = `# SDLC Workflows

## /spec [name]
Capture the full specification for a feature or task.

**Steps:**
1. Ask for a feature name

---

## /research
Analyze the active spec.

**Steps:**
1. Read the spec

---

## /plan
Produce a phased implementation plan.

**Steps:**
1. Read the spec

---

## /build [phase]
Execute the next phase.

**Steps:**
1. Read the plan

---

## /check
Verify implementation.

**Steps:**
1. Run tests

---

## /ship
Pre-flight wrap-up.

**Steps:**
1. Run tests
`;

const MOCK_SELECTION = {
  assistant: 'claude-code' as const,
  language: 'typescript' as const,
  level: 'standard' as const,
  architecture: 'layered' as const,
  projectType: 'backend' as const,
  projectName: 'test-project',
  datasource: 'none' as const,
};

describe('AssistantFileWriter — workflow injection', () => {
  let writer: AssistantFileWriter;
  let workflowInjector: WorkflowInjector;

  beforeEach(async () => {
    workflowInjector = WorkflowInjector.fromContent(SAMPLE_SDLC_CONTENT);
    writer = await AssistantFileWriter.create(workflowInjector);
  });

  describe('claude-code', () => {
    it('should include 6 workflow files in generated output', async () => {
      const files = await writer.generateFiles('claude-code', [], MOCK_SELECTION, '/tmp/test');
      const workflowFiles = files.filter(f => f.type === 'workflow');
      expect(workflowFiles).toHaveLength(6);
    });

    it('should generate workflow files at .claude/commands/ paths', async () => {
      const files = await writer.generateFiles('claude-code', [], MOCK_SELECTION, '/tmp/test');
      const workflowFiles = files.filter(f => f.type === 'workflow');
      expect(workflowFiles.some(f => f.path.endsWith('.claude/commands/spec.md'))).toBe(true);
      expect(workflowFiles.some(f => f.path.endsWith('.claude/commands/ship.md'))).toBe(true);
    });

    it('should include Workflows section in CLAUDE.md', async () => {
      const files = await writer.generateFiles('claude-code', [], MOCK_SELECTION, '/tmp/test');
      const claudeMd = files.find(f => f.path.endsWith('CLAUDE.md'));
      expect(claudeMd?.content).toContain('## Workflows');
      expect(claudeMd?.content).toContain('/spec');
    });
  });

  describe('copilot', () => {
    it('should include 1 workflow file in generated output', async () => {
      const files = await writer.generateFiles('copilot', [], { ...MOCK_SELECTION, assistant: 'copilot' }, '/tmp/test');
      const workflowFiles = files.filter(f => f.type === 'workflow');
      expect(workflowFiles).toHaveLength(1);
    });

    it('should generate workflow file at .github/instructions/workflows.instructions.md', async () => {
      const files = await writer.generateFiles('copilot', [], { ...MOCK_SELECTION, assistant: 'copilot' }, '/tmp/test');
      const workflowFile = files.find(f => f.type === 'workflow');
      expect(workflowFile?.path).toContain('workflows.instructions.md');
    });
  });

  describe('gemini', () => {
    it('should include SDLC Workflows section in .gemini/instructions.md', async () => {
      const files = await writer.generateFiles('gemini', [], { ...MOCK_SELECTION, assistant: 'gemini' }, '/tmp/test');
      const geminiFile = files.find(f => f.path.endsWith('instructions.md'));
      expect(geminiFile?.content).toContain('## SDLC Workflows');
    });
  });

  describe('antigravity', () => {
    it('should include 6 workflow files at .agent/workflows/', async () => {
      const files = await writer.generateFiles('antigravity', [], { ...MOCK_SELECTION, assistant: 'antigravity' }, '/tmp/test');
      const workflowFiles = files.filter(f => f.type === 'workflow');
      expect(workflowFiles).toHaveLength(6);
      expect(workflowFiles[0].path).toContain('.agent/workflows/spec.md');
    });
  });

  describe('AGENTS.md', () => {
    it('should include Workflows section in AGENTS.md', async () => {
      const files = await writer.generateFiles('claude-code', [], MOCK_SELECTION, '/tmp/test');
      const agentsMd = files.find(f => f.path.endsWith('AGENTS.md'));
      expect(agentsMd?.content).toContain('Workflows');
      expect(agentsMd?.content).toContain('/spec');
    });
  });
});
```

### Step 3: Run the tests to confirm they fail

```bash
cd /mnt/f/aicgen/aicgen
npx jest src/services/__tests__/assistant-file-writer-workflows.test.ts --no-coverage
```

Expected: Tests fail — `AssistantFileWriter.create()` does not accept `workflowInjector` argument yet.

### Step 4: Modify `AssistantFileWriter`

In `src/services/assistant-file-writer.ts`, make these changes:

**4a — Import WorkflowInjector** (add after existing imports):

```typescript
import { WorkflowInjector } from './workflow-injector.js';
```

**4b — Add `workflowInjector` field** (add to the class, after existing fields):

```typescript
private workflowInjector: WorkflowInjector;
```

**4c — Update the static `create()` factory** (replace existing):

```typescript
static async create(workflowInjector?: WorkflowInjector): Promise<AssistantFileWriter> {
  const guidelineLoader = await GuidelineLoader.create();
  const injector = workflowInjector ?? await WorkflowInjector.create();
  return new AssistantFileWriter(guidelineLoader, injector);
}
```

**4d — Update the private constructor** (replace existing):

```typescript
private constructor(guidelineLoader: GuidelineLoader, workflowInjector: WorkflowInjector) {
  this.guidelineLoader = guidelineLoader;
  this.hookGenerator = new HookGenerator();
  this.subAgentGenerator = new SubAgentGenerator();
  this.workflowInjector = workflowInjector;
}
```

**4e — Inject workflow files in `generateFiles()`** (add after the `switch` block, before `files.push(this.generateUniversalAgentsFile(...))`):

```typescript
// Always inject SDLC workflow files — unconditional
const workflowFiles = this.workflowInjector.generateWorkflowFiles(assistant);
files.push(...workflowFiles);
```

**4f — Add `## Workflows` section to CLAUDE.md** (in `generateClaudeCodeFiles()`, update `mainContent`):

Find the block that builds `mainContent` and add before `## Important Notes`:

```typescript
const workflowsSection = `## Workflows

Use these slash commands for structured SDLC delivery:

- \`/spec [name]\` — Capture feature requirements into \`docs/specs/\`
- \`/research\` — Scan codebase + web research; ask for infra preference
- \`/plan\` — Produce phased implementation plan into \`docs/plans/\`
- \`/build [phase]\` — Execute plan phase by phase with checkpoints
- \`/check\` — Verify implementation against spec; run tests
- \`/ship\` — Pre-flight wrap-up; draft PR description

`;
```

Then include `workflowsSection` in `mainContent` before `## Important Notes`.

**4g — Inject workflow section into Gemini and Codex files**

In `generateGeminiFiles()`, append `this.workflowInjector.buildWorkflowSection()` to the `content` string before the final `---\n*Generated by aicgen*` line.

In `generateCodexFiles()`, do the same.

**4h — Add Workflows section to AGENTS.md**

In `generateUniversalAgentsFile()`, add the following before the closing `---\n*Generated by aicgen*`:

```typescript
const workflowsSection = `## Workflows

This project uses the aicgen SDLC workflow. Use these slash commands in order:

\`/spec\` → \`/research\` → \`/plan\` → \`/build\` → \`/check\` → \`/ship\`

- \`/spec [name]\` — Capture feature requirements
- \`/research\` — Codebase scan + web research + infra preference
- \`/plan\` — Phased implementation plan
- \`/build [phase]\` — Execute plan phase by phase
- \`/check\` — Verify against spec, run tests
- \`/ship\` — Pre-flight and PR draft

`;
```

Include `workflowsSection` in `content` before the footer.

### Step 5: Run the integration tests to confirm they pass

```bash
cd /mnt/f/aicgen/aicgen
npx jest src/services/__tests__/assistant-file-writer-workflows.test.ts --no-coverage
```

Expected: All tests pass.

### Step 6: Run the full test suite to confirm no regressions

```bash
cd /mnt/f/aicgen/aicgen
npx jest --no-coverage
```

Expected: All tests pass.

### Step 7: Commit

```bash
cd /mnt/f/aicgen/aicgen
git add src/services/assistant-file-writer.ts src/services/__tests__/assistant-file-writer-workflows.test.ts
git commit -m "feat(services): inject SDLC workflow commands into all assistant configs"
```

---

## Task 4: Create `aicgen-docs/workflows/` documentation

**Files:**
- Create: `aicgen-docs/workflows/README.md`
- Create: `aicgen-docs/workflows/sdlc/spec.md`
- Create: `aicgen-docs/workflows/sdlc/research.md`
- Create: `aicgen-docs/workflows/sdlc/plan.md`
- Create: `aicgen-docs/workflows/sdlc/build.md`
- Create: `aicgen-docs/workflows/sdlc/check.md`
- Create: `aicgen-docs/workflows/sdlc/ship.md`

### Step 1: Create `aicgen-docs/workflows/README.md`

```markdown
# SDLC Workflows

aicgen injects a structured 6-command SDLC workflow into every generated assistant configuration. These commands guide the AI assistant through a repeatable, artifact-driven development lifecycle.

## The Flow

```
/spec → /research → /plan → /build → /check → /ship
```

| Step | Command | Output |
|---|---|---|
| 1 | `/spec [name]` | `docs/specs/{name}.md` |
| 2 | `/research` | Appends findings to spec |
| 3 | `/plan` | `docs/plans/{name}.md` |
| 4 | `/build [phase?]` | Code changes |
| 5 | `/check` | Inline verification report |
| 6 | `/ship` | PR description draft |

## Commands

- [/spec](sdlc/spec.md) — Capture requirements
- [/research](sdlc/research.md) — Codebase + web research
- [/plan](sdlc/plan.md) — Implementation plan
- [/build](sdlc/build.md) — Phase-by-phase execution
- [/check](sdlc/check.md) — Verification
- [/ship](sdlc/ship.md) — Pre-flight and PR

## Source

The command definitions are maintained in `aicgen/data/workflows/sdlc.md` in the [aicgen repository](https://github.com/aicgen/aicgen).
```

### Step 2: Create the 6 command reference docs

Create `aicgen-docs/workflows/sdlc/spec.md`:

```markdown
# /spec [name]

**Purpose:** Capture the full specification for a feature or task before any code is written.

## When to use
Run this at the very start of any non-trivial feature or task. It ensures the AI assistant and the developer share a common understanding of what is being built before any planning or implementation begins.

## Arguments
- `name` — The feature name (used as the filename). If omitted, the assistant will ask.

## Output
Creates `docs/specs/{name}.md` with goal, user stories, acceptance criteria, constraints, and out-of-scope items.

## Tips
- Be specific in your acceptance criteria — vague criteria lead to vague implementations
- Out-of-scope is as important as in-scope
- After running `/spec`, always run `/research` before `/plan`

## Next step
Run `/research` to analyze the spec against the codebase and find reference solutions.
```

Create `aicgen-docs/workflows/sdlc/research.md`:

```markdown
# /research

**Purpose:** Analyze the active spec with internal codebase scanning and external web research, and prompt for infrastructure preference.

## When to use
After `/spec`, before `/plan`. This step surfaces codebase patterns, risks, and reference architectures that should inform the implementation plan.

## Pre-condition
An active spec must exist in `docs/specs/`. If none is found, the assistant will prompt you to run `/spec` first.

## Infrastructure preference
During research, the assistant will ask whether this feature requires infrastructure decisions:
- **Cost-optimised / serverless** — Cloud Run, Cloud Functions, AWS Lambda, Fargate, etc.
- **Fixed / dedicated** — Kubernetes, EC2, GKE, dedicated VMs, etc.
- **No infrastructure involved**

This shapes the web research results toward the appropriate cost model and deployment pattern.

## Output
Appends a `## Research Findings` section to the active spec file containing internal findings, web research summary, infrastructure recommendation, and suggested spec improvements.

## Next step
Run `/plan` to turn the spec and research findings into a phased implementation plan.
```

Create `aicgen-docs/workflows/sdlc/plan.md`:

```markdown
# /plan

**Purpose:** Produce a phased, checkpoint-driven implementation plan based on the spec and research findings.

## When to use
After `/research`. This step breaks the work into independently verifiable phases that `/build` will execute one at a time.

## Pre-condition
An active spec with `## Research Findings` must exist. If research has not been run, the assistant will warn you and ask you to confirm before proceeding.

## Output
Creates `docs/plans/{spec-name}.md` with a phase-by-phase breakdown including files to touch, decisions to make, and verification steps.

## Next step
Run `/build` to execute the first phase of the plan.
```

Create `aicgen-docs/workflows/sdlc/build.md`:

```markdown
# /build [phase]

**Purpose:** Execute the next (or a specified) phase of the current implementation plan, pausing between phases for review.

## When to use
After `/plan`. Run repeatedly — once per phase — until all phases are complete.

## Arguments
- `phase` — Optional. The phase number to execute. If omitted, executes the next incomplete phase.

## Pre-condition
An active plan must exist in `docs/plans/`. If none is found, the assistant will prompt you to run `/plan` first.

## Behaviour
- Announces which phase it is executing and what it covers
- Follows existing codebase patterns and conventions
- Marks the phase as complete in the plan file after finishing
- Runs relevant tests and reports results
- Pauses and asks "Continue to phase N+1?" before proceeding

## Next step
After all phases are complete, run `/check` to verify the full implementation.
```

Create `aicgen-docs/workflows/sdlc/check.md`:

```markdown
# /check

**Purpose:** Verify the current implementation against the active spec — tests, code review, and regression check.

## When to use
After `/build` phases are complete, or at any point during development to check progress. Can be run repeatedly.

## Output
A structured inline report:
- ✅ Acceptance criteria met
- ❌ Acceptance criteria not met (with details)
- ⚠️ Potential regressions (with details)
- 📋 Suggested fixes

## Next step
If all criteria are met and no regressions are found, run `/ship`.
```

Create `aicgen-docs/workflows/sdlc/ship.md`:

```markdown
# /ship

**Purpose:** Pre-flight wrap-up — verify everything is ready, then draft a PR description referencing the spec and plan.

## When to use
After `/check` reports all acceptance criteria met and no regressions.

## Steps performed
1. Runs the full test suite — stops if any tests fail
2. Verifies spec and plan docs are up to date
3. Lists uncommitted changes
4. Drafts a PR description with links to `docs/specs/` and `docs/plans/`
5. Asks for confirmation before committing and pushing

## Output
A complete PR description ready to paste or submit directly.
```

### Step 3: Commit

```bash
cd /mnt/f/aicgen/aicgen-docs
git add workflows/
git commit -m "docs: add SDLC workflow slash command reference documentation"
```

---

## Verification

After all tasks are complete, run the full test suite one final time:

```bash
cd /mnt/f/aicgen/aicgen
npx jest --no-coverage
```

Expected: All tests pass, no regressions.

Manual smoke test — generate a Claude Code config and verify workflow files are created:

```bash
cd /tmp && mkdir smoke-test && cd smoke-test
node /mnt/f/aicgen/aicgen/dist/index.js init --force
ls .claude/commands/
# Expected: spec.md  research.md  plan.md  build.md  check.md  ship.md
grep "Workflows" CLAUDE.md
# Expected: ## Workflows section with 6 command descriptions
```
