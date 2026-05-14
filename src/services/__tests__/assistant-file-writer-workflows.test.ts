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
