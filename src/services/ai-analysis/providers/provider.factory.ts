import { AIAssistant } from '../../../models/project';
import { AIProvider, ProviderOptions } from './base-provider';
import { ClaudeProvider } from './claude.provider';
import { GeminiProvider } from './gemini.provider';
import { OpenAIProvider } from './openai.provider';

export class ProviderFactory {
  static create(
    assistant: AIAssistant,
    apiKey: string,
    options?: ProviderOptions
  ): AIProvider {
    if (assistant === 'claude-code' || assistant === 'antigravity') {
      return new ClaudeProvider(apiKey, options);
    }

    if (assistant === 'gemini') {
      return new GeminiProvider(apiKey, options);
    }

    if (assistant === 'codex' || assistant === 'copilot') {
      return new OpenAIProvider(apiKey, options);
    }

    throw new Error(`Provider ${assistant} not supported for analysis yet.`);
  }
}
