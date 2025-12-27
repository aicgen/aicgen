/**
 * Fast file hashing utilities
 *
 * For fingerprint generation and cache invalidation
 */

import crypto from 'crypto';
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

/**
 * Hash file contents
 *
 * @param content - File content or data to hash
 * @returns SHA-256 hash hex string
 */
export function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Hash multiple strings together
 *
 * @param strings - Array of strings to hash
 * @returns Combined SHA-256 hash
 */
export function hashMultiple(strings: string[]): string {
  const combined = strings.join('::');
  return hashContent(combined);
}

/**
 * Hash file at path
 *
 * @param filePath - Path to file
 * @returns SHA-256 hash of file contents
 */
export async function hashFile(filePath: string): Promise<string> {
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = await readFile(filePath, 'utf-8');
  return hashContent(content);
}

/**
 * Hash directory tree structure (not contents)
 *
 * @param dirPath - Path to directory
 * @returns Hash of directory tree structure
 */
export async function hashDirectoryTree(dirPath: string): Promise<string> {
  if (!existsSync(dirPath)) {
    throw new Error(`Directory not found: ${dirPath}`);
  }

  const directories = await collectDirectories(dirPath);
  directories.sort(); // Ensure consistent ordering

  return hashContent(directories.join('\n'));
}

/**
 * Recursively collect all directory paths (not files)
 */
async function collectDirectories(
  dirPath: string,
  basePath: string = dirPath,
  maxDepth: number = 10,
  currentDepth: number = 0
): Promise<string[]> {
  if (currentDepth >= maxDepth) {
    return [];
  }

  const directories: string[] = [];

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      // Skip common ignore patterns
      if (shouldIgnore(entry.name)) {
        continue;
      }

      if (entry.isDirectory()) {
        const fullPath = join(dirPath, entry.name);
        const relativePath = fullPath.replace(basePath, '').replace(/^\//, '');

        directories.push(relativePath);

        // Recurse into subdirectory
        const subDirs = await collectDirectories(
          fullPath,
          basePath,
          maxDepth,
          currentDepth + 1
        );
        directories.push(...subDirs);
      }
    }
  } catch (error) {
    // Permission denied or other errors - skip this directory
    console.warn(`Warning: Cannot read directory ${dirPath}:`, error);
  }

  return directories;
}

/**
 * Check if file/directory should be ignored
 */
function shouldIgnore(name: string): boolean {
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
    '.DS_Store',
    'Thumbs.db',
  ];

  return ignorePatterns.includes(name);
}
