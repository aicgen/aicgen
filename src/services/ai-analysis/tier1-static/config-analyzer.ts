/**
 * Configuration file analysis
 *
 * Detects and analyzes configuration files in the project:
 * - TypeScript (tsconfig.json)
 * - ESLint (.eslintrc.*, eslint.config.js)
 * - Prettier (.prettierrc.*, prettier.config.js)
 * - Docker (Dockerfile, docker-compose.yml)
 * - CI/CD (.github/workflows/, .gitlab-ci.yml, etc.)
 * - Environment (.env*)
 * - Git hooks (.husky/, pre-commit)
 * - EditorConfig (.editorconfig)
 */

import { existsSync } from 'fs';
import { join } from 'path';
import { readdir, stat } from 'fs/promises';
import type { ConfigAnalysisResult, DetectedConfig } from '../types.js';

/**
 * Configuration patterns to detect
 */
const CONFIG_PATTERNS: Array<{
  category: DetectedConfig['category'];
  name: string;
  files: string[];
}> = [
  // TypeScript
  {
    category: 'typescript',
    name: 'TypeScript',
    files: ['tsconfig.json', 'tsconfig.*.json'],
  },
  // Linting
  {
    category: 'linting',
    name: 'ESLint',
    files: ['.eslintrc', '.eslintrc.json', '.eslintrc.js', '.eslintrc.cjs', 'eslint.config.js', 'eslint.config.mjs'],
  },
  {
    category: 'linting',
    name: 'Prettier',
    files: ['.prettierrc', '.prettierrc.json', '.prettierrc.js', 'prettier.config.js', '.prettierrc.yaml'],
  },
  // Docker
  {
    category: 'docker',
    name: 'Docker',
    files: ['Dockerfile', 'Dockerfile.*', 'docker-compose.yml', 'docker-compose.yaml'],
  },
  // CI/CD
  {
    category: 'ci',
    name: 'GitHub Actions',
    files: ['.github/workflows'],
  },
  {
    category: 'ci',
    name: 'GitLab CI',
    files: ['.gitlab-ci.yml'],
  },
  {
    category: 'ci',
    name: 'CircleCI',
    files: ['.circleci/config.yml'],
  },
  {
    category: 'ci',
    name: 'Travis CI',
    files: ['.travis.yml'],
  },
  {
    category: 'ci',
    name: 'Jenkins',
    files: ['Jenkinsfile'],
  },
  {
    category: 'ci',
    name: 'Azure Pipelines',
    files: ['azure-pipelines.yml'],
  },
  // Environment
  {
    category: 'environment',
    name: 'Environment Variables',
    files: ['.env', '.env.local', '.env.development', '.env.production', '.env.example'],
  },
  // Git hooks
  {
    category: 'git-hooks',
    name: 'Husky',
    files: ['.husky'],
  },
  {
    category: 'git-hooks',
    name: 'Git Hooks',
    files: ['.git/hooks/pre-commit', '.git/hooks/commit-msg'],
  },
  // EditorConfig
  {
    category: 'editor',
    name: 'EditorConfig',
    files: ['.editorconfig'],
  },
  // Testing
  {
    category: 'testing',
    name: 'Jest',
    files: ['jest.config.js', 'jest.config.ts', 'jest.config.json'],
  },
  {
    category: 'testing',
    name: 'Vitest',
    files: ['vitest.config.ts', 'vitest.config.js'],
  },
  // Build/Bundler configs
  {
    category: 'build',
    name: 'Vite',
    files: ['vite.config.ts', 'vite.config.js'],
  },
  {
    category: 'build',
    name: 'Webpack',
    files: ['webpack.config.js', 'webpack.config.ts'],
  },
  {
    category: 'build',
    name: 'Rollup',
    files: ['rollup.config.js', 'rollup.config.ts'],
  },
  // Package managers
  {
    category: 'package-manager',
    name: 'npm',
    files: ['.npmrc'],
  },
  {
    category: 'package-manager',
    name: 'Yarn',
    files: ['.yarnrc', '.yarnrc.yml'],
  },
  {
    category: 'package-manager',
    name: 'pnpm',
    files: ['.pnpmfile.cjs', 'pnpm-workspace.yaml'],
  },
];

/**
 * Analyze configuration files in project
 *
 * @param projectPath - Absolute path to project root
 * @returns Configuration analysis result
 */
export async function analyzeConfigs(projectPath: string): Promise<ConfigAnalysisResult> {
  const detected: DetectedConfig[] = [];

  for (const pattern of CONFIG_PATTERNS) {
    const foundFiles: string[] = [];

    for (const file of pattern.files) {
      const filePath = join(projectPath, file);

      // Check if it's a pattern (contains *)
      if (file.includes('*')) {
        const matches = await findMatchingFiles(projectPath, file);
        foundFiles.push(...matches);
      } else {
        if (existsSync(filePath)) {
          foundFiles.push(file);
        }
      }
    }

    if (foundFiles.length > 0) {
      detected.push({
        category: pattern.category,
        name: pattern.name,
        files: foundFiles,
      });
    }
  }

  return {
    configs: detected,
    hasTypeScript: detected.some(c => c.category === 'typescript'),
    hasLinting: detected.some(c => c.category === 'linting'),
    hasDocker: detected.some(c => c.category === 'docker'),
    hasCI: detected.some(c => c.category === 'ci'),
    hasEnvironmentFiles: detected.some(c => c.category === 'environment'),
  };
}

/**
 * Find files matching a glob-like pattern (simplified)
 */
async function findMatchingFiles(projectPath: string, pattern: string): Promise<string[]> {
  const matches: string[] = [];

  // Handle directory patterns (e.g., .github/workflows)
  if (!pattern.includes('*')) {
    const dirPath = join(projectPath, pattern);
    if (existsSync(dirPath)) {
      try {
        const stats = await stat(dirPath);
        if (stats.isDirectory()) {
          // Check if directory has files
          const entries = await readdir(dirPath);
          if (entries.length > 0) {
            matches.push(pattern);
          }
        }
      } catch {
        // Not a directory or permission denied
      }
    }
    return matches;
  }

  // Handle file patterns with wildcards (e.g., tsconfig.*.json)
  const parts = pattern.split('*');
  const prefix = parts[0];
  const suffix = parts[parts.length - 1];

  // Extract directory from pattern
  const lastSlash = prefix.lastIndexOf('/');
  const dir = lastSlash >= 0 ? prefix.substring(0, lastSlash) : '';
  const filePrefix = lastSlash >= 0 ? prefix.substring(lastSlash + 1) : prefix;

  const searchDir = dir ? join(projectPath, dir) : projectPath;

  if (!existsSync(searchDir)) {
    return matches;
  }

  try {
    const entries = await readdir(searchDir);

    for (const entry of entries) {
      if (entry.startsWith(filePrefix) && entry.endsWith(suffix)) {
        const relativePath = dir ? `${dir}/${entry}` : entry;
        matches.push(relativePath);
      }
    }
  } catch {
    // Permission denied or not a directory
  }

  return matches;
}
