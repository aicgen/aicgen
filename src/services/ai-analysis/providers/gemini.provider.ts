import { GoogleGenAI } from '@google/genai';
import { AnalysisContext } from '../../project-analyzer';
import { BaseAIProvider } from './base-provider';
import { TimeoutError } from '../../shared/errors';
import { getProviderConfig } from '../../../config/ai-providers.config.js';

export class GeminiProvider extends BaseAIProvider {
  private client: GoogleGenAI;
  private modelConfig: ReturnType<typeof getProviderConfig>;

  constructor(apiKey: string, options: { timeout?: number; maxRetries?: number } = {}) {
    super(apiKey, options);
    this.client = new GoogleGenAI({ apiKey });
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
      // Base config from modelConfig.options (includes responseMimeType: application/json)
      const baseGenerationConfig = (this.modelConfig.options?.generationConfig as Record<string, unknown>) || {};

      const response = await this.client.models.generateContent({
        model: this.modelConfig.model,
        contents: prompt,
        config: {
          ...baseGenerationConfig,
          ...(this.modelConfig.maxTokens && { maxOutputTokens: this.modelConfig.maxTokens }),
          ...(this.modelConfig.temperature !== undefined && { temperature: this.modelConfig.temperature }),
        },
      });

      return response.text ?? '';
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('timeout') || error.message.includes('timed out')) {
          throw new TimeoutError('Gemini', this.modelConfig.timeout);
        }
        throw new Error(`Gemini API error: ${error.message}`, { cause: error });
      }
      throw error;
    }
  }
}
