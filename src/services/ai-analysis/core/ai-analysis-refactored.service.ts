import { AnalysisContext } from '../../project-analyzer.js';
import { AIAssistant, Language, ProjectType } from '../../../models/project.js';
import { InstructionLevel, ArchitectureType, DatasourceType } from '../../../models/profile.js';
import { LANGUAGES, PROJECT_TYPES, ARCHITECTURES, DATASOURCES } from '../../../constants.js';
import { retry } from '../../shared/resilience/retry.js';
import { withAbortTimeout } from '../../shared/resilience/timeout.js';
import { AnalysisValidator } from '../validation/analysis-validator.js';
import { logger, createLogger } from '../../shared/logging/logger.js';
import {
  AIProviderError,
  AIResponseError,
  InvalidCredentialsError,
  RateLimitError
} from '../../shared/errors/index.js';

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

export interface AIProvider {
  analyze(context: AnalysisContext, prompt: string): Promise<string>;
}

/**
 * Configuration for AI analysis service
 */
export interface AIAnalysisConfig {
  /** Timeout for AI API calls in milliseconds */
  timeoutMs?: number;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Initial retry delay in milliseconds */
  initialRetryDelayMs?: number;
}

const DEFAULT_CONFIG: Required<AIAnalysisConfig> = {
  timeoutMs: 30000, // 30 seconds
  maxRetries: 3,
  initialRetryDelayMs: 1000
};

/**
 * Enterprise-grade AI Analysis Service
 * - Retry logic with exponential backoff
 * - Timeout handling
 * - Response validation
 * - Structured logging
 * - Proper error handling
 */
export class AIAnalysisServiceRefactored {
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
      projectPath: context.metadata.files.length > 0 ? 'detected' : 'unknown',
      fingerprint: context.metadata.fingerprint,
      fileCount: context.metadata.files.length,
      sampleCount: context.samples.length
    });

    try {
      const provider = this.getProvider(assistant, apiKey);
      const prompt = this.buildPrompt(context);

      this.serviceLogger.debug('Sending request to AI provider', {
        correlationId,
        provider: assistant,
        promptLength: prompt.length,
        sampleFileCount: context.samples.length
      });

      // Execute with retry and timeout
      const response = await retry(
        () => withAbortTimeout(
          (signal) => this.executeProviderRequest(provider, context, prompt, signal),
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

      this.serviceLogger.debug('Received response from AI provider', {
        correlationId,
        provider: assistant,
        responseLength: response.length
      });

      // Parse and validate response
      const result = this.validator.parseAndValidate(response);

      const duration = Date.now() - startTime;
      this.serviceLogger.info('AI analysis completed successfully', {
        correlationId,
        provider: assistant,
        duration,
        architecture: result.architecture.pattern,
        confidence: result.architecture.confidence,
        language: result.language,
        projectType: result.projectType
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;

      this.serviceLogger.error('AI analysis failed', error as Error, {
        correlationId,
        provider: assistant,
        duration,
        errorType: (error as Error).constructor.name
      });

      // Re-throw with better context
      if (error instanceof AIProviderError || error instanceof AIResponseError) {
        throw error;
      }

      throw new AIProviderError(
        `AI analysis failed: ${(error as Error).message}`,
        assistant,
        error as Error
      );
    }
  }

  /**
   * Execute provider request with abort signal support
   */
  private async executeProviderRequest(
    provider: AIProvider,
    context: AnalysisContext,
    prompt: string,
    signal: AbortSignal
  ): Promise<string> {
    // Note: Providers need to be updated to support AbortSignal
    // For now, we'll use the existing provider interface
    return provider.analyze(context, prompt);
  }

  private getProvider(assistant: AIAssistant, apiKey: string): AIProvider {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new InvalidCredentialsError(
        `API key is required for ${assistant}`,
        assistant
      );
    }

    // Simple factory - in refactored version, these would be separate classes
    if (assistant === 'claude-code' || assistant === 'antigravity') {
      return new ClaudeProviderRefactored(apiKey, this.serviceLogger);
    } else if (assistant === 'gemini') {
      return new GeminiProviderRefactored(apiKey, this.serviceLogger);
    } else if (assistant === 'codex' || assistant === 'copilot') {
      return new OpenAIProviderRefactored(apiKey, this.serviceLogger);
    }

    throw new AIProviderError(`Provider ${assistant} not supported for analysis yet.`, assistant);
  }

  private buildPrompt(context: AnalysisContext): string {
    const availableOptions = {
      languages: LANGUAGES.map(l => l.value),
      projectTypes: PROJECT_TYPES.map(p => p.value),
      architectures: ARCHITECTURES.map(a => a.value),
      datasources: DATASOURCES.map(d => d.value),
      levels: ['basic', 'standard', 'expert', 'full']
    };

    return `
You are a codebase architecture analyzer.
Use the provided static analysis and file samples.
Return ONLY valid JSON matching the schema.
Do not explain your reasoning outside the JSON.

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
    "pattern": "value (from options)",
    "confidence": 0.0-1.0
  },
  "datasource": "value",
  "level": "value",
  "backendStyle": "short string (e.g. modular-monolith)",
  "frontendStyle": "short string (e.g. app-router)",
  "testingMaturity": "low|medium|high",
  "reasoning": "short explanation"
}
`;
  }

  private generateCorrelationId(): string {
    return `ai-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Refactored Claude Provider with better error handling
 */
class ClaudeProviderRefactored implements AIProvider {
  private readonly logger;

  constructor(
    private apiKey: string,
    baseLogger: ReturnType<typeof createLogger>
  ) {
    this.logger = createLogger({ provider: 'claude', ...baseLogger });
  }

  async analyze(_context: AnalysisContext, prompt: string): Promise<string> {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-3-sonnet-20240229',
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Unable to read error response');

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after');
          throw new RateLimitError(
            'Claude API rate limit exceeded',
            retryAfter ? parseInt(retryAfter) : undefined,
            { status: response.status, body: errorBody }
          );
        }

        // Handle authentication errors
        if (response.status === 401) {
          throw new InvalidCredentialsError('Invalid Claude API key', 'claude');
        }

        throw new AIProviderError(
          `Claude API error: ${response.statusText}`,
          'claude',
          undefined,
          { status: response.status, body: errorBody }
        );
      }

      const data = await response.json() as { content: { text: string }[] };

      if (!data.content || !data.content[0] || !data.content[0].text) {
        throw new AIResponseError(
          'Invalid response structure from Claude API',
          'claude',
          data
        );
      }

      return data.content[0].text;

    } catch (error) {
      if (error instanceof AIProviderError || error instanceof InvalidCredentialsError || error instanceof RateLimitError) {
        throw error;
      }

      throw new AIProviderError(
        `Claude API request failed: ${(error as Error).message}`,
        'claude',
        error as Error
      );
    }
  }
}

/**
 * Refactored Gemini Provider with better error handling
 */
class GeminiProviderRefactored implements AIProvider {
  private readonly logger;

  constructor(
    private apiKey: string,
    baseLogger: ReturnType<typeof createLogger>
  ) {
    this.logger = createLogger({ provider: 'gemini', ...baseLogger });
  }

  async analyze(_context: AnalysisContext, prompt: string): Promise<string> {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        }
      );

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Unable to read error response');

        if (response.status === 429) {
          throw new RateLimitError('Gemini API rate limit exceeded', undefined, {
            status: response.status,
            body: errorBody
          });
        }

        if (response.status === 401 || response.status === 403) {
          throw new InvalidCredentialsError('Invalid Gemini API key', 'gemini');
        }

        throw new AIProviderError(
          `Gemini API error: ${response.statusText}`,
          'gemini',
          undefined,
          { status: response.status, body: errorBody }
        );
      }

      const data = await response.json() as { candidates: { content: { parts: { text: string }[] } }[] };

      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content.parts[0]) {
        throw new AIResponseError(
          'Invalid response structure from Gemini API',
          'gemini',
          data
        );
      }

      return data.candidates[0].content.parts[0].text;

    } catch (error) {
      if (error instanceof AIProviderError || error instanceof InvalidCredentialsError || error instanceof RateLimitError) {
        throw error;
      }

      throw new AIProviderError(
        `Gemini API request failed: ${(error as Error).message}`,
        'gemini',
        error as Error
      );
    }
  }
}

/**
 * Refactored OpenAI Provider with better error handling
 */
class OpenAIProviderRefactored implements AIProvider {
  private readonly logger;

  constructor(
    private apiKey: string,
    baseLogger: ReturnType<typeof createLogger>
  ) {
    this.logger = createLogger({ provider: 'openai', ...baseLogger });
  }

  async analyze(_context: AnalysisContext, prompt: string): Promise<string> {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Unable to read error response');

        if (response.status === 429) {
          throw new RateLimitError('OpenAI API rate limit exceeded', undefined, {
            status: response.status,
            body: errorBody
          });
        }

        if (response.status === 401) {
          throw new InvalidCredentialsError('Invalid OpenAI API key', 'openai');
        }

        throw new AIProviderError(
          `OpenAI API error: ${response.statusText}`,
          'openai',
          undefined,
          { status: response.status, body: errorBody }
        );
      }

      const data = await response.json() as { choices: { message: { content: string } }[] };

      if (!data.choices || !data.choices[0] || !data.choices[0].message.content) {
        throw new AIResponseError(
          'Invalid response structure from OpenAI API',
          'openai',
          data
        );
      }

      return data.choices[0].message.content;

    } catch (error) {
      if (error instanceof AIProviderError || error instanceof InvalidCredentialsError || error instanceof RateLimitError) {
        throw error;
      }

      throw new AIProviderError(
        `OpenAI API request failed: ${(error as Error).message}`,
        'openai',
        error as Error
      );
    }
  }
}
