import { GoogleGenerativeAI } from '@google/generative-ai';
import { AnalysisContext } from '../../project-analyzer';
import { BaseAIProvider } from './base-provider';
import { TimeoutError } from '../../shared/errors';

export class GeminiProvider extends BaseAIProvider {
  private client: GoogleGenerativeAI;

  constructor(apiKey: string, options: { timeout?: number; maxRetries?: number } = {}) {
    super(apiKey, options);
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async analyze(_context: AnalysisContext, prompt: string): Promise<string> {
    try {
      const model = this.client.getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: {
          responseMimeType: 'application/json'
        }
      });

      const result = await model.generateContent(prompt);
      const response = result.response;
      return response.text();
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('timeout') || error.message.includes('timed out')) {
          throw new TimeoutError('Gemini', this.options.timeout);
        }
        throw new Error(`Gemini API error: ${error.message}`);
      }
      throw error;
    }
  }
}
