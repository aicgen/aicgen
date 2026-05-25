import { AIAssistant } from './project.js';

export type AIProviderId = 'anthropic' | 'google' | 'openai';
export type AIProviderLike = AIProviderId | AIAssistant;

export function normalizeAIProvider(provider: AIProviderLike): AIProviderId {
  switch (provider) {
    case 'anthropic':
    case 'claude-code':
      return 'anthropic';
    case 'google':
    case 'antigravity':
      return 'google';
    case 'openai':
    case 'codex':
    case 'copilot':
      return 'openai';
  }
}

export function getAIProviderDisplayName(provider: AIProviderId): string {
  switch (provider) {
    case 'anthropic':
      return 'Claude (Anthropic)';
    case 'google':
      return 'Gemini (Google)';
    case 'openai':
      return 'OpenAI';
  }
}
