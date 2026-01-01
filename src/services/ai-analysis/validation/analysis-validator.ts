import { AnalysisResult } from '../../ai-analysis-service.js';
import { ValidationError, ValidationErrors } from '../../shared/errors/index.js';
import { Language, ProjectType } from '../../../models/project.js';
import { InstructionLevel, ArchitectureType, DatasourceType } from '../../../models/profile.js';

/**
 * Validator for AI analysis results
 * Ensures the AI response matches the expected schema
 */
export class AnalysisValidator {
  private readonly validLanguages: Set<string>;
  private readonly validProjectTypes: Set<string>;
  private readonly validArchitectures: Set<string>;
  private readonly validDatasources: Set<string>;
  private readonly validLevels: Set<string>;
  private readonly validTestingMaturities: Set<string>;

  constructor() {
    // Initialize valid values
    this.validLanguages = new Set<string>([
      'typescript', 'javascript', 'python', 'go', 'rust', 'java', 'csharp', 'ruby', 'dart', 'unknown'
    ]);

    this.validProjectTypes = new Set<string>([
      'web', 'api', 'cli', 'library', 'desktop', 'mobile', 'other'
    ]);

    this.validArchitectures = new Set<string>([
      'modular-monolith', 'microservices', 'serverless', 'layered', 'clean', 'mvc', 'other'
    ]);

    this.validDatasources = new Set<string>([
      'postgresql', 'mysql', 'mongodb', 'redis', 'sqlite', 'none', 'other'
    ]);

    this.validLevels = new Set<string>(['basic', 'standard', 'expert', 'full']);

    this.validTestingMaturities = new Set<string>(['low', 'medium', 'high']);
  }

  /**
   * Validate analysis result structure and values
   * @throws ValidationErrors if validation fails
   */
  validate(result: unknown): asserts result is AnalysisResult {
    const errors: Array<{ field: string; message: string }> = [];

    // Check if result is an object
    if (typeof result !== 'object' || result === null) {
      throw new ValidationError('Analysis result must be an object');
    }

    const data = result as Record<string, unknown>;

    // Validate language
    if (!data.language || typeof data.language !== 'string') {
      errors.push({ field: 'language', message: 'Language is required and must be a string' });
    } else if (!this.validLanguages.has(data.language)) {
      errors.push({
        field: 'language',
        message: `Invalid language: ${data.language}. Must be one of: ${Array.from(this.validLanguages).join(', ')}`
      });
    }

    // Validate projectType
    if (!data.projectType || typeof data.projectType !== 'string') {
      errors.push({ field: 'projectType', message: 'Project type is required and must be a string' });
    } else if (!this.validProjectTypes.has(data.projectType)) {
      errors.push({
        field: 'projectType',
        message: `Invalid project type: ${data.projectType}. Must be one of: ${Array.from(this.validProjectTypes).join(', ')}`
      });
    }

    // Validate architecture
    if (!data.architecture || typeof data.architecture !== 'object') {
      errors.push({ field: 'architecture', message: 'Architecture is required and must be an object' });
    } else {
      const arch = data.architecture as Record<string, unknown>;

      if (!arch.pattern || typeof arch.pattern !== 'string') {
        errors.push({ field: 'architecture.pattern', message: 'Architecture pattern is required and must be a string' });
      } else if (!this.validArchitectures.has(arch.pattern)) {
        errors.push({
          field: 'architecture.pattern',
          message: `Invalid architecture: ${arch.pattern}. Must be one of: ${Array.from(this.validArchitectures).join(', ')}`
        });
      }

      if (typeof arch.confidence !== 'number') {
        errors.push({ field: 'architecture.confidence', message: 'Confidence must be a number' });
      } else if (arch.confidence < 0 || arch.confidence > 1) {
        errors.push({ field: 'architecture.confidence', message: 'Confidence must be between 0 and 1' });
      }
    }

    // Validate datasource
    if (!data.datasource || typeof data.datasource !== 'string') {
      errors.push({ field: 'datasource', message: 'Datasource is required and must be a string' });
    } else if (!this.validDatasources.has(data.datasource)) {
      errors.push({
        field: 'datasource',
        message: `Invalid datasource: ${data.datasource}. Must be one of: ${Array.from(this.validDatasources).join(', ')}`
      });
    }

    // Validate level
    if (!data.level || typeof data.level !== 'string') {
      errors.push({ field: 'level', message: 'Instruction level is required and must be a string' });
    } else if (!this.validLevels.has(data.level)) {
      errors.push({
        field: 'level',
        message: `Invalid level: ${data.level}. Must be one of: ${Array.from(this.validLevels).join(', ')}`
      });
    }

    // Validate testingMaturity
    if (!data.testingMaturity || typeof data.testingMaturity !== 'string') {
      errors.push({ field: 'testingMaturity', message: 'Testing maturity is required and must be a string' });
    } else if (!this.validTestingMaturities.has(data.testingMaturity)) {
      errors.push({
        field: 'testingMaturity',
        message: `Invalid testing maturity: ${data.testingMaturity}. Must be one of: low, medium, high`
      });
    }

    // Validate reasoning (optional but if present must be string)
    if (data.reasoning !== undefined && typeof data.reasoning !== 'string') {
      errors.push({ field: 'reasoning', message: 'Reasoning must be a string if provided' });
    }

    // Validate optional fields
    if (data.backendStyle !== undefined && typeof data.backendStyle !== 'string') {
      errors.push({ field: 'backendStyle', message: 'Backend style must be a string if provided' });
    }

    if (data.frontendStyle !== undefined && typeof data.frontendStyle !== 'string') {
      errors.push({ field: 'frontendStyle', message: 'Frontend style must be a string if provided' });
    }

    // Throw if any errors found
    if (errors.length > 0) {
      throw new ValidationErrors(errors);
    }
  }

  /**
   * Safely parse and validate JSON response from AI
   */
  parseAndValidate(jsonString: string): AnalysisResult {
    // Clean markdown code blocks if present
    const cleaned = jsonString
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();

    let parsed: unknown;

    try {
      parsed = JSON.parse(cleaned);
    } catch (error) {
      throw new ValidationError(
        `Invalid JSON from AI: ${(error as Error).message}`,
        'json',
        { rawResponse: jsonString.substring(0, 200) }
      );
    }

    // Validate structure
    this.validate(parsed);

    return parsed as AnalysisResult;
  }
}
