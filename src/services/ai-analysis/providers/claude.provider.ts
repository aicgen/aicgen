import Anthropic from '@anthropic-ai/sdk';
import { AnalysisContext } from '../../project-analyzer';
import { BaseAIProvider } from './base-provider';
import { TimeoutError } from '../../shared/errors';

export class ClaudeProvider extends BaseAIProvider {
  private client: Anthropic;

  constructor(apiKey: string, options: { timeout?: number; maxRetries?: number } = {}) {
    super(apiKey, options);
    this.client = new Anthropic({
      apiKey,
      timeout: options.timeout || 30000,
      maxRetries: options.maxRetries || 3
    });
  }

  async analyze(_context: AnalysisContext, prompt: string): Promise<string> {
    try {
      const message = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 8096,
        messages: [{ role: 'user', content: prompt }]
      });

      const content = message.content[0];
      if (content.type === 'text') {
        return content.text;
      }
      throw new Error('Unexpected response format from Claude');
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('timeout') || error.message.includes('timed out')) {
          throw new TimeoutError('Claude', this.options.timeout);
        }
        throw new Error(`Claude API error: ${error.message}`);
      }
      throw error;
    }
  }
}
