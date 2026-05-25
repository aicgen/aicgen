import { AssistantFileWriter } from '../assistant-file-writer.js';
import { WorkflowInjector } from '../workflow-injector.js';

// Mock modules that transitively import config.ts (which uses import.meta.url,
// incompatible with Jest's CJS transform mode).
jest.mock('../guideline-loader', () => ({
  GuidelineLoader: {
    create: jest.fn().mockResolvedValue({
      getMapping: jest.fn().mockReturnValue(undefined),
      loadGuideline: jest.fn().mockReturnValue(''),
    }),
  },
}));

jest.mock('../subagent-generator', () => ({
  SubAgentGenerator: jest.fn().mockImplementation(() => ({
    generateSubAgents: jest.fn().mockResolvedValue([]),
    generateSkills: jest.fn().mockResolvedValue([]),
  })),
}));

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
    it('should include workflow instructions and prompt files in generated output', async () => {
      const files = await writer.generateFiles('copilot', [], { ...MOCK_SELECTION, assistant: 'copilot' }, '/tmp/test');
      const workflowFiles = files.filter(f => f.type === 'workflow');
      expect(workflowFiles).toHaveLength(7);
    });

    it('should generate workflow file at .github/instructions/workflows.instructions.md', async () => {
      const files = await writer.generateFiles('copilot', [], { ...MOCK_SELECTION, assistant: 'copilot' }, '/tmp/test');
      const workflowFile = files.find(f => f.type === 'workflow');
      expect(workflowFile?.path).toContain('workflows.instructions.md');
    });

    it('should generate reusable prompt files for each SDLC command', async () => {
      const files = await writer.generateFiles('copilot', [], { ...MOCK_SELECTION, assistant: 'copilot' }, '/tmp/test');

      expect(files.some(f => f.path.endsWith('.github/prompts/spec.prompt.md'))).toBe(true);
      expect(files.some(f => f.path.endsWith('.github/prompts/ship.prompt.md'))).toBe(true);
    });
  });

  describe('codex', () => {
    it('should include project-local plugin files with 6 namespaced skills', async () => {
      const files = await writer.generateFiles('codex', [], { ...MOCK_SELECTION, assistant: 'codex' }, '/tmp/test');
      const pluginFiles = files.filter(f => f.type === 'plugin');
      const skillFiles = pluginFiles.filter(f => f.path.includes('/skills/'));

      expect(pluginFiles.some(f => f.path.endsWith('plugins/aicgen-sdlc/.codex-plugin/plugin.json'))).toBe(true);
      expect(skillFiles).toHaveLength(6);
      expect(skillFiles.some(f => f.path.endsWith('plugins/aicgen-sdlc/skills/aicgen-plan/SKILL.md'))).toBe(true);
    });

    it('should include installed-by-default marketplace entry', async () => {
      const files = await writer.generateFiles('codex', [], { ...MOCK_SELECTION, assistant: 'codex' }, '/tmp/test');
      const marketplaceFile = files.find(f => f.path.endsWith('.agents/plugins/marketplace.json'));
      const marketplace = JSON.parse(marketplaceFile!.content);

      expect(marketplace.plugins[0].name).toBe('aicgen-sdlc');
      expect(marketplace.plugins[0].policy.installation).toBe('INSTALLED_BY_DEFAULT');
    });

    it('should list namespaced workflow commands in Codex instructions and AGENTS.md', async () => {
      const files = await writer.generateFiles('codex', [], { ...MOCK_SELECTION, assistant: 'codex' }, '/tmp/test');
      const codexFile = files.find(f => f.path.endsWith('.codex/instructions.md'));
      const agentsMd = files.find(f => f.path.endsWith('AGENTS.md'));

      expect(codexFile?.content).toContain('/aicgen-spec');
      expect(codexFile?.content).toContain('/aicgen-plan');
      expect(agentsMd?.content).toContain('/aicgen-spec');
      expect(agentsMd?.content).toContain('aicgen-sdlc');
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

  describe('profile gating', () => {
    it('should keep basic profiles instruction-only for workflow surfaces', async () => {
      const files = await writer.generateFiles(
        'claude-code',
        [],
        { ...MOCK_SELECTION, level: 'basic' },
        '/tmp/test'
      );

      expect(files.filter(f => f.type === 'workflow')).toHaveLength(0);
      expect(files.filter(f => f.type === 'agent')).toHaveLength(0);
      expect(files.filter(f => f.type === 'skill')).toHaveLength(0);
    });

    it('should generate Codex hooks only for expert profiles and above', async () => {
      const standardFiles = await writer.generateFiles(
        'codex',
        [],
        { ...MOCK_SELECTION, assistant: 'codex', level: 'standard' },
        '/tmp/test'
      );
      const expertFiles = await writer.generateFiles(
        'codex',
        [],
        { ...MOCK_SELECTION, assistant: 'codex', level: 'expert' },
        '/tmp/test'
      );

      expect(standardFiles.some(f => f.path.endsWith('.codex/hooks.json'))).toBe(false);
      expect(expertFiles.some(f => f.path.endsWith('.codex/hooks.json'))).toBe(true);
      expect(expertFiles.some(f => f.path.endsWith('.codex/hooks/aicgen_session_start.py'))).toBe(true);
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
