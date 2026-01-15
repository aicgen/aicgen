import { GoogleGenerativeAI } from '@google/generative-ai';
import { AnalysisContext } from '../../project-analyzer';
import { BaseAIProvider } from './base-provider';
import { TimeoutError } from '../../shared/errors';
import { getProviderConfig } from '../../../config/ai-providers.config.js';

export class GeminiProvider extends BaseAIProvider {
  private client: GoogleGenerativeAI;
  private modelConfig: ReturnType<typeof getProviderConfig>;

  constructor(apiKey: string, options: { timeout?: number; maxRetries?: number } = {}) {
    super(apiKey, options);
    this.client = new GoogleGenerativeAI(apiKey);
    this.modelConfig = getProviderConfig('gemini');

    // Override with runtime options if provided
    if (options.timeout) {
      this.modelConfig.timeout = options.timeout;
    }
    if (options.maxRetries) {
      this.modelConfig.maxRetries = options.maxRetries;
    }
  }

  async analyze(_context: AnalysisContext, prompt: string): Promise<string> {
    try {
      // Get base generation config from modelConfig.options
      const baseGenerationConfig = (this.modelConfig.options?.generationConfig as Record<string, unknown>) || {};

      const model = this.client.getGenerativeModel({
        model: this.modelConfig.model,
        generationConfig: {
          // Base config from modelConfig.options (includes responseMimeType)
          ...baseGenerationConfig,
          // Override with explicit config values
          ...(this.modelConfig.maxTokens && { maxOutputTokens: this.modelConfig.maxTokens }),
          ...(this.modelConfig.temperature !== undefined && { temperature: this.modelConfig.temperature }),
        },
      });

      const result = await model.generateContent(prompt);
      const response = result.response;
      return response.text();
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('timeout') || error.message.includes('timed out')) {
          throw new TimeoutError('Gemini', this.modelConfig.timeout);
        }
        throw new Error(`Gemini API error: ${error.message}`);
      }
      throw error;
    }
  }
}
