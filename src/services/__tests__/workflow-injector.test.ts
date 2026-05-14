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
