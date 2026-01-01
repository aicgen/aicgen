import { AnalysisContext } from '../../project-analyzer.js';
import { BaseAIProvider } from './base-provider.js';

export class ClaudeProvider extends BaseAIProvider {
  async analyze(_context: AnalysisContext, prompt: string): Promise<string> {
    const response = await this.fetchWithErrorHandling(
      'https://api.anthropic.com/v1/messages',
      {
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
      },
      'Claude'
    );

    const data = await response.json() as { content: { text: string }[] };
    return data.content[0].text;
  }
}
