/**
 * OpenAI Provider
 *
 * Integration with OpenAI's Chat Completions API
 */

import { BaseAIProvider, type ProviderConfig } from './base-provider.js';
import type { AnalysisContext, AIAnalysisResult, ProviderCapabilities } from '../types.js';

/**
 * OpenAI provider implementation
 */
export class OpenAIProvider extends BaseAIProvider {
  readonly name = 'openai' as const;
  readonly apiEndpoint = 'https://api.openai.com/v1/chat/completions';
  readonly model: string;

  constructor(config: ProviderConfig) {
    super(config);
    this.model = config.model || 'gpt-4o';
  }

  /**
   * Analyze codebase with OpenAI
   */
  async analyze(context: AnalysisContext): Promise<AIAnalysisResult> {
    const prompt = this.buildPrompt(context);

    const response = await this.makeRequest(this.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(),
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return this.parseResponse(data);
  }

  /**
   * Validate OpenAI API credentials
   */
  async validateCredentials(): Promise<boolean> {
    try {
      const response = await this.makeRequest(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 5,
        }),
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Estimate tokens for context
   */
  estimateTokens(context: AnalysisContext): number {
    const prompt = this.buildPrompt(context);
    const systemPrompt = this.getSystemPrompt();

    // OpenAI uses ~4 chars per token on average
    return Math.ceil((prompt.length + systemPrompt.length) / 4);
  }

  /**
   * Estimate cost for tokens
   */
  estimateCost(tokens: number): number {
    const capabilities = this.getCapabilities();
    // Input tokens
    const inputCost = (tokens / 1_000_000) * capabilities.costPerMillionInputTokens;
    // Output tokens (estimate ~4k)
    const outputCost = (4000 / 1_000_000) * capabilities.costPerMillionOutputTokens;

    return inputCost + outputCost;
  }

  /**
   * Get provider capabilities
   */
  getCapabilities(): ProviderCapabilities {
    return {
      maxContextTokens: 128_000,
      maxOutputTokens: 4096,
      supportsJsonMode: true,
      supportsStreaming: true,
      costPerMillionInputTokens: 2.5, // $2.50 per 1M input tokens (gpt-4o)
      costPerMillionOutputTokens: 10.0, // $10 per 1M output tokens
    };
  }

  /**
   * Build analysis prompt from context
   */
  protected buildPrompt(context: AnalysisContext): string {
    const { staticAnalysis, sampledFiles } = context;

    let prompt = `# Codebase Analysis Request\n\n`;

    // Static analysis summary
    prompt += `## Static Analysis Results\n\n`;
    prompt += `**Primary Language**: ${staticAnalysis.languages.primary}\n`;
    prompt += `**All Languages**: ${staticAnalysis.languages.all.map(l => l.language).join(', ')}\n`;
    prompt += `**Confidence**: ${(staticAnalysis.languages.confidence * 100).toFixed(1)}%\n\n`;

    // Dependencies
    if (staticAnalysis.dependencies.packageManager) {
      prompt += `**Package Manager**: ${staticAnalysis.dependencies.packageManager}\n`;
      const depCount = Object.keys(staticAnalysis.dependencies.dependencies).length;
      prompt += `**Dependencies**: ${depCount} packages\n\n`;
    }

    // Structure
    prompt += `**Total Files**: ${staticAnalysis.structure.totalFiles}\n`;
    prompt += `**Estimated LOC**: ${staticAnalysis.structure.totalLines}\n`;
    prompt += `**Max Depth**: ${staticAnalysis.structure.depth}\n\n`;

    // Frameworks
    if (staticAnalysis.frameworks) {
      const allFrameworks = [
        ...(staticAnalysis.frameworks.frontend || []),
        ...(staticAnalysis.frameworks.backend || []),
        ...(staticAnalysis.frameworks.testing || []),
      ];
      if (allFrameworks.length > 0) {
        prompt += `**Detected Frameworks**: ${allFrameworks.join(', ')}\n\n`;
      }
    }

    // Sampled files
    prompt += `## Sampled Source Files (${sampledFiles.length} files)\n\n`;
    for (const file of sampledFiles) {
      prompt += `### File: ${file.path}\n`;
      prompt += `**Reason**: ${file.reason}\n`;
      prompt += `**Language**: ${file.language}\n`;
      prompt += `\`\`\`${file.language}\n${file.content}\n\`\`\`\n\n`;
    }

    prompt += `\n## Analysis Instructions\n\n`;
    prompt += `Based on the static analysis and sampled source files above, provide a comprehensive analysis of this codebase in JSON format.\n`;

    return prompt;
  }

  /**
   * Get system prompt for OpenAI
   */
  protected getSystemPrompt(): string {
    return `You are an expert software architect analyzing codebases. Your task is to analyze the provided codebase information and provide structured insights in JSON format.

Focus on:
1. Identifying the architectural pattern (layered, clean-architecture, hexagonal, mvc, mvvm, modular-monolith, microservices)
2. Classifying the project type (web-app, mobile-app, api, library, cli, monorepo, fullstack)
3. Assessing testing maturity
4. Suggesting relevant coding guidelines

Respond with a JSON object containing:
- architecture: { pattern: string, confidence: number }
- projectType: string
- frameworks: string[]
- testingMaturity: "none" | "basic" | "medium" | "high"
- suggestedGuidelines: string[]
- confidence: number
- reasoning: string
- backendStyle: string (optional)
- frontendStyle: string (optional)`;
  }

  /**
   * Parse OpenAI response into structured result
   */
  protected parseResponse(response: unknown): AIAnalysisResult {
    if (typeof response !== 'object' || response === null) {
      throw new Error('Invalid response from OpenAI API');
    }

    const data = response as any;

    // Extract content from OpenAI response
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No content in OpenAI response');
    }

    // Parse JSON from content
    try {
      const result = JSON.parse(content);

      return {
        architecture: result.architecture || { pattern: 'unknown', confidence: 0 },
        projectType: result.projectType || 'web-app',
        frameworks: result.frameworks || [],
        testingMaturity: result.testingMaturity || 'none',
        suggestedGuidelines: result.suggestedGuidelines || [],
        confidence: result.confidence || 0,
        reasoning: result.reasoning || '',
        backendStyle: result.backendStyle,
        frontendStyle: result.frontendStyle,
      };
    } catch (error) {
      throw new Error(`Failed to parse OpenAI response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
