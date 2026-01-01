import { AnalysisContext } from '../../project-analyzer.js';

export interface AIProvider {
  analyze(context: AnalysisContext, prompt: string): Promise<string>;
}

export abstract class BaseAIProvider implements AIProvider {
  constructor(protected apiKey: string) {}

  abstract analyze(context: AnalysisContext, prompt: string): Promise<string>;

  protected async fetchWithErrorHandling(
    url: string,
    options: RequestInit,
    providerName: string
  ): Promise<Response> {
    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`${providerName} API error: ${response.statusText}`);
    }

    return response;
  }
}
