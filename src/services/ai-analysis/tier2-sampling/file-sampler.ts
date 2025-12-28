import type { SampledFile, SamplingContext, StaticAnalysisResult } from '../types.js';
import { getStrategy } from './sampling-strategies.js';
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
  const context: SamplingContext = {
    projectPath,
    staticAnalysis,
    maxFiles: options?.maxFiles || 12,
    maxTokens: options?.maxTokens || 8000,
    includeTests: options?.includeTests ?? false,
    language: staticAnalysis.languages.primary,
  };

  const strategyName = options?.strategy || 'balanced';
  const strategy = getStrategy(strategyName);

  return await strategy.select(context);
}
