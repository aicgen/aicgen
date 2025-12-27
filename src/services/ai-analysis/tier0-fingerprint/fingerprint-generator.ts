/**
 * Repository fingerprint generation for caching
 *
 * Generates a unique fingerprint for a repository based on:
 * - Git commit hash (if git repo)
 * - Directory structure hash
 * - Dependency lockfile hash
 * - Configuration file hash
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { existsSync } from 'fs';
import type { FingerprintResult } from '../types.js';
import { hashDirectoryTree, hashFile, hashMultiple, hashContent } from '../utils/file-hash.js';

const execAsync = promisify(exec);

/**
 * Schema version for cache invalidation
 * Increment this when fingerprint structure changes
 */
const FINGERPRINT_SCHEMA_VERSION = '1.0.0';

/**
 * Generate a fingerprint for the given project
 *
 * @param projectPath - Absolute path to project root
 * @returns Fingerprint result with combined hash and components
 */
export async function generateFingerprint(projectPath: string): Promise<FingerprintResult> {
  if (!existsSync(projectPath)) {
    return {
      hash: '',
      components: {
        structure: '',
        dependencies: '',
        configs: '',
      },
      timestamp: Date.now(),
      valid: false,
      invalidReason: `Project path does not exist: ${projectPath}`,
    };
  }

  try {
    // Run all fingerprint components in parallel for speed
    const [gitHash, structureHash, dependenciesHash, configsHash] = await Promise.all([
      getGitHash(projectPath),
      hashDirectoryStructure(projectPath),
      hashDependencies(projectPath),
      hashConfigs(projectPath),
    ]);

    const components: FingerprintResult['components'] = {
      git: gitHash,
      structure: structureHash,
      dependencies: dependenciesHash,
      configs: configsHash,
    };

    const combinedHash = combineHashes(components);

    return {
      hash: combinedHash,
      components,
      timestamp: Date.now(),
      valid: true,
    };
  } catch (error) {
    return {
      hash: '',
      components: {
        structure: '',
        dependencies: '',
        configs: '',
      },
      timestamp: Date.now(),
      valid: false,
      invalidReason: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check if project is a git repository
 */
async function isGitRepository(projectPath: string): Promise<boolean> {
  const gitDir = join(projectPath, '.git');
  if (!existsSync(gitDir)) {
    return false;
  }

  try {
    await execAsync('git rev-parse --git-dir', { cwd: projectPath });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get git HEAD commit hash
 */
async function getGitHash(projectPath: string): Promise<string | undefined> {
  if (!(await isGitRepository(projectPath))) {
    return undefined;
  }

  try {
    const { stdout } = await execAsync('git rev-parse HEAD', { cwd: projectPath });
    return stdout.trim();
  } catch {
    // Git command failed (maybe no commits yet)
    return undefined;
  }
}

/**
 * Hash directory structure (directories only, not file contents)
 */
async function hashDirectoryStructure(projectPath: string): Promise<string> {
  return hashDirectoryTree(projectPath);
}

/**
 * Hash dependency lockfiles
 */
async function hashDependencies(projectPath: string): Promise<string> {
  const lockfiles = [
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    'bun.lockb',
    'Pipfile.lock',
    'poetry.lock',
    'requirements.txt',
    'go.sum',
    'Cargo.lock',
    'Gemfile.lock',
    'composer.lock',
    'packages.lock.json', // .NET
  ];

  const hashes: string[] = [];

  for (const lockfile of lockfiles) {
    const lockfilePath = join(projectPath, lockfile);
    if (existsSync(lockfilePath)) {
      try {
        const hash = await hashFile(lockfilePath);
        hashes.push(`${lockfile}:${hash}`);
      } catch (error) {
        // File may not be readable, skip
        console.warn(`Warning: Cannot hash ${lockfile}:`, error);
      }
    }
  }

  // If no lockfiles found, hash is empty
  if (hashes.length === 0) {
    return hashContent('no-lockfiles');
  }

  return hashMultiple(hashes);
}

/**
 * Hash configuration files
 */
async function hashConfigs(projectPath: string): Promise<string> {
  const configFiles = [
    'package.json',
    'tsconfig.json',
    'next.config.js',
    'next.config.mjs',
    'vite.config.ts',
    'vite.config.js',
    'webpack.config.js',
    'nx.json',
    'turbo.json',
    'lerna.json',
    'pyproject.toml',
    'setup.py',
    'go.mod',
    'Cargo.toml',
    '.eslintrc.json',
    '.eslintrc.js',
    'prettier.config.js',
    '.prettierrc',
  ];

  const hashes: string[] = [];

  for (const configFile of configFiles) {
    const configPath = join(projectPath, configFile);
    if (existsSync(configPath)) {
      try {
        const hash = await hashFile(configPath);
        hashes.push(`${configFile}:${hash}`);
      } catch (error) {
        // File may not be readable, skip
        console.warn(`Warning: Cannot hash ${configFile}:`, error);
      }
    }
  }

  // If no config files found, hash is empty
  if (hashes.length === 0) {
    return hashContent('no-configs');
  }

  return hashMultiple(hashes);
}

/**
 * Combine component hashes into final fingerprint
 */
function combineHashes(components: FingerprintResult['components']): string {
  const parts: string[] = [
    `schema:${FINGERPRINT_SCHEMA_VERSION}`,
    `git:${components.git || 'none'}`,
    `structure:${components.structure}`,
    `dependencies:${components.dependencies}`,
    `configs:${components.configs}`,
  ];

  return hashContent(parts.join('|'));
}
