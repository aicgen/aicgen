import { WorkflowInjector } from '../workflow-injector.js';
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

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
    it('should return one skill per command instead of prompt files or an always-on instruction file', () => {
      const files = injector.generateWorkflowFiles('copilot');
      expect(files.map(f => f.path)).toEqual([
        '.github/skills/aicgen-spec/SKILL.md',
        '.github/skills/aicgen-research/SKILL.md',
        '.github/skills/aicgen-plan/SKILL.md',
        '.github/skills/aicgen-build/SKILL.md',
        '.github/skills/aicgen-check/SKILL.md',
        '.github/skills/aicgen-ship/SKILL.md',
      ]);
    });

    it('should write valid, user-invoked skill frontmatter whose name matches the folder', () => {
      for (const file of injector.generateWorkflowFiles('copilot')) {
        const folder = file.path.split('/')[2];
        expect(file.content).toMatch(new RegExp(`^---\\nname: ${folder}\\ndescription: ".+"\\ndisable-model-invocation: true\\n---\\n`));
        expect(file.type).toBe('workflow');
      }
    });
  });

  describe('generateWorkflowFiles - codex', () => {
    it('should return empty array for codex (inline injection)', () => {
      const files = injector.generateWorkflowFiles('codex');
      expect(files).toHaveLength(0);
    });
  });

  describe('create', () => {
    it('should load workflow content from user data before official cache and embedded fallback', async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'aicgen-workflows-'));
      const userDataPath = join(tempDir, 'user-data');
      const officialCachePath = join(tempDir, 'official-cache');
      const userWorkflowPath = join(userDataPath, 'guidelines', 'workflows');
      const officialWorkflowPath = join(officialCachePath, 'guidelines', 'workflows');

      try {
        await mkdir(userWorkflowPath, { recursive: true });
        await mkdir(officialWorkflowPath, { recursive: true });
        await writeFile(join(userWorkflowPath, 'sdlc.md'), SAMPLE_SDLC_CONTENT.replace('Capture the full specification', 'User data specification'), 'utf-8');
        await writeFile(join(officialWorkflowPath, 'sdlc.md'), SAMPLE_SDLC_CONTENT.replace('Capture the full specification', 'Official cache specification'), 'utf-8');

        const sourcedInjector = await WorkflowInjector.create({
          userDataPath,
          officialCachePath,
          embeddedContent: SAMPLE_SDLC_CONTENT.replace('Capture the full specification', 'Embedded specification'),
        });

        expect(sourcedInjector.getCommands()[0].description).toBe('User data specification for a feature or task.');
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('generateWorkflowFiles - antigravity', () => {
    it('should return 6 files for antigravity', () => {
      const files = injector.generateWorkflowFiles('antigravity');
      expect(files).toHaveLength(6);
    });

    it('should place workflow skills at .agents/skills/aicgen-{name}/SKILL.md', () => {
      const files = injector.generateWorkflowFiles('antigravity');
      expect(files[0].path).toBe('.agents/skills/aicgen-spec/SKILL.md');
      expect(files[5].path).toBe('.agents/skills/aicgen-ship/SKILL.md');
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

  describe('buildCodexWorkflowSection', () => {
    it('should return namespaced Codex workflow commands', () => {
      const section = injector.buildCodexWorkflowSection();
      expect(section).toContain('/aicgen-spec');
      expect(section).toContain('/aicgen-plan');
      expect(section).toContain('Legacy aicgen');
    });
  });

  describe('generateCopilotAgentFiles', () => {
    it('should return an AICGEN review custom agent with the required profile fields', () => {
      const files = injector.generateCopilotAgentFiles();

      expect(files).toHaveLength(1);
      expect(files[0].path).toBe('.github/agents/aicgen-review.agent.md');
      expect(files[0].content).toMatch(/^---\nname: aicgen-review\ndescription: ".+"\ntools: \["read", "search"\]\n---\n/);
      expect(files[0].content).toContain('AICGEN Review');
    });
  });
});
