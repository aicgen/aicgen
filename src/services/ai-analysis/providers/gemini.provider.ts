import { AnalysisContext } from '../../project-analyzer.js';
import { BaseAIProvider } from './base-provider.js';

export class GeminiProvider extends BaseAIProvider {
  async analyze(_context: AnalysisContext, prompt: string): Promise<string> {
    const response = await this.fetchWithErrorHandling(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      },
      'Gemini'
    );

    const data = await response.json() as { candidates: { content: { parts: { text: string }[] } }[] };
    return data.candidates[0].content.parts[0].text;
  }
}
