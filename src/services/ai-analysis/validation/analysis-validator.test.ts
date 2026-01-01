import { AnalysisValidator } from './analysis-validator.js';
import { ValidationError, ValidationErrors } from '../../shared/errors/index.js';

describe('AnalysisValidator', () => {
  let validator: AnalysisValidator;

  beforeEach(() => {
    validator = new AnalysisValidator();
  });

  describe('validate()', () => {
    it('should validate correct analysis result', () => {
      const validResult = {
        language: 'typescript',
        projectType: 'web',
        architecture: {
          pattern: 'modular-monolith',
          confidence: 0.85
        },
        datasource: 'postgresql',
        level: 'standard',
        testingMaturity: 'medium',
        reasoning: 'Detected NestJS with PostgreSQL'
      };

      expect(() => validator.validate(validResult)).not.toThrow();
    });

    it('should throw ValidationError for non-object input', () => {
      expect(() => validator.validate(null)).toThrow(ValidationError);
      expect(() => validator.validate('string')).toThrow(ValidationError);
      expect(() => validator.validate(123)).toThrow(ValidationError);
    });

    it('should throw ValidationErrors for missing language', () => {
      const invalidResult = {
        projectType: 'web',
        architecture: { pattern: 'modular-monolith', confidence: 0.85 },
        datasource: 'postgresql',
        level: 'standard',
        testingMaturity: 'medium'
      };

      expect(() => validator.validate(invalidResult)).toThrow(ValidationErrors);
      expect(() => validator.validate(invalidResult)).toThrow('Language is required');
    });

    it('should throw ValidationErrors for invalid language value', () => {
      const invalidResult = {
        language: 'invalid-language',
        projectType: 'web',
        architecture: { pattern: 'modular-monolith', confidence: 0.85 },
        datasource: 'postgresql',
        level: 'standard',
        testingMaturity: 'medium'
      };

      expect(() => validator.validate(invalidResult)).toThrow(ValidationErrors);
      expect(() => validator.validate(invalidResult)).toThrow('Invalid language');
    });

    it('should throw ValidationErrors for missing architecture', () => {
      const invalidResult = {
        language: 'typescript',
        projectType: 'web',
        datasource: 'postgresql',
        level: 'standard',
        testingMaturity: 'medium'
      };

      expect(() => validator.validate(invalidResult)).toThrow(ValidationErrors);
      expect(() => validator.validate(invalidResult)).toThrow('Architecture is required');
    });

    it('should throw ValidationErrors for invalid confidence', () => {
      const invalidResult = {
        language: 'typescript',
        projectType: 'web',
        architecture: {
          pattern: 'modular-monolith',
          confidence: 1.5 // Invalid: > 1
        },
        datasource: 'postgresql',
        level: 'standard',
        testingMaturity: 'medium'
      };

      expect(() => validator.validate(invalidResult)).toThrow(ValidationErrors);
      expect(() => validator.validate(invalidResult)).toThrow('Confidence must be between 0 and 1');
    });

    it('should throw ValidationErrors for invalid testing maturity', () => {
      const invalidResult = {
        language: 'typescript',
        projectType: 'web',
        architecture: { pattern: 'modular-monolith', confidence: 0.85 },
        datasource: 'postgresql',
        level: 'standard',
        testingMaturity: 'invalid'
      };

      expect(() => validator.validate(invalidResult)).toThrow(ValidationErrors);
      expect(() => validator.validate(invalidResult)).toThrow('Invalid testing maturity');
    });

    it('should allow optional backendStyle and frontendStyle', () => {
      const validResult = {
        language: 'typescript',
        projectType: 'web',
        architecture: { pattern: 'modular-monolith', confidence: 0.85 },
        datasource: 'postgresql',
        level: 'standard',
        testingMaturity: 'medium',
        backendStyle: 'NestJS',
        frontendStyle: 'React',
        reasoning: 'Full stack app'
      };

      expect(() => validator.validate(validResult)).not.toThrow();
    });

    it('should collect multiple validation errors', () => {
      const invalidResult = {
        language: 'invalid-lang',
        projectType: 'invalid-type',
        architecture: { pattern: 'invalid-arch', confidence: 2 },
        datasource: 'invalid-ds',
        level: 'invalid-level',
        testingMaturity: 'invalid-maturity'
      };

      try {
        validator.validate(invalidResult);
        fail('Should have thrown ValidationErrors');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationErrors);
        const validationErrors = (error as ValidationErrors).errors;
        expect(validationErrors.length).toBeGreaterThan(3);
      }
    });
  });

  describe('parseAndValidate()', () => {
    it('should parse and validate correct JSON', () => {
      const jsonString = `{
        "language": "typescript",
        "projectType": "web",
        "architecture": {
          "pattern": "modular-monolith",
          "confidence": 0.85
        },
        "datasource": "postgresql",
        "level": "standard",
        "testingMaturity": "medium",
        "reasoning": "NestJS application"
      }`;

      const result = validator.parseAndValidate(jsonString);

      expect(result.language).toBe('typescript');
      expect(result.architecture.pattern).toBe('modular-monolith');
    });

    it('should handle JSON with markdown code blocks', () => {
      const jsonString = `\`\`\`json
      {
        "language": "typescript",
        "projectType": "web",
        "architecture": {
          "pattern": "modular-monolith",
          "confidence": 0.85
        },
        "datasource": "postgresql",
        "level": "standard",
        "testingMaturity": "medium",
        "reasoning": "NestJS application"
      }
      \`\`\``;

      const result = validator.parseAndValidate(jsonString);

      expect(result.language).toBe('typescript');
    });

    it('should throw ValidationError for invalid JSON syntax', () => {
      const invalidJson = '{ "language": "typescript" invalid }';

      expect(() => validator.parseAndValidate(invalidJson)).toThrow(ValidationError);
      expect(() => validator.parseAndValidate(invalidJson)).toThrow('Invalid JSON from AI');
    });

    it('should throw ValidationErrors for valid JSON but invalid schema', () => {
      const invalidSchema = `{
        "language": "invalid-language",
        "projectType": "web"
      }`;

      expect(() => validator.parseAndValidate(invalidSchema)).toThrow(ValidationErrors);
    });
  });
});
