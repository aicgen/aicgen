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
    const availableOptions = {
      languages: LANGUAGES.map(l => l.value),
      projectTypes: PROJECT_TYPES.map(p => p.value),
      architectures: ARCHITECTURES.map(a => a.value),
      datasources: DATASOURCES.map(d => d.value),
      levels: ['basic', 'standard', 'expert', 'full']
    };

    return `You are a codebase architecture analyzer.
Use the provided static analysis and file samples.
Return ONLY valid JSON matching the schema.

METADATA:
${JSON.stringify(context.metadata, null, 2)}

FILE SAMPLES:
${context.samples.map(s => `--- ${s.path} ---\n${s.content}\n---`).join('\n')}

AVAILABLE OPTIONS:
${JSON.stringify(availableOptions, null, 2)}

SCHEMA:
{
  "language": "value",
  "projectType": "value",
  "architecture": {
    "pattern": "value",
    "confidence": 0.0-1.0
  },
  "datasource": "value",
  "level": "value",
  "backendStyle": "optional short string",
  "frontendStyle": "optional short string",
  "testingMaturity": "low|medium|high",
  "reasoning": "short explanation"
}`;
  }

  private generateCorrelationId(): string {
    return `ai-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }
}
