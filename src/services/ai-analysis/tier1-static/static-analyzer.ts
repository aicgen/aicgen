/**
 * Main static analysis orchestrator
 *
 * Coordinates all static analysis components and runs them in parallel
 */

import type { StaticAnalysisResult } from '../types.js';
import { detectLanguages } from './language-detector.js';
import { analyzeDependencies } from './dependency-analyzer.js';
import { analyzeStructure } from './structure-analyzer.js';
import { detectFrameworks } from './framework-detector.js';
import { detectBuildTools } from './build-tool-detector.js';
import { detectMonorepo } from './monorepo-detector.js';
import { analyzeConfigs } from './config-analyzer.js';

/**
 * Run complete static analysis on project
 *
 * Runs all 7 analyzers in parallel for maximum performance
 *
 * @param projectPath - Absolute path to project root
 * @returns Complete static analysis result
 */
export async function runStaticAnalysis(projectPath: string): Promise<StaticAnalysisResult> {
  const startTime = Date.now();

  // Run all analyzers in parallel for maximum performance
  const [
    languageResult,
    dependencyResult,
    structureResult,
    frameworkResult,
    buildToolResult,
    monorepoResult,
    configResult,
  ] = await Promise.all([
    detectLanguages(projectPath),
    analyzeDependencies(projectPath),
    analyzeStructure(projectPath),
    detectFrameworks(projectPath),
    detectBuildTools(projectPath),
    detectMonorepo(projectPath),
    analyzeConfigs(projectPath),
  ]);

  const executionTime = Date.now() - startTime;

  // Calculate overall confidence based on all analyses
  const confidence = calculateOverallConfidence({
    languageResult,
    dependencyResult,
    structureResult,
    frameworkResult,
    buildToolResult,
    monorepoResult,
    configResult,
  });

  return {
    languages: languageResult,
    dependencies: dependencyResult,
    structure: structureResult,
    frameworks: frameworkResult,
    buildTools: buildToolResult,
    monorepo: monorepoResult,
    configs: configResult,
    executionTime,
    confidence,
  };
}

/**
 * Calculate overall confidence score based on all analysis results
 */
function calculateOverallConfidence(results: {
  languageResult: Awaited<ReturnType<typeof detectLanguages>>;
  dependencyResult: Awaited<ReturnType<typeof analyzeDependencies>>;
  structureResult: Awaited<ReturnType<typeof analyzeStructure>>;
  frameworkResult: Awaited<ReturnType<typeof detectFrameworks>>;
  buildToolResult: Awaited<ReturnType<typeof detectBuildTools>>;
  monorepoResult: Awaited<ReturnType<typeof detectMonorepo>>;
  configResult: Awaited<ReturnType<typeof analyzeConfigs>>;
}): number {
  const {
    languageResult,
    dependencyResult,
    structureResult,
    frameworkResult,
    buildToolResult,
    monorepoResult,
    configResult,
  } = results;

  // Start with language detection confidence
  let totalConfidence = languageResult.confidence;
  let weights = 1.0;

  // Add confidence from dependency detection (if lockfile present, higher confidence)
  if (dependencyResult.lockfilePresent) {
    totalConfidence += 0.9;
    weights += 1.0;
  } else if (Object.keys(dependencyResult.dependencies).length > 0) {
    totalConfidence += 0.6;
    weights += 1.0;
  }

  // Add confidence from structure analysis (if common patterns detected)
  const patternCount = Object.values(structureResult.patterns).filter(Boolean).length;
  if (patternCount > 0) {
    const structureConfidence = Math.min(patternCount / 5, 1.0);
    totalConfidence += structureConfidence;
    weights += 1.0;
  }

  // Add confidence from framework detection
  const frameworkCount = [
    ...(frameworkResult.frontend || []),
    ...(frameworkResult.backend || []),
    ...(frameworkResult.testing || []),
    ...(frameworkResult.orm || []),
    ...(frameworkResult.stateManagement || []),
    ...(frameworkResult.ui || []),
    ...(frameworkResult.bundlers || []),
  ].length;
  if (frameworkCount > 0) {
    totalConfidence += 0.8;
    weights += 1.0;
  }

  // Add confidence from build tools
  const hasBuildTools = !!(
    buildToolResult.bundler ||
    buildToolResult.monorepoTool ||
    buildToolResult.taskRunner ||
    (buildToolResult.containerization && buildToolResult.containerization.length > 0) ||
    (buildToolResult.ci && buildToolResult.ci.length > 0)
  );
  if (hasBuildTools) {
    totalConfidence += 0.7;
    weights += 1.0;
  }

  // Add confidence from monorepo detection
  if (monorepoResult.isMonorepo && monorepoResult.tool) {
    totalConfidence += 0.9;
    weights += 1.0;
  }

  // Add confidence from config detection
  const configCount = configResult.configs.length;
  if (configCount > 0) {
    const configConfidence = Math.min(configCount / 5, 0.8);
    totalConfidence += configConfidence;
    weights += 1.0;
  }

  // Calculate weighted average
  const averageConfidence = totalConfidence / weights;

  // Ensure confidence is between 0 and 1
  return Math.max(0, Math.min(1, averageConfidence));
}
