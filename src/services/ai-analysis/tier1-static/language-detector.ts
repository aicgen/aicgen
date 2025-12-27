/**
 * Programming language detection
 *
 * Detects programming languages in the project by analyzing:
 * - File extensions
 * - Dependency manifests
 * - Build configurations
 */

import { readdir, readFile, stat } from 'fs/promises';
import { join, extname } from 'path';
import { existsSync } from 'fs';
import type { Language } from '../../../models/project.js';
import type { LanguageDetectionResult } from '../types.js';

/**
 * Extension to language mapping
 */
const EXTENSION_MAP: Record<string, Language> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.cs': 'csharp',
  '.rb': 'ruby',
};

/**
 * Manifest files that indicate language
 */
const MANIFEST_INDICATORS: Array<{
  file: string;
  language: Language;
  weight: number;
}> = [
  { file: 'package.json', language: 'javascript', weight: 1.0 },
  { file: 'tsconfig.json', language: 'typescript', weight: 2.0 },
  { file: 'requirements.txt', language: 'python', weight: 1.0 },
  { file: 'pyproject.toml', language: 'python', weight: 1.5 },
  { file: 'go.mod', language: 'go', weight: 2.0 },
  { file: 'Cargo.toml', language: 'rust', weight: 2.0 },
  { file: 'pom.xml', language: 'java', weight: 1.5 },
  { file: 'build.gradle', language: 'java', weight: 1.5 },
  { file: 'Gemfile', language: 'ruby', weight: 1.5 },
];

/**
 * Detect programming languages in project
 *
 * @param projectPath - Absolute path to project root
 * @returns Language detection result with rankings
 */
export async function detectLanguages(projectPath: string): Promise<LanguageDetectionResult> {
  // Count files by extension
  const fileCounts = await countFilesByExtension(projectPath);

  // Estimate LOC per language
  const lineCountMap = await estimateLOCPerLanguage(fileCounts);

  // Check manifest files for language indicators
  const manifestBonus = await detectFromManifests(projectPath);

  // Combine scores
  const languageScores = combineScores(fileCounts, lineCountMap, manifestBonus);

  // Convert to array and sort by score
  const sortedLanguages = Object.entries(languageScores)
    .map(([language, score]) => ({
      language: language as Language,
      fileCount: fileCounts[language as Language] || 0,
      lineCount: lineCountMap[language as Language] || 0,
      score,
    }))
    .sort((a, b) => b.score - a.score);

  if (sortedLanguages.length === 0) {
    // No languages detected, default to JavaScript
    return {
      primary: 'javascript',
      all: [],
      confidence: 0.1,
    };
  }

  // Calculate total lines
  const totalLines = Object.values(lineCountMap).reduce((sum, count) => sum + count, 0);

  // Build result
  const all = sortedLanguages.map(item => ({
    language: item.language,
    fileCount: item.fileCount,
    lineCount: item.lineCount,
    percentage: totalLines > 0 ? (item.lineCount / totalLines) * 100 : 0,
  }));

  const primary = sortedLanguages[0].language;

  // Calculate confidence based on dominance
  const primaryPercentage = all[0]?.percentage || 0;
  const confidence = calculateConfidence(primaryPercentage, sortedLanguages.length);

  return {
    primary,
    all,
    confidence,
  };
}

/**
 * Count files by extension in project
 */
async function countFilesByExtension(
  dirPath: string,
  fileCounts: Record<Language, number> = {},
  depth: number = 0
): Promise<Record<Language, number>> {
  if (depth > 10) return fileCounts; // Max depth

  if (!existsSync(dirPath)) return fileCounts;

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      // Skip ignored directories
      if (shouldIgnoreDir(entry.name)) {
        continue;
      }

      const fullPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        await countFilesByExtension(fullPath, fileCounts, depth + 1);
      } else if (entry.isFile()) {
        const ext = extname(entry.name);
        const language = EXTENSION_MAP[ext];

        if (language) {
          fileCounts[language] = (fileCounts[language] || 0) + 1;
        }
      }
    }
  } catch {
    // Permission denied, skip
  }

  return fileCounts;
}

/**
 * Estimate LOC per language (rough estimate based on file size)
 */
async function estimateLOCPerLanguage(
  fileCounts: Record<Language, number>
): Promise<Record<Language, number>> {
  const lineCountMap: Record<Language, number> = {};

  // Rough estimate: average LOC per file for each language
  const avgLOCPerFile: Record<Language, number> = {
    typescript: 150,
    javascript: 120,
    python: 100,
    go: 130,
    rust: 150,
    java: 180,
    csharp: 170,
    ruby: 100,
  };

  for (const [language, count] of Object.entries(fileCounts)) {
    const avgLOC = avgLOCPerFile[language as Language] || 100;
    lineCountMap[language as Language] = count * avgLOC;
  }

  return lineCountMap;
}

/**
 * Detect language from manifest files
 */
async function detectFromManifests(projectPath: string): Promise<Record<Language, number>> {
  const bonus: Record<Language, number> = {};

  for (const indicator of MANIFEST_INDICATORS) {
    const manifestPath = join(projectPath, indicator.file);
    if (existsSync(manifestPath)) {
      bonus[indicator.language] = (bonus[indicator.language] || 0) + indicator.weight;
    }
  }

  // Special case: Check package.json for TypeScript dependency
  const packageJsonPath = join(projectPath, 'package.json');
  if (existsSync(packageJsonPath)) {
    try {
      const content = await readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content);

      if (
        packageJson.dependencies?.typescript ||
        packageJson.devDependencies?.typescript
      ) {
        bonus.typescript = (bonus.typescript || 0) + 1.5;
      }
    } catch {
      // Invalid JSON, ignore
    }
  }

  return bonus;
}

/**
 * Combine file counts, line counts, and manifest bonus into scores
 */
function combineScores(
  fileCounts: Record<Language, number>,
  lineCountMap: Record<Language, number>,
  manifestBonus: Record<Language, number>
): Record<Language, number> {
  const scores: Record<Language, number> = {};

  // Get all languages
  const allLanguages = new Set([
    ...Object.keys(fileCounts),
    ...Object.keys(lineCountMap),
    ...Object.keys(manifestBonus),
  ]);

  for (const language of allLanguages) {
    const fileScore = fileCounts[language as Language] || 0;
    const lineScore = (lineCountMap[language as Language] || 0) / 100; // Normalize
    const bonus = manifestBonus[language as Language] || 0;

    // Combined score: file count + normalized LOC + manifest bonus
    scores[language as Language] = fileScore + lineScore + bonus * 10;
  }

  return scores;
}

/**
 * Calculate confidence based on language dominance
 */
function calculateConfidence(primaryPercentage: number, languageCount: number): number {
  // High percentage = high confidence
  // Many languages = lower confidence

  let confidence = primaryPercentage / 100;

  // Penalty for many languages
  if (languageCount > 3) {
    confidence *= 0.8;
  } else if (languageCount > 1) {
    confidence *= 0.9;
  }

  // Ensure confidence is between 0 and 1
  return Math.max(0, Math.min(1, confidence));
}

/**
 * Check if directory should be ignored
 */
function shouldIgnoreDir(name: string): boolean {
  const ignorePatterns = [
    'node_modules',
    '.git',
    '.svn',
    '.hg',
    'dist',
    'build',
    'out',
    'coverage',
    '.next',
    '.cache',
    '.nuxt',
    '.output',
    'tmp',
    'temp',
    'vendor',
    'target', // Rust
    'bin',
    'obj',
  ];

  return ignorePatterns.includes(name);
}
