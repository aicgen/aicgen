import { AIProviderLike, normalizeAIProvider } from '../../../models/ai-provider.js';
import { AIProvider, ProviderOptions } from './base-provider';
import { ClaudeProvider } from './claude.provider';
import { GeminiProvider } from './gemini.provider';
import { OpenAIProvider } from './openai.provider';

export class ProviderFactory {
  static create(
    provider: AIProviderLike,
    apiKey: string,
    options?: ProviderOptions
  ): AIProvider {
    switch (normalizeAIProvider(provider)) {
      case 'anthropic':
        return new ClaudeProvider(apiKey, options);
      case 'google':
        return new GeminiProvider(apiKey, options);
      case 'openai':
        return new OpenAIProvider(apiKey, options);
    }
  }
}
