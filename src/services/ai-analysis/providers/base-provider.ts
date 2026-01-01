import { AnalysisContext } from '../../project-analyzer';

export interface AIProvider {
  analyze(context: AnalysisContext, prompt: string): Promise<string>;
}

export interface ProviderOptions {
  timeout?: number;
  maxRetries?: number;
}

export abstract class BaseAIProvider implements AIProvider {
  protected options: Required<ProviderOptions>;

  constructor(
    protected apiKey: string,
    options: ProviderOptions = {}
  ) {
    this.options = {
      timeout: options.timeout ?? 30000,
      maxRetries: options.maxRetries ?? 3
    };
  }

  abstract analyze(context: AnalysisContext, prompt: string): Promise<string>;
}
