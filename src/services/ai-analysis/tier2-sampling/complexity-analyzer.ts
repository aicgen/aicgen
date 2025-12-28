/**
 * Code complexity analysis
 *
 * Analyzes cyclomatic complexity to find complex files
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import type { ComplexityResult } from '../types.js';
import type { Language } from '../../../models/project.js';

/**
 * Analyze complexity of source files
 *
 * Uses lightweight regex-based analysis for speed (no AST parsing)
 *
 * @param projectPath - Absolute path to project root
 * @param files - List of file paths to analyze (relative to project root)
 * @param language - Primary language
 * @returns Array of complexity results
 */
export async function analyzeComplexity(
  projectPath: string,
  files: string[],
  language: Language
): Promise<ComplexityResult[]> {
  const results: ComplexityResult[] = [];

  for (const file of files) {
    const fullPath = join(projectPath, file);
    if (!existsSync(fullPath)) {
      continue;
    }

    try {
      const content = await readFile(fullPath, 'utf-8');
      const result = analyzeFileComplexity(content, file, language);
      results.push(result);
    } catch {
      // Failed to read file, skip
    }
  }

  return results;
}

/**
 * Analyze complexity of a single file
 */
function analyzeFileComplexity(content: string, filePath: string, language: Language): ComplexityResult {
  const lines = content.split('\n');
  const nonEmptyLines = lines.filter(line => line.trim().length > 0).length;

  const functionCount = countFunctions(content, language);
  const cyclomaticComplexity = calculateCyclomaticComplexity(content, language);
  const cognitiveComplexity = calculateCognitiveComplexity(content, language);

  return {
    file: filePath,
    cyclomaticComplexity,
    cognitiveComplexity,
    lines: nonEmptyLines,
    functions: functionCount,
  };
}

/**
 * Count function definitions
 */
function countFunctions(content: string, language: Language): number {
  const patterns: Record<string, RegExp[]> = {
    typescript: [
      /function\s+\w+/g,
      /const\s+\w+\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=]+)\s*=>/g,
      /\w+\s*\([^)]*\)\s*{/g, // method definitions
    ],
    javascript: [
      /function\s+\w+/g,
      /const\s+\w+\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=]+)\s*=>/g,
      /\w+\s*\([^)]*\)\s*{/g,
    ],
    python: [/^def\s+\w+/gm, /^async\s+def\s+\w+/gm],
    go: [/func\s+(?:\([^)]*\)\s+)?\w+/g],
    rust: [/fn\s+\w+/g],
    java: [/(?:public|private|protected)?\s*(?:static)?\s*\w+\s+\w+\s*\(/g],
    csharp: [/(?:public|private|protected)?\s*(?:static)?\s*\w+\s+\w+\s*\(/g],
    ruby: [/def\s+\w+/g],
  };

  const languagePatterns = patterns[language] || [];
  let count = 0;

  for (const pattern of languagePatterns) {
    const matches = content.match(pattern);
    if (matches) {
      count += matches.length;
    }
  }

  return count;
}

/**
 * Calculate cyclomatic complexity (simplified - counts decision points)
 */
function calculateCyclomaticComplexity(content: string, language: Language): number {
  const decisionKeywords: Record<string, string[]> = {
    typescript: ['if', 'else if', 'for', 'while', 'case', '&&', '||', '?', 'catch'],
    javascript: ['if', 'else if', 'for', 'while', 'case', '&&', '||', '?', 'catch'],
    python: ['if', 'elif', 'for', 'while', 'except', 'and', 'or'],
    go: ['if', 'for', 'case', '&&', '||'],
    rust: ['if', 'match', 'while', 'for', '&&', '||'],
    java: ['if', 'else if', 'for', 'while', 'case', '&&', '||', '?', 'catch'],
    csharp: ['if', 'else if', 'for', 'while', 'case', '&&', '||', '?', 'catch'],
    ruby: ['if', 'elsif', 'while', 'for', 'case', 'rescue'],
  };

  const keywords = decisionKeywords[language] || decisionKeywords.javascript;
  let complexity = 1; // Base complexity

  for (const keyword of keywords) {
    // Create regex for whole word matching
    const pattern = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
    const matches = content.match(pattern);
    if (matches) {
      complexity += matches.length;
    }
  }

  return complexity;
}

/**
 * Calculate cognitive complexity (weighs nesting and structure)
 */
function calculateCognitiveComplexity(content: string, language: Language): number {
  // Simplified cognitive complexity: cyclomatic complexity + nesting depth estimate
  const cyclomatic = calculateCyclomaticComplexity(content, language);

  // Estimate nesting depth by counting opening braces/indentation
  const lines = content.split('\n');
  let maxNesting = 0;
  let currentNesting = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    // Count opening and closing braces
    const openBraces = (trimmed.match(/{/g) || []).length;
    const closeBraces = (trimmed.match(/}/g) || []).length;

    currentNesting += openBraces - closeBraces;
    maxNesting = Math.max(maxNesting, currentNesting);
  }

  // Cognitive complexity = cyclomatic + (max nesting * 2)
  return cyclomatic + maxNesting * 2;
}

/**
 * Find most complex files
 *
 * @param results - Complexity analysis results
 * @param limit - Maximum number of files to return
 * @returns Array of file paths ranked by complexity
 */
export function findMostComplexFiles(results: ComplexityResult[], limit: number): string[] {
  // Sort by cognitive complexity (more comprehensive metric)
  const sorted = [...results].sort((a, b) => b.cognitiveComplexity - a.cognitiveComplexity);

  return sorted.slice(0, limit).map(r => r.file);
}
