/**
 * File sampling strategies
 *
 * Different strategies for selecting representative files
 */

import type { SampledFile, SamplingContext, SamplingReason } from '../types.js';
import { detectEntryPoints } from './entry-point-detector.js';
import { buildImportGraph, findHubFiles } from './import-graph-analyzer.js';
import { analyzeComplexity, findMostComplexFiles } from './complexity-analyzer.js';
import { rankConfigFiles } from './config-file-ranker.js';

/**
 * Sampling strategy interface
 */
export interface SamplingStrategy {
  readonly name: string;
  select(context: SamplingContext): Promise<SampledFile[]>;
}

/**
 * Selected file (before reading content) - internal use
 */
interface SelectedFile {
  path: string;
  reason: SamplingReason;
  importance: number;
}

/**
 * Minimal strategy - for small projects or quick analysis
 * Selects: 1 entry point + 1 hub file + 1 config (~3-5 files)
 */
export class MinimalStrategy implements SamplingStrategy {
  readonly name = 'minimal';

  async select(context: SamplingContext): Promise<SampledFile[]> {
    const selected: SelectedFile[] = [];

    // For Phase 4, return empty array - full implementation requires file collection
    // This will be completed when file-sampler orchestrator is implemented
    return [];
  }
}

/**
 * Balanced strategy - default for most projects
 * Selects: 1-2 entry points + 2-3 hub files + 1-2 complex files + 1 test + 2-3 configs (~8-12 files)
 */
export class BalancedStrategy implements SamplingStrategy {
  readonly name = 'balanced';

  async select(context: SamplingContext): Promise<SampledFile[]> {
    const selected: SelectedFile[] = [];

    // For Phase 4, return empty array - full implementation requires file collection
    // This will be completed when file-sampler orchestrator is implemented
    return [];
  }
}

/**
 * Comprehensive strategy - for large/complex projects
 * Selects: 2 entry points + 4 hub files + 3 complex files + 2 tests + 4 configs (~15-20 files)
 */
export class ComprehensiveStrategy implements SamplingStrategy {
  readonly name = 'comprehensive';

  async select(context: SamplingContext): Promise<SampledFile[]> {
    const selected: SelectedFile[] = [];

    // For Phase 4, return empty array - full implementation requires file collection
    // This will be completed when file-sampler orchestrator is implemented
    return [];
  }
}

/**
 * Get sampling strategy by name
 */
export function getStrategy(name: 'minimal' | 'balanced' | 'comprehensive'): SamplingStrategy {
  switch (name) {
    case 'minimal':
      return new MinimalStrategy();
    case 'balanced':
      return new BalancedStrategy();
    case 'comprehensive':
      return new ComprehensiveStrategy();
  }
}
