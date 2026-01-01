import { AnalysisContext } from '../../project-analyzer.js';
import { BaseAIProvider } from './base-provider.js';

export class OpenAIProvider extends BaseAIProvider {
  async analyze(_context: AnalysisContext, prompt: string): Promise<string> {
    const response = await this.fetchWithErrorHandling(
      'https://api.openai.com/v1/chat/completions',
      {
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
      },
      'OpenAI'
    );

    const data = await response.json() as { choices: { message: { content: string } }[] };
    return data.choices[0].message.content;
  }
}
