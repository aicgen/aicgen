/**
 * Entry point detection
 *
 * Finds main entry points based on language and project type
 */

import { existsSync } from 'fs';
import { join } from 'path';
import { readFile, readdir } from 'fs/promises';
import type { Language } from '../../../models/project.js';

/**
 * Entry point patterns by language
 */
const ENTRY_POINT_PATTERNS: Record<string, string[]> = {
  typescript: [
    'src/index.ts',
    'src/main.ts',
    'src/app.ts',
    'src/server.ts',
    'index.ts',
    'main.ts',
    'app.ts',
    'server.ts',
  ],
  javascript: [
    'src/index.js',
    'src/main.js',
    'src/app.js',
    'src/server.js',
    'index.js',
    'main.js',
    'app.js',
    'server.js',
  ],
  python: [
    'main.py',
    'app.py',
    '__main__.py',
    'manage.py',
    'setup.py',
    'src/main.py',
    'src/app.py',
  ],
  go: [
    'main.go',
    'cmd/main.go',
  ],
  rust: [
    'src/main.rs',
    'src/lib.rs',
  ],
  java: [
    'src/main/java/Main.java',
    'src/main/java/Application.java',
  ],
  csharp: [
    'Program.cs',
    'Startup.cs',
    'src/Program.cs',
  ],
  ruby: [
    'app.rb',
    'main.rb',
    'config.ru',
    'Rakefile',
  ],
};

/**
 * Framework-specific entry points
 */
const FRAMEWORK_ENTRY_POINTS: Record<string, string[]> = {
  'next.js': [
    'pages/_app.tsx',
    'pages/_app.js',
    'app/layout.tsx',
    'app/layout.js',
    'next.config.js',
    'next.config.ts',
  ],
  'nuxt': [
    'nuxt.config.ts',
    'nuxt.config.js',
    'app.vue',
  ],
  'gatsby': [
    'gatsby-config.js',
    'gatsby-node.js',
    'src/pages/index.js',
  ],
  'django': [
    'manage.py',
    'wsgi.py',
    'settings.py',
  ],
  'flask': [
    'app.py',
    'wsgi.py',
  ],
  'fastapi': [
    'main.py',
    'app.py',
  ],
  'express': [
    'server.js',
    'app.js',
    'index.js',
  ],
};

/**
 * Detect entry points for the project
 *
 * @param projectPath - Absolute path to project root
 * @param language - Primary language
 * @returns Array of entry point file paths (relative to project root)
 */
export async function detectEntryPoints(projectPath: string, language: Language): Promise<string[]> {
  const entryPoints: string[] = [];

  // 1. Check package.json for explicit entry points (for JavaScript/TypeScript)
  if (language === 'javascript' || language === 'typescript') {
    const packageJsonEntries = await getPackageJsonEntryPoints(projectPath);
    entryPoints.push(...packageJsonEntries);
  }

  // 2. Check framework-specific entry points
  const frameworkEntries = await detectFrameworkEntryPoints(projectPath);
  entryPoints.push(...frameworkEntries);

  // 3. Check language-specific patterns
  const patterns = ENTRY_POINT_PATTERNS[language] || [];
  for (const pattern of patterns) {
    const fullPath = join(projectPath, pattern);
    if (existsSync(fullPath)) {
      entryPoints.push(pattern);
    }
  }

  // 4. For Go, check all cmd/* directories
  if (language === 'go') {
    const cmdEntries = await findGoCmdEntryPoints(projectPath);
    entryPoints.push(...cmdEntries);
  }

  // 5. For Java, search for Main/Application classes
  if (language === 'java') {
    const javaEntries = await findJavaMainClasses(projectPath);
    entryPoints.push(...javaEntries);
  }

  // Remove duplicates and return
  return [...new Set(entryPoints)];
}

/**
 * Get entry points from package.json
 */
async function getPackageJsonEntryPoints(projectPath: string): Promise<string[]> {
  const packageJsonPath = join(projectPath, 'package.json');
  if (!existsSync(packageJsonPath)) {
    return [];
  }

  try {
    const content = await readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(content);
    const entries: string[] = [];

    // Check "main" field
    if (packageJson.main && typeof packageJson.main === 'string') {
      entries.push(packageJson.main);
    }

    // Check "module" field (ES modules)
    if (packageJson.module && typeof packageJson.module === 'string') {
      entries.push(packageJson.module);
    }

    // Check "exports" field
    if (packageJson.exports) {
      if (typeof packageJson.exports === 'string') {
        entries.push(packageJson.exports);
      } else if (typeof packageJson.exports === 'object') {
        // Handle exports object
        if (packageJson.exports['.']) {
          const dotExport = packageJson.exports['.'];
          if (typeof dotExport === 'string') {
            entries.push(dotExport);
          } else if (dotExport.import) {
            entries.push(dotExport.import);
          } else if (dotExport.require) {
            entries.push(dotExport.require);
          }
        }
      }
    }

    return entries;
  } catch {
    return [];
  }
}

/**
 * Detect framework-specific entry points
 */
async function detectFrameworkEntryPoints(projectPath: string): Promise<string[]> {
  const entries: string[] = [];

  for (const [framework, patterns] of Object.entries(FRAMEWORK_ENTRY_POINTS)) {
    for (const pattern of patterns) {
      const fullPath = join(projectPath, pattern);
      if (existsSync(fullPath)) {
        entries.push(pattern);
      }
    }
  }

  return entries;
}

/**
 * Find Go cmd entry points
 */
async function findGoCmdEntryPoints(projectPath: string): Promise<string[]> {
  const cmdDir = join(projectPath, 'cmd');
  if (!existsSync(cmdDir)) {
    return [];
  }

  try {
    const entries = await readdir(cmdDir, { withFileTypes: true });
    const mainFiles: string[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const mainGoPath = join('cmd', entry.name, 'main.go');
        const fullPath = join(projectPath, mainGoPath);
        if (existsSync(fullPath)) {
          mainFiles.push(mainGoPath);
        }
      }
    }

    return mainFiles;
  } catch {
    return [];
  }
}

/**
 * Find Java main classes
 */
async function findJavaMainClasses(projectPath: string): Promise<string[]> {
  const javaDir = join(projectPath, 'src/main/java');
  if (!existsSync(javaDir)) {
    return [];
  }

  const mainClasses: string[] = [];

  async function searchForMainClasses(dir: string, relativePath: string = ''): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          await searchForMainClasses(
            join(dir, entry.name),
            relativePath ? `${relativePath}/${entry.name}` : entry.name
          );
        } else if (entry.isFile() && (entry.name === 'Main.java' || entry.name === 'Application.java')) {
          const relPath = relativePath ? `src/main/java/${relativePath}/${entry.name}` : `src/main/java/${entry.name}`;
          mainClasses.push(relPath);
        }
      }
    } catch {
      // Permission denied or other error
    }
  }

  await searchForMainClasses(javaDir);
  return mainClasses;
}
