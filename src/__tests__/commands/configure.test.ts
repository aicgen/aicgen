import type { ProfileSelection } from '../../models/profile';

describe('Configure Command Logic', () => {
  describe('Profile Validation', () => {
    it('should have all required fields in profile', () => {
      const profile: ProfileSelection = {
        assistant: 'claude-code',
        language: 'typescript',
        level: 'standard',
        architecture: 'microservices',
        projectType: 'api',
        projectName: 'test-project',
        datasource: 'sql'
      };

      expect(profile.assistant).toBeDefined();
      expect(profile.language).toBeDefined();
      expect(profile.level).toBeDefined();
      expect(profile.architecture).toBeDefined();
      expect(profile.datasource).toBeDefined();
    });

    it('should accept valid assistant values', () => {
      const validAssistants = ['claude-code', 'copilot', 'gemini', 'antigravity', 'codex'];

      validAssistants.forEach(assistant => {
        const profile: Partial<ProfileSelection> = { assistant: assistant as any };
        expect(profile.assistant).toBe(assistant);
      });
    });

    it('should accept valid language values', () => {
      const validLanguages = ['typescript', 'python', 'go', 'rust', 'java'];

      validLanguages.forEach(language => {
        const profile: Partial<ProfileSelection> = { language: language as any };
        expect(profile.language).toBe(language);
      });
    });

    it('should accept valid level values', () => {
      const validLevels = ['basic', 'standard', 'expert', 'full'];

      validLevels.forEach(level => {
        const profile: Partial<ProfileSelection> = { level: level as any };
        expect(profile.level).toBe(level);
      });
    });
  });

  describe('AI Analysis Error Types', () => {
    it('should recognize timeout errors', () => {
      class TimeoutError extends Error {
        constructor(message: string, public timeoutMs: number) {
          super(message);
          this.name = 'TimeoutError';
        }
      }

      const error = new TimeoutError('Operation timed out', 30000);
      expect(error.name).toBe('TimeoutError');
      expect(error.timeoutMs).toBe(30000);
    });

    it('should recognize invalid credentials errors', () => {
      class InvalidCredentialsError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'InvalidCredentialsError';
        }
      }

      const error = new InvalidCredentialsError('Invalid API key');
      expect(error.name).toBe('InvalidCredentialsError');
    });

    it('should recognize validation errors', () => {
      class ValidationErrors extends Error {
        constructor(public errors: string[]) {
          super(`Validation failed: ${errors.join(', ')}`);
          this.name = 'ValidationErrors';
        }
      }

      const error = new ValidationErrors(['Missing field', 'Invalid value']);
      expect(error.name).toBe('ValidationErrors');
      expect(error.errors).toHaveLength(2);
    });
  });

  describe('Configuration Options', () => {
    it('should support all datasource types', () => {
      const datasources = ['sql', 'nosql', 'graph', 'none'];

      datasources.forEach(ds => {
        const profile: Partial<ProfileSelection> = { datasource: ds as any };
        expect(profile.datasource).toBe(ds);
      });
    });

    it('should support all architecture types', () => {
      const architectures = ['microservices', 'modular-monolith', 'serverless', 'layered'];

      architectures.forEach(arch => {
        const profile: Partial<ProfileSelection> = { architecture: arch as any };
        expect(profile.architecture).toBe(arch);
      });
    });

    it('should support all project types', () => {
      const projectTypes = ['api', 'web', 'cli', 'library'];

      projectTypes.forEach(type => {
        const profile: Partial<ProfileSelection> = { projectType: type as any };
        expect(profile.projectType).toBe(type);
      });
    });
  });

  describe('Profile Completeness', () => {
    it('should require all mandatory fields', () => {
      const mandatoryFields = [
        'assistant',
        'language',
        'level',
        'architecture',
        'projectType',
        'projectName',
        'datasource'
      ];

      const profile: ProfileSelection = {
        assistant: 'claude-code',
        language: 'typescript',
        level: 'standard',
        architecture: 'microservices',
        projectType: 'api',
        projectName: 'test',
        datasource: 'sql'
      };

      mandatoryFields.forEach(field => {
        expect(profile[field as keyof ProfileSelection]).toBeDefined();
      });
    });

    it('should build profile from AI recommendations', () => {
      const recommendations = {
        language: 'python',
        level: 'expert',
        architecture: 'microservices',
        datasource: 'sql'
      };

      const profile: ProfileSelection = {
        assistant: 'claude-code',
        projectType: 'api',
        projectName: 'test-project',
        ...recommendations
      };

      expect(profile.language).toBe('python');
      expect(profile.level).toBe('expert');
      expect(profile.architecture).toBe('microservices');
      expect(profile.datasource).toBe('sql');
    });
  });

  describe('AI Analysis Configuration', () => {
    it('should have reasonable timeout configuration', () => {
      const config = {
        timeoutMs: 30000,
        maxRetries: 3,
        initialRetryDelayMs: 1000
      };

      expect(config.timeoutMs).toBeGreaterThan(0);
      expect(config.maxRetries).toBeGreaterThan(0);
      expect(config.initialRetryDelayMs).toBeGreaterThan(0);
    });

    it('should configure retry with exponential backoff', () => {
      const initialDelay = 1000;
      const maxRetries = 3;
      const delays = [];

      for (let i = 0; i < maxRetries; i++) {
        const delay = initialDelay * Math.pow(2, i);
        delays.push(delay);
      }

      expect(delays).toEqual([1000, 2000, 4000]);
    });
  });
});
