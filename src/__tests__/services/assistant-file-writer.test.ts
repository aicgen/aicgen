import { describe, test, expect, beforeAll } from 'bun:test';
import { AssistantFileWriter } from '../../services/assistant-file-writer.js';
import { GuidelineLoader } from '../../services/guideline-loader.js';
import type { ProfileSelection } from '../../models/profile.js';

describe('AssistantFileWriter', () => {
  let writer: AssistantFileWriter;
  let loader: GuidelineLoader;
  const testSelection: ProfileSelection = {
    assistant: 'claude-code',
    language: 'typescript',
    level: 'standard',
    architecture: 'microservices',
    projectType: 'api',
    projectName: 'test-project',
    datasource: 'sql'
  };

  beforeAll(async () => {
    writer = await AssistantFileWriter.create();
    loader = await GuidelineLoader.create();
  });

  describe('Claude Code Files', () => {
    test('should generate files for Claude Code', async () => {
      const guidelineIds = loader.getGuidelinesForProfile(
        testSelection.language,
        testSelection.level,
        testSelection.architecture,
        testSelection.datasource
      );

      const files = await writer.generateFiles(
        'claude-code',
        guidelineIds,
        testSelection,
        '/test/path'
      );

      expect(files.length).toBeGreaterThan(0);
      expect(files.some(f => f.path.endsWith('CLAUDE.md'))).toBe(true);
      expect(files.some(f => f.path.includes('.claude') && f.path.includes('guidelines'))).toBe(true);
      expect(files.some(f => f.path.endsWith('settings.json'))).toBe(true);
    });

    test('should create separate guideline files by category', async () => {
      const guidelineIds = loader.getGuidelinesForProfile(
        testSelection.language,
        testSelection.level,
        testSelection.architecture,
        testSelection.datasource
      );

      const files = await writer.generateFiles(
        'claude-code',
        guidelineIds,
        testSelection,
        '/test/path'
      );

      const guidelineFiles = files.filter(f => f.type === 'guideline');
      expect(guidelineFiles.length).toBeGreaterThan(0);

      // Should have files like language.md, architecture.md, etc.
      expect(guidelineFiles.some(f => f.path.includes('language.md'))).toBe(true);
    });

    test('should create CLAUDE.md with references not content', async () => {
      const guidelineIds = loader.getGuidelinesForProfile(
        testSelection.language,
        testSelection.level,
        testSelection.architecture,
        testSelection.datasource
      );

      const files = await writer.generateFiles(
        'claude-code',
        guidelineIds,
        testSelection,
        '/test/path'
      );

      const claudeFile = files.find(f => f.path.includes('CLAUDE.md'));
      expect(claudeFile).toBeDefined();
      expect(claudeFile!.content).toContain('@.claude/guidelines/');
      expect(claudeFile!.content).toContain('## Guidelines');
    });

    test('should concatenate guidelines within each category file', async () => {
      const guidelineIds = loader.getGuidelinesForProfile(
        testSelection.language,
        'full', // Use full to get more guidelines
        testSelection.architecture,
        testSelection.datasource
      );

      const files = await writer.generateFiles(
        'claude-code',
        guidelineIds,
        { ...testSelection, level: 'full' },
        '/test/path'
      );

      const languageFile = files.find(f => f.path.includes('language.md'));
      expect(languageFile).toBeDefined();
      expect(languageFile!.content).toContain('---'); // Separator between guidelines
    });
  });

  describe('Copilot Files', () => {
    test('should generate files for GitHub Copilot', async () => {
      const guidelineIds = loader.getGuidelinesForProfile(
        testSelection.language,
        testSelection.level,
        testSelection.architecture,
        testSelection.datasource
      );

      const files = await writer.generateFiles(
        'copilot',
        guidelineIds,
        { ...testSelection, assistant: 'copilot' },
        '/test/path'
      );

      expect(files.length).toBeGreaterThan(0);
      expect(files.some(f => f.path.includes('copilot-instructions.md'))).toBe(true);
      expect(files.some(f => f.path.includes('.github') && f.path.includes('instructions'))).toBe(true);
    });

    test('should create instruction files with frontmatter', async () => {
      const guidelineIds = loader.getGuidelinesForProfile(
        testSelection.language,
        testSelection.level,
        testSelection.architecture,
        testSelection.datasource
      );

      const files = await writer.generateFiles(
        'copilot',
        guidelineIds,
        { ...testSelection, assistant: 'copilot' },
        '/test/path'
      );

      const instructionFile = files.find(f =>
        f.path.includes('.github') && f.path.includes('instructions') && f.path.endsWith('.instructions.md')
      );
      expect(instructionFile).toBeDefined();
      expect(instructionFile!.content).toContain('---\napplyTo:');
      expect(instructionFile!.content).toContain('description:');
    });
  });

  describe('Gemini Files', () => {
    test('should generate single instructions file for Gemini', async () => {
      const guidelineIds = loader.getGuidelinesForProfile(
        testSelection.language,
        testSelection.level,
        testSelection.architecture,
        testSelection.datasource
      );

      const files = await writer.generateFiles(
        'gemini',
        guidelineIds,
        { ...testSelection, assistant: 'gemini' },
        '/test/path'
      );

      expect(files.length).toBe(2); // instructions.md + AGENTS.md
      expect(files.some(f => f.path.includes('.gemini') && f.path.includes('instructions.md'))).toBe(true);
    });

    test('should inline all guidelines in Gemini file', async () => {
      const guidelineIds = loader.getGuidelinesForProfile(
        testSelection.language,
        testSelection.level,
        testSelection.architecture,
        testSelection.datasource
      );

      const files = await writer.generateFiles(
        'gemini',
        guidelineIds,
        { ...testSelection, assistant: 'gemini' },
        '/test/path'
      );

      const geminiFile = files.find(f => f.path.includes('.gemini') && f.path.includes('instructions.md'));
      expect(geminiFile).toBeDefined();
      expect(geminiFile!.content).toContain('## Language');
      expect(geminiFile!.content).toContain('---'); // Category separators
    });
  });

  describe('Antigravity Files', () => {
    test('should generate files for Antigravity', async () => {
      const guidelineIds = loader.getGuidelinesForProfile(
        testSelection.language,
        testSelection.level,
        testSelection.architecture,
        testSelection.datasource
      );

      const files = await writer.generateFiles(
        'antigravity',
        guidelineIds,
        { ...testSelection, assistant: 'antigravity' },
        '/test/path'
      );

      expect(files.length).toBeGreaterThan(0);
      expect(files.some(f => f.path.includes('.agent') && f.path.includes('rules') && f.path.includes('instructions.md'))).toBe(true);
      expect(files.some(f => f.path.includes('.agent') && f.path.includes('rules') && !f.path.includes('instructions.md'))).toBe(true);
      expect(files.some(f => f.path.includes('.agent') && f.path.includes('workflows'))).toBe(true);
    });

    test('should create workflow files based on level', async () => {
      const guidelineIds = loader.getGuidelinesForProfile(
        testSelection.language,
        'expert',
        testSelection.architecture,
        testSelection.datasource
      );

      const files = await writer.generateFiles(
        'antigravity',
        guidelineIds,
        { ...testSelection, assistant: 'antigravity', level: 'expert' },
        '/test/path'
      );

      const workflowFiles = files.filter(f => f.path.includes('.agent') && f.path.includes('workflows'));
      expect(workflowFiles.length).toBeGreaterThan(2); // Expert should have more workflows
    });

    test('should create rule index with references', async () => {
      const guidelineIds = loader.getGuidelinesForProfile(
        testSelection.language,
        testSelection.level,
        testSelection.architecture,
        testSelection.datasource
      );

      const files = await writer.generateFiles(
        'antigravity',
        guidelineIds,
        { ...testSelection, assistant: 'antigravity' },
        '/test/path'
      );

      const instructionsFile = files.find(f => f.path.includes('.agent') && f.path.includes('rules') && f.path.includes('instructions.md'));
      expect(instructionsFile).toBeDefined();
      expect(instructionsFile!.content).toContain('## Rule Index');
      expect(instructionsFile!.content).toContain('@.agent/rules/');
    });
  });

  describe('Codex Files', () => {
    test('should generate single instructions file for Codex', async () => {
      const guidelineIds = loader.getGuidelinesForProfile(
        testSelection.language,
        testSelection.level,
        testSelection.architecture,
        testSelection.datasource
      );

      const files = await writer.generateFiles(
        'codex',
        guidelineIds,
        { ...testSelection, assistant: 'codex' },
        '/test/path'
      );

      expect(files.length).toBe(2); // instructions.md + AGENTS.md
      expect(files.some(f => f.path.includes('.codex') && f.path.includes('instructions.md'))).toBe(true);
    });
  });

  describe('Universal AGENTS.md', () => {
    test('should generate AGENTS.md for all assistants', async () => {
      const guidelineIds = loader.getGuidelinesForProfile(
        testSelection.language,
        testSelection.level,
        testSelection.architecture,
        testSelection.datasource
      );

      const assistants: Array<'claude-code' | 'copilot' | 'gemini' | 'antigravity' | 'codex'> = [
        'claude-code',
        'copilot',
        'gemini',
        'antigravity',
        'codex'
      ];

      for (const assistant of assistants) {
        const files = await writer.generateFiles(
          assistant,
          guidelineIds,
          { ...testSelection, assistant },
          '/test/path'
        );

        const agentsFile = files.find(f => f.path.includes('AGENTS.md'));
        expect(agentsFile).toBeDefined();
        expect(agentsFile!.type).toBe('universal');
        expect(agentsFile!.content).toContain('## Project Overview');
      }
    });
  });

  describe('File Paths', () => {
    test('should prepend project path to all file paths', async () => {
      const guidelineIds = loader.getGuidelinesForProfile(
        testSelection.language,
        testSelection.level,
        testSelection.architecture,
        testSelection.datasource
      );

      const files = await writer.generateFiles(
        'claude-code',
        guidelineIds,
        testSelection,
        '/custom/project/path'
      );

      files.forEach(file => {
        // On Windows, paths will be normalized to use backslashes
        expect(file.path.includes('custom') && file.path.includes('project')).toBe(true);
      });
    });
  });

  describe('Content Validation', () => {
    test('all generated files should have non-empty content', async () => {
      const guidelineIds = loader.getGuidelinesForProfile(
        testSelection.language,
        testSelection.level,
        testSelection.architecture,
        testSelection.datasource
      );

      const files = await writer.generateFiles(
        'claude-code',
        guidelineIds,
        testSelection,
        '/test/path'
      );

      files.forEach(file => {
        expect(file.content.length).toBeGreaterThan(0);
        expect(file.path.length).toBeGreaterThan(0);
      });
    });

    test('should include project name in main files', async () => {
      const guidelineIds = loader.getGuidelinesForProfile(
        testSelection.language,
        testSelection.level,
        testSelection.architecture,
        testSelection.datasource
      );

      const files = await writer.generateFiles(
        'claude-code',
        guidelineIds,
        testSelection,
        '/test/path'
      );

      const claudeFile = files.find(f => f.type === 'main');
      expect(claudeFile).toBeDefined();
      expect(claudeFile!.content).toContain(testSelection.projectName);
    });

    test('should include language and architecture in main files', async () => {
      const guidelineIds = loader.getGuidelinesForProfile(
        testSelection.language,
        testSelection.level,
        testSelection.architecture,
        testSelection.datasource
      );

      const files = await writer.generateFiles(
        'claude-code',
        guidelineIds,
        testSelection,
        '/test/path'
      );

      const claudeFile = files.find(f => f.type === 'main');
      expect(claudeFile).toBeDefined();
      expect(claudeFile!.content).toContain(testSelection.language);
      expect(claudeFile!.content).toContain(testSelection.architecture);
    });
  });
});
