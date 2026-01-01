import { AIAssistant } from '../../../models/project.js';
import { AIProvider } from './base-provider.js';
import { ClaudeProvider } from './claude.provider.js';
import { GeminiProvider } from './gemini.provider.js';
import { OpenAIProvider } from './openai.provider.js';

export class ProviderFactory {
  static create(assistant: AIAssistant, apiKey: string): AIProvider {
    if (assistant === 'claude-code' || assistant === 'antigravity') {
      return new ClaudeProvider(apiKey);
    }

    if (assistant === 'gemini') {
      return new GeminiProvider(apiKey);
    }

    if (assistant === 'codex' || assistant === 'copilot') {
      return new OpenAIProvider(apiKey);
    }

    throw new Error(`Provider ${assistant} not supported for analysis yet.`);
  }
}
