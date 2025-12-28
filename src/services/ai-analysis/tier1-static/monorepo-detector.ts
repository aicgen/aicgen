/**
 * Monorepo detection
 *
 * Detects if project is a monorepo and identifies the tool
 */

import { existsSync } from 'fs';
import { join } from 'path';
import { readFile, readdir } from 'fs/promises';
import type { MonorepoResult } from '../types.js';

/**
 * Detect monorepo configuration
 *
 * @param projectPath - Absolute path to project root
 * @returns Monorepo detection result
 */
export async function detectMonorepo(projectPath: string): Promise<MonorepoResult> {
  // Check for monorepo tool config files
  const tool = await detectMonorepoTool(projectPath);

  if (!tool) {
    // Check for workspace patterns in package.json
    const hasWorkspaces = await hasPackageJsonWorkspaces(projectPath);
    if (hasWorkspaces) {
      return {
        isMonorepo: true,
        tool: await detectWorkspaceTool(projectPath),
        packages: await findWorkspacePackages(projectPath),
        structure: await detectStructure(projectPath),
        packageCount: (await findWorkspacePackages(projectPath)).length,
      };
    }

    // Check for common monorepo directory patterns
    const hasMonorepoStructure = await hasMonorepoDirectoryStructure(projectPath);
    if (hasMonorepoStructure) {
      return {
        isMonorepo: true,
        structure: await detectStructure(projectPath),
        packages: await findPackageDirectories(projectPath),
        packageCount: (await findPackageDirectories(projectPath)).length,
      };
    }

    return {
      isMonorepo: false,
    };
  }

  // We have a detected tool
  const packages = await findMonorepoPackages(projectPath, tool);
  const structure = await detectStructure(projectPath);

  return {
    isMonorepo: true,
    tool,
    packages,
    structure,
    packageCount: packages.length,
  };
}

/**
 * Detect monorepo tool from config files
 */
async function detectMonorepoTool(
  projectPath: string
): Promise<'nx' | 'turbo' | 'lerna' | 'rush' | undefined> {
  if (existsSync(join(projectPath, 'nx.json')) || existsSync(join(projectPath, 'workspace.json'))) {
    return 'nx';
  }
  if (existsSync(join(projectPath, 'turbo.json'))) {
    return 'turbo';
  }
  if (existsSync(join(projectPath, 'lerna.json'))) {
    return 'lerna';
  }
  if (existsSync(join(projectPath, 'rush.json'))) {
    return 'rush';
  }
  return undefined;
}

/**
 * Check if package.json has workspaces field
 */
async function hasPackageJsonWorkspaces(projectPath: string): Promise<boolean> {
  const packageJsonPath = join(projectPath, 'package.json');
  if (!existsSync(packageJsonPath)) {
    return false;
  }

  try {
    const content = await readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(content);
    return !!packageJson.workspaces;
  } catch {
    return false;
  }
}

/**
 * Detect workspace tool (npm, yarn, pnpm)
 */
async function detectWorkspaceTool(
  projectPath: string
): Promise<'yarn-workspaces' | 'pnpm-workspaces' | 'npm-workspaces'> {
  if (existsSync(join(projectPath, 'pnpm-lock.yaml')) || existsSync(join(projectPath, 'pnpm-workspace.yaml'))) {
    return 'pnpm-workspaces';
  }
  if (existsSync(join(projectPath, 'yarn.lock'))) {
    return 'yarn-workspaces';
  }
  return 'npm-workspaces';
}

/**
 * Find workspace packages from package.json
 */
async function findWorkspacePackages(projectPath: string): Promise<string[]> {
  const packageJsonPath = join(projectPath, 'package.json');
  if (!existsSync(packageJsonPath)) {
    return [];
  }

  try {
    const content = await readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(content);

    if (Array.isArray(packageJson.workspaces)) {
      return packageJson.workspaces;
    } else if (packageJson.workspaces?.packages) {
      return packageJson.workspaces.packages;
    }
  } catch {
    // Invalid JSON
  }

  return [];
}

/**
 * Find monorepo packages based on tool
 */
async function findMonorepoPackages(
  projectPath: string,
  tool: 'nx' | 'turbo' | 'lerna' | 'rush'
): Promise<string[]> {
  switch (tool) {
    case 'nx':
      return await findNxPackages(projectPath);
    case 'turbo':
    case 'lerna':
      return await findWorkspacePackages(projectPath);
    case 'rush':
      return await findRushPackages(projectPath);
    default:
      return [];
  }
}

/**
 * Find Nx packages from nx.json
 */
async function findNxPackages(projectPath: string): Promise<string[]> {
  // Nx typically uses apps/ and libs/ directories
  const packages: string[] = [];

  for (const dir of ['apps', 'libs', 'packages']) {
    const dirPath = join(projectPath, dir);
    if (existsSync(dirPath)) {
      try {
        const entries = await readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            packages.push(`${dir}/${entry.name}`);
          }
        }
      } catch {
        // Permission denied
      }
    }
  }

  return packages;
}

/**
 * Find Rush packages from rush.json
 */
async function findRushPackages(projectPath: string): Promise<string[]> {
  const rushJsonPath = join(projectPath, 'rush.json');
  if (!existsSync(rushJsonPath)) {
    return [];
  }

  try {
    const content = await readFile(rushJsonPath, 'utf-8');
    const rushJson = JSON.parse(content);

    if (rushJson.projects) {
      return rushJson.projects.map((p: { packageName: string; projectFolder: string }) => p.projectFolder);
    }
  } catch {
    // Invalid JSON
  }

  return [];
}

/**
 * Check for monorepo directory structure
 */
async function hasMonorepoDirectoryStructure(projectPath: string): Promise<boolean> {
  const monorepoPatterns = ['apps', 'packages', 'libs'];

  for (const pattern of monorepoPatterns) {
    const dirPath = join(projectPath, pattern);
    if (existsSync(dirPath)) {
      // Check if it has multiple subdirectories with package.json
      try {
        const entries = await readdir(dirPath, { withFileTypes: true });
        const hasPackages = entries.some(entry => {
          if (!entry.isDirectory()) return false;
          return existsSync(join(dirPath, entry.name, 'package.json'));
        });

        if (hasPackages) {
          return true;
        }
      } catch {
        // Permission denied
      }
    }
  }

  return false;
}

/**
 * Find package directories
 */
async function findPackageDirectories(projectPath: string): Promise<string[]> {
  const packages: string[] = [];
  const patterns = ['apps', 'packages', 'libs'];

  for (const pattern of patterns) {
    const dirPath = join(projectPath, pattern);
    if (existsSync(dirPath)) {
      try {
        const entries = await readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            packages.push(`${pattern}/${entry.name}`);
          }
        }
      } catch {
        // Permission denied
      }
    }
  }

  return packages;
}

/**
 * Detect monorepo structure type
 */
async function detectStructure(
  projectPath: string
): Promise<'apps-packages' | 'packages-only' | 'libs-only' | 'custom'> {
  const hasApps = existsSync(join(projectPath, 'apps'));
  const hasPackages = existsSync(join(projectPath, 'packages'));
  const hasLibs = existsSync(join(projectPath, 'libs'));

  if (hasApps && (hasPackages || hasLibs)) {
    return 'apps-packages';
  }
  if (hasPackages && !hasApps) {
    return 'packages-only';
  }
  if (hasLibs && !hasApps && !hasPackages) {
    return 'libs-only';
  }

  return 'custom';
}
