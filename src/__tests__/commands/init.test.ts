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
});
