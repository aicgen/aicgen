/**
 * Dependency analysis
 *
 * Analyzes project dependencies from manifest files:
 * - Node.js: package.json, package-lock.json, yarn.lock, pnpm-lock.yaml
 * - Python: requirements.txt, Pipfile, pyproject.toml, setup.py
 * - Go: go.mod, go.sum
 * - Rust: Cargo.toml, Cargo.lock
 * - Java: pom.xml, build.gradle
 * - .NET: *.csproj, packages.config
 * - Ruby: Gemfile, Gemfile.lock
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import type { DependencyAnalysisResult, PackageManager } from '../types.js';

/**
 * Analyze project dependencies
 *
 * @param projectPath - Absolute path to project root
 * @returns Dependency analysis result
 */
export async function analyzeDependencies(projectPath: string): Promise<DependencyAnalysisResult> {
  // Detect package manager from lockfiles
  const packageManager = detectPackageManager(projectPath);

  // Parse dependencies based on detected language/package manager
  if (packageManager === 'npm' || packageManager === 'yarn' || packageManager === 'pnpm' || packageManager === 'bun') {
    return await analyzeNodeDependencies(projectPath, packageManager);
  } else if (packageManager === 'pip') {
    return await analyzePythonDependencies(projectPath);
  } else if (packageManager === 'go-mod') {
    return await analyzeGoDependencies(projectPath);
  } else if (packageManager === 'cargo') {
    return await analyzeRustDependencies(projectPath);
  }

  // Default: empty dependencies
  return {
    dependencies: {},
    devDependencies: {},
    packageManager: 'npm',
    lockfilePresent: false,
  };
}

/**
 * Detect package manager from lockfiles
 */
function detectPackageManager(projectPath: string): PackageManager {
  // Check lockfiles in order of specificity
  if (existsSync(join(projectPath, 'bun.lockb'))) {
    return 'bun';
  }
  if (existsSync(join(projectPath, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }
  if (existsSync(join(projectPath, 'yarn.lock'))) {
    return 'yarn';
  }
  if (existsSync(join(projectPath, 'package-lock.json'))) {
    return 'npm';
  }
  if (existsSync(join(projectPath, 'Cargo.lock'))) {
    return 'cargo';
  }
  if (existsSync(join(projectPath, 'go.sum'))) {
    return 'go-mod';
  }
  if (existsSync(join(projectPath, 'Pipfile.lock')) || existsSync(join(projectPath, 'requirements.txt'))) {
    return 'pip';
  }
  if (existsSync(join(projectPath, 'Gemfile.lock'))) {
    return 'gem';
  }
  if (existsSync(join(projectPath, 'composer.lock'))) {
    return 'composer';
  }

  // Check manifest files
  if (existsSync(join(projectPath, 'package.json'))) {
    return 'npm'; // Default to npm if package.json exists
  }
  if (existsSync(join(projectPath, 'Cargo.toml'))) {
    return 'cargo';
  }
  if (existsSync(join(projectPath, 'go.mod'))) {
    return 'go-mod';
  }

  return 'npm'; // Default
}

/**
 * Analyze Node.js dependencies from package.json
 */
async function analyzeNodeDependencies(
  projectPath: string,
  packageManager: PackageManager
): Promise<DependencyAnalysisResult> {
  const packageJsonPath = join(projectPath, 'package.json');

  if (!existsSync(packageJsonPath)) {
    return {
      dependencies: {},
      devDependencies: {},
      packageManager,
      lockfilePresent: hasLockfile(projectPath, packageManager),
    };
  }

  try {
    const content = await readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(content);

    return {
      dependencies: packageJson.dependencies || {},
      devDependencies: packageJson.devDependencies || {},
      packageManager,
      lockfilePresent: hasLockfile(projectPath, packageManager),
      manifestPath: packageJsonPath,
      lockfilePath: getLockfilePath(projectPath, packageManager),
    };
  } catch {
    // Invalid package.json
    return {
      dependencies: {},
      devDependencies: {},
      packageManager,
      lockfilePresent: false,
    };
  }
}

/**
 * Analyze Python dependencies from requirements.txt or pyproject.toml
 */
async function analyzePythonDependencies(projectPath: string): Promise<DependencyAnalysisResult> {
  const requirementsPath = join(projectPath, 'requirements.txt');
  const pyprojectPath = join(projectPath, 'pyproject.toml');

  const dependencies: Record<string, string> = {};

  // Try requirements.txt first
  if (existsSync(requirementsPath)) {
    try {
      const content = await readFile(requirementsPath, 'utf-8');
      const lines = content.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          // Parse "package==version" or "package>=version"
          const match = trimmed.match(/^([a-zA-Z0-9-_]+)(==|>=|<=|>|<|~=)?(.*)$/);
          if (match) {
            const [, pkg, , version] = match;
            dependencies[pkg] = version?.trim() || '*';
          }
        }
      }

      return {
        dependencies,
        devDependencies: {},
        packageManager: 'pip',
        lockfilePresent: existsSync(join(projectPath, 'Pipfile.lock')),
        manifestPath: requirementsPath,
      };
    } catch {
      // Invalid requirements.txt
    }
  }

  // Try pyproject.toml
  if (existsSync(pyprojectPath)) {
    try {
      const content = await readFile(pyprojectPath, 'utf-8');
      // Simple TOML parsing for dependencies (not full TOML parser)
      const depMatch = content.match(/\[tool\.poetry\.dependencies\]([\s\S]*?)(?:\[|$)/);
      if (depMatch) {
        const depsSection = depMatch[1];
        const lines = depsSection.split('\n');

        for (const line of lines) {
          const match = line.match(/^([a-zA-Z0-9-_]+)\s*=\s*"(.*)"/);
          if (match) {
            const [, pkg, version] = match;
            dependencies[pkg] = version;
          }
        }
      }

      return {
        dependencies,
        devDependencies: {},
        packageManager: 'pip',
        lockfilePresent: existsSync(join(projectPath, 'poetry.lock')),
        manifestPath: pyprojectPath,
      };
    } catch {
      // Invalid pyproject.toml
    }
  }

  return {
    dependencies: {},
    devDependencies: {},
    packageManager: 'pip',
    lockfilePresent: false,
  };
}

/**
 * Analyze Go dependencies from go.mod
 */
async function analyzeGoDependencies(projectPath: string): Promise<DependencyAnalysisResult> {
  const goModPath = join(projectPath, 'go.mod');

  if (!existsSync(goModPath)) {
    return {
      dependencies: {},
      devDependencies: {},
      packageManager: 'go-mod',
      lockfilePresent: false,
    };
  }

  try {
    const content = await readFile(goModPath, 'utf-8');
    const dependencies: Record<string, string> = {};

    // Parse "require" section
    const requireMatch = content.match(/require\s*\(([\s\S]*?)\)/);
    if (requireMatch) {
      const requireSection = requireMatch[1];
      const lines = requireSection.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();
        const match = trimmed.match(/^([^\s]+)\s+v?([^\s]+)/);
        if (match) {
          const [, pkg, version] = match;
          dependencies[pkg] = version;
        }
      }
    }

    // Also parse single-line requires
    const singleLineMatches = content.matchAll(/require\s+([^\s]+)\s+v?([^\s]+)/g);
    for (const match of singleLineMatches) {
      const [, pkg, version] = match;
      dependencies[pkg] = version;
    }

    return {
      dependencies,
      devDependencies: {},
      packageManager: 'go-mod',
      lockfilePresent: existsSync(join(projectPath, 'go.sum')),
      manifestPath: goModPath,
      lockfilePath: join(projectPath, 'go.sum'),
    };
  } catch {
    return {
      dependencies: {},
      devDependencies: {},
      packageManager: 'go-mod',
      lockfilePresent: false,
    };
  }
}

/**
 * Analyze Rust dependencies from Cargo.toml
 */
async function analyzeRustDependencies(projectPath: string): Promise<DependencyAnalysisResult> {
  const cargoTomlPath = join(projectPath, 'Cargo.toml');

  if (!existsSync(cargoTomlPath)) {
    return {
      dependencies: {},
      devDependencies: {},
      packageManager: 'cargo',
      lockfilePresent: false,
    };
  }

  try {
    const content = await readFile(cargoTomlPath, 'utf-8');
    const dependencies: Record<string, string> = {};
    const devDependencies: Record<string, string> = {};

    // Parse [dependencies] section
    const depsMatch = content.match(/\[dependencies\]([\s\S]*?)(?:\[|$)/);
    if (depsMatch) {
      const depsSection = depsMatch[1];
      const lines = depsSection.split('\n');

      for (const line of lines) {
        const match = line.match(/^([a-zA-Z0-9-_]+)\s*=\s*"(.*)"/);
        if (match) {
          const [, pkg, version] = match;
          dependencies[pkg] = version;
        }
      }
    }

    // Parse [dev-dependencies] section
    const devDepsMatch = content.match(/\[dev-dependencies\]([\s\S]*?)(?:\[|$)/);
    if (devDepsMatch) {
      const devDepsSection = devDepsMatch[1];
      const lines = devDepsSection.split('\n');

      for (const line of lines) {
        const match = line.match(/^([a-zA-Z0-9-_]+)\s*=\s*"(.*)"/);
        if (match) {
          const [, pkg, version] = match;
          devDependencies[pkg] = version;
        }
      }
    }

    return {
      dependencies,
      devDependencies,
      packageManager: 'cargo',
      lockfilePresent: existsSync(join(projectPath, 'Cargo.lock')),
      manifestPath: cargoTomlPath,
      lockfilePath: join(projectPath, 'Cargo.lock'),
    };
  } catch {
    return {
      dependencies: {},
      devDependencies: {},
      packageManager: 'cargo',
      lockfilePresent: false,
    };
  }
}

/**
 * Check if lockfile exists for package manager
 */
function hasLockfile(projectPath: string, packageManager: PackageManager): boolean {
  const lockfiles: Record<PackageManager, string> = {
    npm: 'package-lock.json',
    yarn: 'yarn.lock',
    pnpm: 'pnpm-lock.yaml',
    bun: 'bun.lockb',
    pip: 'Pipfile.lock',
    'go-mod': 'go.sum',
    cargo: 'Cargo.lock',
    gem: 'Gemfile.lock',
    composer: 'composer.lock',
    maven: '', // Not applicable
    gradle: '', // Not applicable
    nuget: '', // Not applicable
  };

  const lockfile = lockfiles[packageManager];
  return lockfile ? existsSync(join(projectPath, lockfile)) : false;
}

/**
 * Get lockfile path for package manager
 */
function getLockfilePath(projectPath: string, packageManager: PackageManager): string | undefined {
  const lockfiles: Record<PackageManager, string> = {
    npm: 'package-lock.json',
    yarn: 'yarn.lock',
    pnpm: 'pnpm-lock.yaml',
    bun: 'bun.lockb',
    pip: 'Pipfile.lock',
    'go-mod': 'go.sum',
    cargo: 'Cargo.lock',
    gem: 'Gemfile.lock',
    composer: 'composer.lock',
    maven: '',
    gradle: '',
    nuget: '',
  };

  const lockfile = lockfiles[packageManager];
  if (!lockfile) return undefined;

  const lockfilePath = join(projectPath, lockfile);
  return existsSync(lockfilePath) ? lockfilePath : undefined;
}
