/**
 * AI Provider Factory
 *
 * Creates and manages AI provider instances
 */

import type { AIProvider } from '../types.js';
import { ClaudeProvider } from './claude-provider.js';
import { OpenAIProvider } from './openai-provider.js';
import { GeminiProvider } from './gemini-provider.js';
import type { ProviderConfig } from './base-provider.js';

/**
 * Provider configuration map
 */
export interface ProviderConfigMap {
  claude?: ProviderConfig;
  openai?: ProviderConfig;
  gemini?: ProviderConfig;
}

/**
 * Provider factory for creating AI provider instances
 */
export class ProviderFactory {
  /**
   * Create a specific AI provider
   */
  static create(
    name: 'claude' | 'openai' | 'gemini',
    config: ProviderConfig
  ): AIProvider {
    switch (name) {
      case 'claude':
        return new ClaudeProvider(config);
      case 'openai':
        return new OpenAIProvider(config);
      case 'gemini':
        return new GeminiProvider(config);
      default:
        throw new Error(`Unknown provider: ${name}`);
    }
  }

  /**
   * Create all configured providers
   */
  static createAll(configs: ProviderConfigMap): AIProvider[] {
    const providers: AIProvider[] = [];

    if (configs.claude) {
      providers.push(new ClaudeProvider(configs.claude));
    }
    if (configs.openai) {
      providers.push(new OpenAIProvider(configs.openai));
    }
    if (configs.gemini) {
      providers.push(new GeminiProvider(configs.gemini));
    }

    return providers;
  }

  /**
   * Get default provider (Claude)
   */
  static getDefault(configs: ProviderConfigMap): AIProvider {
    // Prefer Claude
    if (configs.claude) {
      return new ClaudeProvider(configs.claude);
    }

    // Fall back to OpenAI
    if (configs.openai) {
      return new OpenAIProvider(configs.openai);
    }

    // Fall back to Gemini
    if (configs.gemini) {
      return new GeminiProvider(configs.gemini);
    }

    throw new Error('No AI provider configured');
  }

  /**
   * Auto-select best provider for context size
   */
  static selectForContextSize(
    configs: ProviderConfigMap,
    estimatedTokens: number
  ): AIProvider {
    const providers = this.createAll(configs);

    if (providers.length === 0) {
      throw new Error('No AI providers configured');
    }

    // If tokens > 200k, prefer Gemini (1M context)
    if (estimatedTokens > 200_000) {
      const gemini = providers.find(p => p.name === 'gemini');
      if (gemini) return gemini;
    }

    // If tokens > 128k, prefer Claude (200k context)
    if (estimatedTokens > 128_000) {
      const claude = providers.find(p => p.name === 'claude');
      if (claude) return claude;
    }

    // Default: return first available provider
    return providers[0];
  }

  /**
   * Select cheapest provider
   */
  static selectCheapest(configs: ProviderConfigMap): AIProvider {
    const providers = this.createAll(configs);

    if (providers.length === 0) {
      throw new Error('No AI providers configured');
    }

    // Sort by cost (Gemini is cheapest)
    const sorted = providers.sort((a, b) => {
      const costA = a.getCapabilities().costPerMillionInputTokens;
      const costB = b.getCapabilities().costPerMillionInputTokens;
      return costA - costB;
    });

    return sorted[0];
  }
}
