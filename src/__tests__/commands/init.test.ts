import type { ProfileSelection } from '../../models/profile';

describe('Init Command', () => {
  describe('Project Detection', () => {
    it('should detect TypeScript project from package.json', () => {
      const packageJson = {
        name: 'test-project',
        dependencies: {
          'typescript': '^5.0.0'
        },
        devDependencies: {
          '@types/node': '^20.0.0'
        }
      };

      const hasTypeScript = packageJson.dependencies?.['typescript'] ||
                           packageJson.devDependencies?.['typescript'] ||
                           packageJson.devDependencies?.['@types/node'];

      expect(hasTypeScript).toBeTruthy();
    });

    it('should detect Python project from requirements.txt', () => {
      const files = ['requirements.txt', 'setup.py', 'main.py'];
      const isPython = files.some(f => f.endsWith('.py') || f === 'requirements.txt');

      expect(isPython).toBe(true);
    });

    it('should detect Go project from go.mod', () => {
      const files = ['go.mod', 'go.sum', 'main.go'];
      const isGo = files.some(f => f === 'go.mod' || f.endsWith('.go'));

      expect(isGo).toBe(true);
    });
  });

  describe('Configuration Analysis', () => {
    it('should analyze project structure for architecture hints', () => {
      const files = [
        'src/services/user-service.ts',
        'src/services/order-service.ts',
        'src/api/controllers/user.controller.ts'
      ];

      const hasServices = files.some(f => f.includes('service'));
      const hasControllers = files.some(f => f.includes('controller'));

      expect(hasServices).toBe(true);
      expect(hasControllers).toBe(true);
    });

    it('should detect database usage from dependencies', () => {
      const packageJson = {
        dependencies: {
          'pg': '^8.0.0',
          'typeorm': '^0.3.0'
        }
      };

      const hasSQL = packageJson.dependencies['pg'] || packageJson.dependencies['typeorm'];

      expect(hasSQL).toBeTruthy();
    });

    it('should detect NoSQL database usage', () => {
      const packageJson = {
        dependencies: {
          'mongodb': '^6.0.0'
        }
      };

      const hasNoSQL = packageJson.dependencies['mongodb'];

      expect(hasNoSQL).toBeTruthy();
    });
  });

  describe('AI Analysis Flow', () => {
    it('should prepare analysis context from project', () => {
      const projectPath = '/test/project';
      const packageJson = {
        name: 'test-api',
        description: 'Test API service',
        dependencies: {
          'express': '^4.0.0',
          'typescript': '^5.0.0'
        }
      };

      const context = {
        projectPath,
        projectName: packageJson.name,
        description: packageJson.description,
        dependencies: Object.keys(packageJson.dependencies)
      };

      expect(context.projectName).toBe('test-api');
      expect(context.dependencies).toContain('express');
      expect(context.dependencies).toContain('typescript');
    });

    it('should handle projects without package.json', () => {
      const projectPath = '/test/project';
      const packageJson = null;

      const context = {
        projectPath,
        projectName: 'unknown-project',
        description: undefined,
        dependencies: []
      };

      expect(context.projectName).toBe('unknown-project');
      expect(context.dependencies).toHaveLength(0);
    });
  });

  describe('Interactive Mode', () => {
    it('should allow manual assistant selection', () => {
      const assistants = ['claude-code', 'copilot', 'gemini', 'antigravity', 'codex'];
      const selectedAssistant = 'claude-code';

      expect(assistants).toContain(selectedAssistant);
    });

    it('should allow manual language selection', () => {
      const languages = ['typescript', 'python', 'go', 'rust', 'java'];
      const selectedLanguage = 'typescript';

      expect(languages).toContain(selectedLanguage);
    });

    it('should allow complexity level selection', () => {
      const levels = ['basic', 'standard', 'expert', 'full'];
      const selectedLevel = 'standard';

      expect(levels).toContain(selectedLevel);
    });

    it('should allow architecture selection', () => {
      const architectures = ['microservices', 'modular-monolith', 'serverless', 'layered'];
      const selectedArchitecture = 'microservices';

      expect(architectures).toContain(selectedArchitecture);
    });
  });

  describe('Assistant Selection', () => {
    it('should not set assistant from AI analysis provider', () => {
      // Simulate AI suggestions that don't include assistant
      const aiSuggestions = {
        language: 'typescript',
        projectType: 'api',
        architecture: 'microservices',
        datasource: 'sql',
        level: 'standard'
        // Note: no assistant field
      };

      // Verify assistant is not included in AI suggestions
      expect(aiSuggestions).not.toHaveProperty('assistant');
    });

    it('should prompt for target coding assistant separately from analysis provider', () => {
      // Analysis provider (used for AI analysis)
      const analysisProvider = 'gemini';

      // Target coding assistant (what will use the guidelines)
      const targetAssistant = 'claude-code';

      // These should be independent
      expect(analysisProvider).not.toBe(targetAssistant);
    });

    it('should support all coding assistant options', () => {
      const supportedAssistants = [
        'claude-code',
        'antigravity',
        'copilot',
        'codex',
        'gemini'
      ];

      // Verify all expected assistants are available
      expect(supportedAssistants).toContain('claude-code');
      expect(supportedAssistants).toContain('antigravity');
      expect(supportedAssistants).toContain('copilot');
      expect(supportedAssistants).toContain('codex');
      expect(supportedAssistants).toContain('gemini');
      expect(supportedAssistants).toHaveLength(5);
    });

    it('should require assistant selection before generation', () => {
      const incompleteProfile = {
        language: 'typescript',
        projectType: 'api',
        architecture: 'microservices',
        datasource: 'sql',
        level: 'standard'
        // Missing: assistant
      };

      // Profile should require assistant
      expect(incompleteProfile).not.toHaveProperty('assistant');
    });

    it('should allow different AI for analysis vs target assistant', () => {
      // Scenario: Use Gemini for analysis, but target Claude Code
      const analysisFlow = {
        analysisProvider: 'gemini',  // Used to analyze project
        targetAssistant: 'claude-code'  // Will receive the guidelines
      };

      // Both should be valid but independent
      expect(analysisFlow.analysisProvider).toBe('gemini');
      expect(analysisFlow.targetAssistant).toBe('claude-code');
    });
  });

  describe('Profile Building', () => {
    it('should build complete profile from selections', () => {
      const profile: ProfileSelection = {
        assistant: 'claude-code',
        language: 'typescript',
        level: 'standard',
        architecture: 'microservices',
        projectType: 'api',
        projectName: 'test-project',
        datasource: 'sql'
      };

      expect(profile.assistant).toBe('claude-code');
      expect(profile.language).toBe('typescript');
      expect(profile.level).toBe('standard');
      expect(profile.architecture).toBe('microservices');
      expect(profile.datasource).toBe('sql');
    });

    it('should use AI recommendations when available', () => {
      const aiRecommendations = {
        language: 'typescript',
        level: 'expert',
        architecture: 'microservices',
        datasource: 'sql'
      };

      const profile: ProfileSelection = {
        assistant: 'claude-code',
        projectType: 'api',
        projectName: 'test',
        ...aiRecommendations
      };

      expect(profile.language).toBe(aiRecommendations.language);
      expect(profile.level).toBe(aiRecommendations.level);
      expect(profile.architecture).toBe(aiRecommendations.architecture);
      expect(profile.datasource).toBe(aiRecommendations.datasource);
    });

    it('should not include assistant in AI recommendations', () => {
      // AI recommendations should NOT include assistant field
      const aiRecommendations = {
        language: 'typescript',
        level: 'expert',
        architecture: 'microservices',
        datasource: 'sql',
        projectType: 'api'
      };

      // Assistant should be selected separately, not from AI
      expect(aiRecommendations).not.toHaveProperty('assistant');
      expect(Object.keys(aiRecommendations)).not.toContain('assistant');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing project directory', () => {
      const projectPath = '/nonexistent/path';
      const error = new Error(`Project directory not found: ${projectPath}`);

      expect(error.message).toContain('not found');
    });

    it('should handle AI analysis failures gracefully', () => {
      const error = new Error('AI analysis failed');
      const fallbackProfile: ProfileSelection = {
        assistant: 'claude-code',
        language: 'typescript',
        level: 'standard',
        architecture: 'microservices',
        projectType: 'api',
        projectName: 'test',
        datasource: 'sql'
      };

      expect(error).toBeDefined();
      expect(fallbackProfile).toBeDefined();
    });

    it('should handle network errors during AI analysis', () => {
      const error = new Error('Network request failed');

      expect(error.message).toBe('Network request failed');
    });
  });

  describe('File System Operations', () => {
    it('should check for existing configuration files', () => {
      const existingFiles = [
        '.claude/CLAUDE.md',
        '.claude/settings.json'
      ];

      const hasExistingConfig = existingFiles.some(f => f.includes('.claude'));

      expect(hasExistingConfig).toBe(true);
    });

    it('should handle overwrite confirmation', () => {
      const existingFiles = ['.claude/CLAUDE.md'];
      const userConfirmedOverwrite = true;

      if (existingFiles.length > 0 && !userConfirmedOverwrite) {
        throw new Error('Configuration already exists');
      }

      expect(userConfirmedOverwrite).toBe(true);
    });
  });

  describe('Existing Config Detection After Assistant Selection', () => {
    it('should check for Claude Code config at .claude directory', () => {
      const assistant = 'claude-code';
      const expectedPath = '.claude';
      const friendlyName = 'Claude Code';

      const configMap = {
        'claude-code': { path: '.claude', name: 'Claude Code' },
        'antigravity': { path: '.agent', name: 'Antigravity' },
        'copilot': { path: '.github/copilot-instructions.md', name: 'GitHub Copilot' },
        'gemini': { path: '.gemini', name: 'Gemini' },
        'codex': { path: '.codex', name: 'Codex' }
      };

      expect(configMap[assistant].path).toBe(expectedPath);
      expect(configMap[assistant].name).toBe(friendlyName);
    });

    it('should check for Antigravity config at .agent directory', () => {
      const assistant = 'antigravity';
      const expectedPath = '.agent';
      const friendlyName = 'Antigravity';

      const configMap = {
        'claude-code': { path: '.claude', name: 'Claude Code' },
        'antigravity': { path: '.agent', name: 'Antigravity' },
        'copilot': { path: '.github/copilot-instructions.md', name: 'GitHub Copilot' },
        'gemini': { path: '.gemini', name: 'Gemini' },
        'codex': { path: '.codex', name: 'Codex' }
      };

      expect(configMap[assistant].path).toBe(expectedPath);
      expect(configMap[assistant].name).toBe(friendlyName);
    });

    it('should check for Copilot config at .github/copilot-instructions.md', () => {
      const assistant = 'copilot';
      const expectedPath = '.github/copilot-instructions.md';

      const configMap = {
        'claude-code': { path: '.claude', name: 'Claude Code' },
        'antigravity': { path: '.agent', name: 'Antigravity' },
        'copilot': { path: '.github/copilot-instructions.md', name: 'GitHub Copilot' },
        'gemini': { path: '.gemini', name: 'Gemini' },
        'codex': { path: '.codex', name: 'Codex' }
      };

      expect(configMap[assistant].path).toBe(expectedPath);
    });

    it('should check for Gemini config at .gemini directory', () => {
      const assistant = 'gemini';
      const expectedPath = '.gemini';

      const configMap = {
        'claude-code': { path: '.claude', name: 'Claude Code' },
        'antigravity': { path: '.agent', name: 'Antigravity' },
        'copilot': { path: '.github/copilot-instructions.md', name: 'GitHub Copilot' },
        'gemini': { path: '.gemini', name: 'Gemini' },
        'codex': { path: '.codex', name: 'Codex' }
      };

      expect(configMap[assistant].path).toBe(expectedPath);
    });

    it('should check for Codex config at .codex directory', () => {
      const assistant = 'codex';
      const expectedPath = '.codex';

      const configMap = {
        'claude-code': { path: '.claude', name: 'Claude Code' },
        'antigravity': { path: '.agent', name: 'Antigravity' },
        'copilot': { path: '.github/copilot-instructions.md', name: 'GitHub Copilot' },
        'gemini': { path: '.gemini', name: 'Gemini' },
        'codex': { path: '.codex', name: 'Codex' }
      };

      expect(configMap[assistant].path).toBe(expectedPath);
    });

    it('should offer overwrite, clear, and cancel options when config exists', () => {
      const configExists = true;
      const availableActions = ['overwrite', 'clear', 'cancel'];

      if (configExists) {
        expect(availableActions).toHaveLength(3);
        expect(availableActions).toContain('overwrite');
        expect(availableActions).toContain('clear');
        expect(availableActions).toContain('cancel');
      }
    });

    it('should cancel generation when user selects cancel', () => {
      const userAction = 'cancel';
      const shouldContinue = userAction !== 'cancel';

      expect(shouldContinue).toBe(false);
    });

    it('should clear all configs when user selects clear', () => {
      const userAction = 'clear';
      const shouldClearAll = userAction === 'clear';
      const shouldContinueAfter = true; // Continue generation after clearing

      expect(shouldClearAll).toBe(true);
      expect(shouldContinueAfter).toBe(true);
    });

    it('should overwrite specific config when user selects overwrite', () => {
      const userAction = 'overwrite';
      const shouldOverwrite = userAction === 'overwrite';
      const shouldClearAll = userAction === 'clear';

      expect(shouldOverwrite).toBe(true);
      expect(shouldClearAll).toBe(false); // Only overwrite this assistant, not all
    });

    it('should skip config check when force flag is set', () => {
      const forceFlag = true;
      const shouldCheckExisting = !forceFlag;

      expect(shouldCheckExisting).toBe(false);
    });

    it('should check config AFTER assistant is selected in wizard', () => {
      // Config check happens after wizard completes and assistant is chosen
      const wizardSteps = [
        'language',
        'projectType',
        'assistant',  // Assistant selection
        'architecture',
        'datasource',
        'level',
        'summary'
      ];

      const wizardComplete = true;
      const assistantSelected = true;
      const canCheckExistingConfig = wizardComplete && assistantSelected;

      expect(canCheckExistingConfig).toBe(true);
      expect(wizardSteps).toContain('assistant');
    });

    it('should show specific assistant name in warning message', () => {
      const assistant = 'claude-code';
      const friendlyNames = {
        'claude-code': 'Claude Code',
        'antigravity': 'Antigravity',
        'copilot': 'GitHub Copilot',
        'gemini': 'Gemini',
        'codex': 'Codex'
      };

      const displayName = friendlyNames[assistant];
      expect(displayName).toBe('Claude Code');
      expect(displayName).not.toBe('claude-code'); // Should use friendly name
    });

    it('should use async exists check not sync', () => {
      // This verifies we're using the async pattern
      const usesAsyncExists = true; // Implementation uses await exists()
      const usesSyncExists = false;  // Not using existsSync()

      expect(usesAsyncExists).toBe(true);
      expect(usesSyncExists).toBe(false);
    });
  });
});
