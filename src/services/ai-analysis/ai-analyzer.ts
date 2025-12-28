/**
 * Main AI Analyzer Orchestrator
 *
 * Coordinates static analysis, file sampling, and AI analysis
 */

import type { AnalysisResult, AnalysisOptions, AnalysisContext } from './types.js';
import { runStaticAnalysis } from './tier1-static/static-analyzer.js';
import { sampleFiles } from './tier2-sampling/file-sampler.js';
import { ProviderFactory, type ProviderConfigMap } from './tier3-ai-providers/index.js';
import { generateFingerprint } from './tier0-fingerprint/fingerprint-generator.js';
import { FingerprintCache } from './tier0-fingerprint/fingerprint-cache.js';

/**
 * Main AI-powered codebase analyzer
 */
export class AIAnalyzer {
  private providerConfigs: ProviderConfigMap;
  private cache: FingerprintCache;

  constructor(providerConfigs: ProviderConfigMap, cachePath?: string) {
    this.providerConfigs = providerConfigs;
    this.cache = new FingerprintCache(cachePath);
  }

  /**
   * Run complete analysis on a project
   *
   * @param projectPath - Absolute path to project root
   * @param options - Analysis options
   * @returns Complete analysis result
   */
  async analyze(
    projectPath: string,
    options?: AnalysisOptions
  ): Promise<AnalysisResult> {
    const startTime = Date.now();

    // Step 1: Generate fingerprint
    const fingerprint = await generateFingerprint(projectPath);

    // Step 2: Check cache
    if (options?.useCache !== false) {
      const cached = await this.cache.get(fingerprint.hash);
      if (cached) {
        return {
          ...cached,
          fromCache: true,
          executionTime: Date.now() - startTime,
        };
      }
    }

    // Step 3: Run static analysis (Tier 1)
    const staticAnalysis = await runStaticAnalysis(projectPath);

    // Step 4: Sample files (Tier 2)
    const sampledFiles = await sampleFiles(projectPath, staticAnalysis, {
      maxFiles: options?.maxSampledFiles || 12,
      maxTokens: options?.maxTokens || 8000,
      includeTests: options?.includeTests ?? false,
      strategy: options?.samplingStrategy || 'balanced',
    });

    // Step 5: Build analysis context
    const context: AnalysisContext = {
      staticAnalysis,
      sampledFiles,
      projectPath,
      hints: options?.hints,
    };

    // Step 6: Select and run AI provider (Tier 3)
    let provider;
    if (options?.preferredProvider) {
      const config = this.providerConfigs[options.preferredProvider];
      if (!config) {
        throw new Error(`Provider ${options.preferredProvider} not configured`);
      }
      provider = ProviderFactory.create(options.preferredProvider, config);
    } else {
      // Auto-select based on context size
      const estimatedTokens = this.estimateContextTokens(context);
      provider = ProviderFactory.selectForContextSize(this.providerConfigs, estimatedTokens);
    }

    // Run AI analysis
    const aiAnalysis = await provider.analyze(context);

    // Step 7: Merge results
    const result: AnalysisResult = {
      // AI analysis results
      architecture: aiAnalysis.architecture,
      projectType: aiAnalysis.projectType,
      testingMaturity: aiAnalysis.testingMaturity,
      suggestedGuidelines: aiAnalysis.suggestedGuidelines,

      // Static analysis results
      staticAnalysis,

      // Metadata
      provider: provider.name,
      fingerprint: fingerprint.hash,
      fromCache: false,
      executionTime: Date.now() - startTime,

      // AI insights
      reasoning: aiAnalysis.reasoning,
      backendStyle: aiAnalysis.backendStyle,
      frontendStyle: aiAnalysis.frontendStyle,

      // Combined confidence
      confidence: (staticAnalysis.confidence + aiAnalysis.confidence) / 2,
    };

    // Step 8: Cache result
    if (options?.useCache !== false) {
      await this.cache.set(fingerprint.hash, result);
    }

    return result;
  }

  /**
   * Run static analysis only (no AI)
   */
  async analyzeStatic(projectPath: string): Promise<AnalysisResult> {
    const startTime = Date.now();
    const staticAnalysis = await runStaticAnalysis(projectPath);

    return {
      architecture: { pattern: 'unknown', confidence: 0 },
      projectType: 'web-app',
      testingMaturity: 'none',
      suggestedGuidelines: [],
      staticAnalysis,
      provider: 'none',
      fingerprint: '',
      fromCache: false,
      executionTime: Date.now() - startTime,
      reasoning: 'Static analysis only',
      confidence: staticAnalysis.confidence,
    };
  }

  /**
   * Estimate context tokens for provider selection
   */
  private estimateContextTokens(context: AnalysisContext): number {
    // Estimate static analysis: ~2k tokens
    let tokens = 2000;

    // Add sampled file tokens
    for (const file of context.sampledFiles) {
      tokens += file.estimatedTokens;
    }

    return tokens;
  }

  /**
   * Clear analysis cache
   */
  async clearCache(): Promise<void> {
    await this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    return this.cache.getStats();
  }
}
