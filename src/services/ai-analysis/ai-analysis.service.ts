import { AnalysisContext } from '../project-analyzer';
import { AIAssistant, Language, ProjectType } from '../../models/project';
import { InstructionLevel, ArchitectureType, DatasourceType } from '../../models/profile';
import { LANGUAGES, PROJECT_TYPES, ARCHITECTURES, DATASOURCES } from '../../constants';
import { retry } from '../shared/resilience';
import { withAbortTimeout } from '../shared/resilience/timeout';
import { AnalysisValidator } from './validation/analysis-validator';
import { createLogger } from '../shared/logging/logger';
import { ProviderFactory } from './providers';
import { AIProvider } from './providers/base-provider';
import { AIProviderError, InvalidCredentialsError } from '../shared/errors';

export interface AnalysisResult {
  architecture: {
    pattern: ArchitectureType;
    confidence: number;
  };
  projectType: ProjectType;
  language: Language;
  datasource: DatasourceType;
  level: InstructionLevel;
  backendStyle?: string;
  frontendStyle?: string;
  testingMaturity: 'low' | 'medium' | 'high';
  reasoning: string;
}

export interface AIAnalysisConfig {
  timeoutMs?: number;
  maxRetries?: number;
  initialRetryDelayMs?: number;
}

const DEFAULT_CONFIG: Required<AIAnalysisConfig> = {
  timeoutMs: 30000,
  maxRetries: 3,
  initialRetryDelayMs: 1000
};

export class AIAnalysisService {
  private readonly config: Required<AIAnalysisConfig>;
  private readonly validator: AnalysisValidator;
  private readonly serviceLogger;

  constructor(config: AIAnalysisConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.validator = new AnalysisValidator();
    this.serviceLogger = createLogger({ service: 'AIAnalysisService' });
  }

  async analyzeProject(
    context: AnalysisContext,
    assistant: AIAssistant,
    apiKey: string
  ): Promise<AnalysisResult> {
    const startTime = Date.now();
    const correlationId = this.generateCorrelationId();

    this.serviceLogger.info('AI analysis started', {
      correlationId,
      provider: assistant,
      fileCount: context.metadata.files.length,
      sampleCount: context.samples.length
    });

    try {
      const provider = this.getProvider(assistant, apiKey);
      const prompt = this.buildPrompt(context);

      this.serviceLogger.debug('Sending request to AI provider', {
        correlationId,
        provider: assistant,
        promptLength: prompt.length
      });

      const response = await retry(
        () => withAbortTimeout(
          () => provider.analyze(context, prompt),
          this.config.timeoutMs
        ),
        {
          maxAttempts: this.config.maxRetries,
          initialDelayMs: this.config.initialRetryDelayMs,
          backoff: 'exponential',
          onRetry: (attempt, error, delayMs) => {
            this.serviceLogger.warn('Retrying AI analysis', {
              correlationId,
              provider: assistant,
              attempt,
              delayMs,
              error: error.message
            });
          }
        }
      );

      const result = this.validator.parseAndValidate(response);

      const duration = Date.now() - startTime;
      this.serviceLogger.info('AI analysis completed', {
        correlationId,
        provider: assistant,
        duration,
        architecture: result.architecture.pattern,
        language: result.language
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;

      this.serviceLogger.error('AI analysis failed', error as Error, {
        correlationId,
        provider: assistant,
        duration
      });

      if (error instanceof AIProviderError) {
        throw error;
      }

      throw new AIProviderError(
        `AI analysis failed: ${(error as Error).message}`,
        assistant,
        error as Error
      );
    }
  }

  private getProvider(assistant: AIAssistant, apiKey: string): AIProvider {
    if (!apiKey?.trim()) {
      throw new InvalidCredentialsError(
        `API key required for ${assistant}`,
        assistant
      );
    }

    return ProviderFactory.create(assistant, apiKey, {
      timeout: this.config.timeoutMs,
      maxRetries: this.config.maxRetries
    });
  }

  private buildPrompt(context: AnalysisContext): string {
    const { metadata, samples } = context;

    return `You are an expert codebase architecture analyzer. Analyze the project and return a JSON response.

## PROJECT DETECTION RESULTS

**Language**: ${metadata.language}
**Frameworks**: ${metadata.frameworks.join(', ') || 'none detected'}
**Build Tools**: ${metadata.buildTools.join(', ') || 'none'}
**Package Manager**: ${metadata.packageManager}
**Repo Type**: ${metadata.repoType}

**Architecture Hints**: ${metadata.architectureHints.join(', ') || 'none'}
**Database Hints**: ${metadata.databaseHints.detected.join(', ') || 'none'} (SQL: ${metadata.databaseHints.hasSql}, NoSQL: ${metadata.databaseHints.hasNoSql})
**Testing**: ${metadata.testingHints.hasTests ? `${metadata.testingHints.testFileCount} test files` : 'no tests detected'}
**Project Type Hints**: ${metadata.projectTypeHints.join(', ') || 'none'}

**Directory Structure** (key folders):
${metadata.structure.slice(0, 15).join('\n')}

## FILE SAMPLES
${samples.slice(0, 3).map(s => `=== ${s.path} ===\n${s.content.substring(0, 1000)}${s.content.length > 1000 ? '...' : ''}`).join('\n\n')}

## REQUIRED JSON RESPONSE

Return ONLY valid JSON with these EXACT fields:

{
  "language": "<one of: ${LANGUAGES.map(l => l.value).join(', ')}>",
  "projectType": "<one of: ${PROJECT_TYPES.map(p => p.value).join(', ')}>",
  "architecture": {
    "pattern": "<one of: ${ARCHITECTURES.map(a => a.value).join(', ')}>",
    "confidence": <number between 0.0-1.0>
  },
  "datasource": "<one of: ${DATASOURCES.map(d => d.value).join(', ')}>",
  "level": "<one of: basic, standard, expert, full>",
  "testingMaturity": "<one of: low, medium, high>",
  "reasoning": "<brief 1-2 sentence explanation>"
}

IMPORTANT:
- Use architectureHints to determine architecture.pattern
- Use databaseHints to determine datasource (sql if hasSql=true, nosql if hasNoSql=true, none if both false)
- Use testingHints to determine testingMaturity (low: <5 tests, medium: 5-20 tests, high: >20 tests)
- Use projectTypeHints to determine projectType
- Choose level based on project complexity (basic: simple scripts, standard: typical apps, expert: complex systems, full: large enterprise)
- Set confidence high (>0.8) if hints are strong, medium (0.5-0.8) if unclear, low (<0.5) if guessing
- Return ONLY the JSON object, no markdown, no explanations outside the JSON`;
  }

  private generateCorrelationId(): string {
    return `ai-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }
}
