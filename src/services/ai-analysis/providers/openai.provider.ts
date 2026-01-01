import OpenAI from 'openai';
import { AnalysisContext } from '../../project-analyzer';
import { BaseAIProvider } from './base-provider';
import { TimeoutError } from '../../shared/errors';

export class OpenAIProvider extends BaseAIProvider {
  private client: OpenAI;

  constructor(apiKey: string, options: { timeout?: number; maxRetries?: number } = {}) {
    super(apiKey, options);
    this.client = new OpenAI({
      apiKey,
      timeout: options.timeout || 30000,
      maxRetries: options.maxRetries || 3
    });
  }

  async analyze(_context: AnalysisContext, prompt: string): Promise<string> {
    try {
      const completion = await this.client.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      });

      return completion.choices[0].message.content || '';
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('timeout') || error.message.includes('timed out')) {
          throw new TimeoutError('OpenAI', this.options.timeout);
        }
        throw new Error(`OpenAI API error: ${error.message}`);
      }
      throw error;
    }
  }
}
