import OpenAI from 'openai';
import { AnalysisContext } from '../../project-analyzer';
import { BaseAIProvider } from './base-provider';
import { TimeoutError } from '../../shared/errors';
import { getProviderConfig } from '../../../config/ai-providers.config.js';

export class OpenAIProvider extends BaseAIProvider {
  private client: OpenAI;
  private modelConfig: ReturnType<typeof getProviderConfig>;

  constructor(apiKey: string, options: { timeout?: number; maxRetries?: number } = {}) {
    super(apiKey, options);
    this.modelConfig = getProviderConfig('openai');

    // Override with runtime options if provided
    const timeout = options.timeout || this.modelConfig.timeout;
    const maxRetries = options.maxRetries || this.modelConfig.maxRetries;

    this.client = new OpenAI({
      apiKey,
      timeout,
      maxRetries,
    });

    // Update modelConfig with runtime options
    if (options.timeout) {
      this.modelConfig.timeout = options.timeout;
    }
    if (options.maxRetries) {
      this.modelConfig.maxRetries = options.maxRetries;
    }
  }

  async analyze(_context: AnalysisContext, prompt: string): Promise<string> {
    try {
      const completion = await this.client.chat.completions.create({
        model: this.modelConfig.model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        max_tokens: this.modelConfig.maxTokens,
        temperature: this.modelConfig.temperature,
      });

      return completion.choices[0].message.content || '';
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('timeout') || error.message.includes('timed out')) {
          throw new TimeoutError('OpenAI', this.modelConfig.timeout);
        }
        throw new Error(`OpenAI API error: ${error.message}`);
      }
      throw error;
    }
  }
}
