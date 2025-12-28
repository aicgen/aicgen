/**
 * AI Analysis Service
 *
 * Bridge between CLI config and AI analyzer
 */

import { CONFIG } from '../config.js';
import { AIAnalyzer } from './ai-analysis/ai-analyzer.js';
import type { ProviderConfigMap } from './ai-analysis/tier3-ai-providers/index.js';
import { homedir } from 'os';
import { join } from 'path';

/**
 * Create AI analyzer from user configuration
 */
export function createAIAnalyzer(): AIAnalyzer | null {
  const providerConfigs: ProviderConfigMap = {};

  // Load provider configs from environment variables or config
  const claudeApiKey = process.env.ANTHROPIC_API_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;

  // Configure Claude provider
  if (claudeApiKey) {
    providerConfigs.claude = {
      apiKey: claudeApiKey,
      model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
    };
  }

  // Configure OpenAI provider
  if (openaiApiKey) {
    providerConfigs.openai = {
      apiKey: openaiApiKey,
      model: process.env.OPENAI_MODEL || 'gpt-4o',
    };
  }

  // Configure Gemini provider
  if (geminiApiKey) {
    providerConfigs.gemini = {
      apiKey: geminiApiKey,
      model: process.env.GEMINI_MODEL || 'gemini-1.5-pro',
    };
  }

  // If no providers configured, return null
  if (Object.keys(providerConfigs).length === 0) {
    return null;
  }

  // Create analyzer with cache path
  const cachePath = join(homedir(), '.aicgen', 'cache', 'analysis');
  return new AIAnalyzer(providerConfigs, cachePath);
}

/**
 * Check if AI analysis is available
 */
export function isAIAnalysisAvailable(): boolean {
  return !!(
    process.env.ANTHROPIC_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.GEMINI_API_KEY
  );
}

/**
 * Get configured AI provider names
 */
export function getConfiguredProviders(): string[] {
  const providers: string[] = [];

  if (process.env.ANTHROPIC_API_KEY) providers.push('Claude');
  if (process.env.OPENAI_API_KEY) providers.push('OpenAI');
  if (process.env.GEMINI_API_KEY) providers.push('Gemini');

  return providers;
}
