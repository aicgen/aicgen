/**
 * Claude AI Provider
 *
 * Integration with Anthropic's Claude API
 */

import { BaseAIProvider, type ProviderConfig } from './base-provider.js';
import type { AnalysisContext, AIAnalysisResult, ProviderCapabilities } from '../types.js';

/**
 * Claude provider implementation
 */
export class ClaudeProvider extends BaseAIProvider {
  readonly name = 'claude' as const;
  readonly apiEndpoint = 'https://api.anthropic.com/v1/messages';
  readonly model: string;

  constructor(config: ProviderConfig) {
    super(config);
    this.model = config.model || 'claude-3-5-sonnet-20241022';
  }

  /**
   * Analyze codebase with Claude
   */
  async analyze(context: AnalysisContext): Promise<AIAnalysisResult> {
    const prompt = this.buildPrompt(context);

    const response = await this.makeRequest(this.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        system: this.getSystemPrompt(),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return this.parseResponse(data);
  }

  /**
   * Validate Claude API credentials
   */
  async validateCredentials(): Promise<boolean> {
    try {
      const response = await this.makeRequest(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'test' }],
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

    return this.estimateTokensFromText(prompt + systemPrompt);
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
      maxContextTokens: 200_000,
      maxOutputTokens: 8192,
      supportsJsonMode: true,
      supportsStreaming: true,
      costPerMillionInputTokens: 3.0, // $3 per 1M input tokens
      costPerMillionOutputTokens: 15.0, // $15 per 1M output tokens
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
    prompt += `Based on the static analysis and sampled source files above, provide a comprehensive analysis of this codebase in JSON format.\n\n`;
    prompt += `Your response must be valid JSON matching this schema:\n`;
    prompt += `{\n`;
    prompt += `  "architecture": { "pattern": "...", "confidence": 0.0-1.0 },\n`;
    prompt += `  "projectType": "...",\n`;
    prompt += `  "frameworks": [...],\n`;
    prompt += `  "testingMaturity": "none|basic|medium|high",\n`;
    prompt += `  "suggestedGuidelines": [...],\n`;
    prompt += `  "confidence": 0.0-1.0,\n`;
    prompt += `  "reasoning": "...",\n`;
    prompt += `  "backendStyle": "...",\n`;
    prompt += `  "frontendStyle": "..."\n`;
    prompt += `}\n`;

    return prompt;
  }

  /**
   * Get system prompt for Claude
   */
  protected getSystemPrompt(): string {
    return `You are an expert software architect analyzing codebases. Your task is to analyze the provided codebase information and provide structured insights.

Focus on:
1. Identifying the architectural pattern (layered, clean-architecture, hexagonal, mvc, mvvm, modular-monolith, microservices)
2. Classifying the project type (web-app, mobile-app, api, library, cli, monorepo, fullstack)
3. Assessing testing maturity
4. Suggesting relevant coding guidelines

Respond ONLY with valid JSON. Do not include any text before or after the JSON object.`;
  }

  /**
   * Parse Claude response into structured result
   */
  protected parseResponse(response: unknown): AIAnalysisResult {
    if (typeof response !== 'object' || response === null) {
      throw new Error('Invalid response from Claude API');
    }

    const data = response as any;

    // Extract content from Claude response
    const content = data.content?.[0]?.text;
    if (!content) {
      throw new Error('No content in Claude response');
    }

    // Parse JSON from content
    try {
      // Extract JSON from code blocks if present
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/{[\s\S]*}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;

      const result = JSON.parse(jsonStr);

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
      throw new Error(`Failed to parse Claude response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
