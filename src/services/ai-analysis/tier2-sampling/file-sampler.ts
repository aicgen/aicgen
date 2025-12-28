/**
 * Main file sampling orchestrator
 *
 * Intelligently selects 8-12 representative files for AI analysis
 */

import type { SampledFile, SamplingContext, StaticAnalysisResult } from '../types.js';
import { getStrategy } from './sampling-strategies.js';

/**
 * Sample files from project for AI analysis
 *
 * @param projectPath - Absolute path to project root
 * @param staticAnalysis - Results from static analysis
 * @param options - Sampling options
 * @returns Array of sampled files with content
 */
export async function sampleFiles(
  projectPath: string,
  staticAnalysis: StaticAnalysisResult,
  options?: {
    maxFiles?: number;
    maxTokens?: number;
    includeTests?: boolean;
    strategy?: 'minimal' | 'balanced' | 'comprehensive';
  }
): Promise<SampledFile[]> {
  // Build sampling context
  const context: SamplingContext = {
    projectPath,
    staticAnalysis,
    maxFiles: options?.maxFiles || 12,
    maxTokens: options?.maxTokens || 8000,
    includeTests: options?.includeTests ?? false,
    language: staticAnalysis.languages.primary,
  };

  // Get sampling strategy
  const strategyName = options?.strategy || 'balanced';
  const strategy = getStrategy(strategyName);

  // Apply strategy to select files
  const sampledFiles = await strategy.select(context);

  // For Phase 4 initial implementation, return empty array
  // Full implementation will read file contents and estimate tokens
  return sampledFiles;
}
