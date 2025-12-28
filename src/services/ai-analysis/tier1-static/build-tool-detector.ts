/**
 * Build tool detection
 *
 * Detects build tools, bundlers, and task runners
 */

import { existsSync } from 'fs';
import { join } from 'path';
import { readdir } from 'fs/promises';
import type { BuildToolResult } from '../types.js';

/**
 * Build tool config file patterns
 */
const BUILD_TOOL_PATTERNS = {
  bundlers: {
    'vite': ['vite.config.ts', 'vite.config.js', 'vite.config.mjs'],
    'webpack': ['webpack.config.js', 'webpack.config.ts'],
    'rollup': ['rollup.config.js', 'rollup.config.ts', 'rollup.config.mjs'],
    'parcel': ['.parcelrc', 'parcel.config.js'],
    'esbuild': ['esbuild.config.js', 'esbuild.config.mjs'],
    'turbopack': ['turbo.json'], // Often used with Next.js
  },
  monorepoTools: {
    'nx': ['nx.json', 'workspace.json'],
    'turbo': ['turbo.json'],
    'lerna': ['lerna.json'],
    'rush': ['rush.json'],
  },
  taskRunners: {
    'make': ['Makefile', 'makefile'],
    'task': ['Taskfile.yml', 'Taskfile.yaml'],
    'just': ['justfile', 'Justfile'],
  },
  containerization: {
    'docker': ['Dockerfile', 'dockerfile', '.dockerignore'],
    'docker-compose': ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'],
    'podman': ['Containerfile'],
  },
  ci: {
    'github-actions': ['.github/workflows'],
    'gitlab-ci': ['.gitlab-ci.yml'],
    'circle-ci': ['.circleci/config.yml'],
    'travis-ci': ['.travis.yml'],
    'jenkins': ['Jenkinsfile'],
    'azure-pipelines': ['azure-pipelines.yml'],
  },
};

/**
 * Detect build tools
 *
 * @param projectPath - Absolute path to project root
 * @returns Build tool detection result
 */
export async function detectBuildTools(projectPath: string): Promise<BuildToolResult> {
  const result: BuildToolResult = {};

  // Detect bundler
  const bundler = await detectFromPatterns(projectPath, BUILD_TOOL_PATTERNS.bundlers);
  if (bundler) {
    result.bundler = bundler;
  }

  // Detect monorepo tool
  const monorepoTool = await detectFromPatterns(projectPath, BUILD_TOOL_PATTERNS.monorepoTools);
  if (monorepoTool) {
    result.monorepoTool = monorepoTool;
  }

  // Detect task runner
  const taskRunner = await detectFromPatterns(projectPath, BUILD_TOOL_PATTERNS.taskRunners);
  if (taskRunner) {
    result.taskRunner = taskRunner;
  }

  // Detect containerization tools
  const containerization = await detectAllFromPatterns(
    projectPath,
    BUILD_TOOL_PATTERNS.containerization
  );
  if (containerization.length > 0) {
    result.containerization = containerization;
  }

  // Detect CI/CD platforms
  const ci = await detectAllFromPatterns(projectPath, BUILD_TOOL_PATTERNS.ci);
  if (ci.length > 0) {
    result.ci = ci;
  }

  return result;
}

/**
 * Detect first matching tool from patterns
 */
async function detectFromPatterns(
  projectPath: string,
  patterns: Record<string, string[]>
): Promise<string | undefined> {
  for (const [tool, configFiles] of Object.entries(patterns)) {
    for (const configFile of configFiles) {
      const fullPath = join(projectPath, configFile);
      if (existsSync(fullPath)) {
        return tool;
      }
    }
  }
  return undefined;
}

/**
 * Detect all matching tools from patterns
 */
async function detectAllFromPatterns(
  projectPath: string,
  patterns: Record<string, string[]>
): Promise<string[]> {
  const detected: string[] = [];

  for (const [tool, configFiles] of Object.entries(patterns)) {
    for (const configFile of configFiles) {
      const fullPath = join(projectPath, configFile);
      if (existsSync(fullPath)) {
        detected.push(tool);
        break; // Don't add the same tool multiple times
      }
    }
  }

  return detected;
}
