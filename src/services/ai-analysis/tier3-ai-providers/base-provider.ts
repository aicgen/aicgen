/**
 * Base AI Provider
 *
 * Abstract base class for all AI provider implementations
 */

import type {
  AIProvider,
  AnalysisContext,
  AIAnalysisResult,
  ProviderCapabilities,
} from '../types.js';

/**
 * Provider configuration
 */
export interface ProviderConfig {
  apiKey: string;
  model?: string;
  timeout?: number;
  maxRetries?: number;
}

/**
 * Base AI provider implementation
 */
export abstract class BaseAIProvider implements AIProvider {
  abstract readonly name: 'claude' | 'openai' | 'gemini';
  abstract readonly apiEndpoint: string;
  abstract readonly model: string;

  protected readonly apiKey: string;
  protected readonly timeout: number;
  protected readonly maxRetries: number;

  constructor(config: ProviderConfig) {
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || 60000; // 60s default
    this.maxRetries = config.maxRetries || 3;
  }

  /**
   * Analyze codebase with AI
   */
  abstract analyze(context: AnalysisContext): Promise<AIAnalysisResult>;

  /**
   * Check if provider is configured
   */
  async isConfigured(): Promise<boolean> {
    return !!this.apiKey;
  }

  /**
   * Validate API credentials
   */
  abstract validateCredentials(): Promise<boolean>;

  /**
   * Estimate tokens for context
   */
  abstract estimateTokens(context: AnalysisContext): number;

  /**
   * Estimate cost in USD for tokens
   */
  abstract estimateCost(tokens: number): number;

  /**
   * Get provider capabilities
   */
  abstract getCapabilities(): ProviderCapabilities;

  /**
   * Build prompt from analysis context
   */
  protected abstract buildPrompt(context: AnalysisContext): string;

  /**
   * Parse AI response into structured result
   */
  protected abstract parseResponse(response: unknown): AIAnalysisResult;

  /**
   * Make HTTP request with retry logic
   */
  protected async makeRequest(
    url: string,
    options: RequestInit,
    retries = this.maxRetries
  ): Promise<Response> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Handle rate limiting
        if (response.status === 429 && attempt < retries) {
          const retryAfter = parseInt(response.headers.get('retry-after') || '5', 10);
          await this.sleep(retryAfter * 1000);
          continue;
        }

        // Handle server errors with retry
        if (response.status >= 500 && attempt < retries) {
          await this.sleep(Math.pow(2, attempt) * 1000); // Exponential backoff
          continue;
        }

        return response;
      } catch (error) {
        if (attempt === retries) {
          throw error;
        }
        // Exponential backoff
        await this.sleep(Math.pow(2, attempt) * 1000);
      }
    }

    throw new Error('Max retries exceeded');
  }

  /**
   * Sleep for specified milliseconds
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Estimate tokens from text (simple approximation: ~3.5 chars per token)
   */
  protected estimateTokensFromText(text: string): number {
    return Math.ceil(text.length / 3.5);
  }
}
