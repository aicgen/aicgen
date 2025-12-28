/**
 * Import graph analysis
 *
 * Builds import/dependency graph to find hub files
 */

import { readFile } from 'fs/promises';
import { join, dirname, resolve, extname } from 'path';
import { existsSync } from 'fs';
import type { ImportGraph, FileNode } from '../types.js';
import type { Language } from '../../../models/project.js';

/**
 * Build import graph from source files
 *
 * @param projectPath - Absolute path to project root
 * @param files - List of file paths relative to project root
 * @param language - Primary language
 * @returns Import graph
 */
export async function buildImportGraph(
  projectPath: string,
  files: string[],
  language: Language
): Promise<ImportGraph> {
  const nodes = new Map<string, FileNode>();
  const edges = new Map<string, Set<string>>();

  // Initialize nodes
  for (const file of files) {
    nodes.set(file, {
      path: file,
      imports: [],
      importedBy: [],
      importCount: 0,
    });
    edges.set(file, new Set());
  }

  // Parse imports for each file
  for (const file of files) {
    const fullPath = join(projectPath, file);
    if (!existsSync(fullPath)) {
      continue;
    }

    try {
      const content = await readFile(fullPath, 'utf-8');
      const imports = parseImports(content, file, language);

      // Resolve imports to actual file paths
      const resolvedImports = imports
        .map(imp => resolveImport(imp, file, projectPath, language))
        .filter((imp): imp is string => imp !== null && files.includes(imp));

      // Update graph
      const node = nodes.get(file);
      if (node) {
        node.imports = resolvedImports;
      }

      edges.set(file, new Set(resolvedImports));

      // Update importedBy for each imported file
      for (const importedFile of resolvedImports) {
        const importedNode = nodes.get(importedFile);
        if (importedNode) {
          importedNode.importedBy.push(file);
          importedNode.importCount++;
        }
      }
    } catch {
      // Failed to read file, skip
    }
  }

  return { nodes, edges };
}

/**
 * Parse import statements from file content
 */
function parseImports(content: string, filePath: string, language: Language): string[] {
  const imports: string[] = [];

  switch (language) {
    case 'typescript':
    case 'javascript':
      imports.push(...parseJSImports(content));
      break;
    case 'python':
      imports.push(...parsePythonImports(content));
      break;
    case 'go':
      imports.push(...parseGoImports(content));
      break;
    case 'rust':
      imports.push(...parseRustImports(content));
      break;
  }

  return imports;
}

/**
 * Parse JavaScript/TypeScript imports
 */
function parseJSImports(content: string): string[] {
  const imports: string[] = [];

  // ES6 import statements
  const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  // CommonJS require
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = requireRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  // Dynamic import
  const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = dynamicImportRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  return imports;
}

/**
 * Parse Python imports
 */
function parsePythonImports(content: string): string[] {
  const imports: string[] = [];

  // import module
  const importRegex = /^import\s+([\w.]+)/gm;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  // from module import ...
  const fromImportRegex = /^from\s+([\w.]+)\s+import/gm;
  while ((match = fromImportRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  return imports;
}

/**
 * Parse Go imports
 */
function parseGoImports(content: string): string[] {
  const imports: string[] = [];

  // Single import
  const singleImportRegex = /import\s+"([^"]+)"/g;
  let match;
  while ((match = singleImportRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  // Multi-line import block
  const importBlockRegex = /import\s*\(([\s\S]*?)\)/g;
  while ((match = importBlockRegex.exec(content)) !== null) {
    const block = match[1];
    const lineRegex = /"([^"]+)"/g;
    let lineMatch;
    while ((lineMatch = lineRegex.exec(block)) !== null) {
      imports.push(lineMatch[1]);
    }
  }

  return imports;
}

/**
 * Parse Rust imports
 */
function parseRustImports(content: string): string[] {
  const imports: string[] = [];

  // use statements
  const useRegex = /use\s+([\w:]+)/g;
  let match;
  while ((match = useRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  // mod statements
  const modRegex = /mod\s+(\w+)/g;
  while ((match = modRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  return imports;
}

/**
 * Resolve import path to actual file path
 */
function resolveImport(
  importPath: string,
  fromFile: string,
  projectPath: string,
  language: Language
): string | null {
  // Skip external packages (node_modules, third-party libraries)
  if (isExternalPackage(importPath, language)) {
    return null;
  }

  // Handle relative imports
  if (importPath.startsWith('./') || importPath.startsWith('../')) {
    return resolveRelativeImport(importPath, fromFile, projectPath, language);
  }

  // Handle absolute imports from src/
  if (language === 'typescript' || language === 'javascript') {
    // Try resolving from project root or src/
    for (const base of ['', 'src/']) {
      const resolved = resolveAbsoluteImport(importPath, base, projectPath, language);
      if (resolved) return resolved;
    }
  }

  return null;
}

/**
 * Check if import is external package
 */
function isExternalPackage(importPath: string, language: Language): boolean {
  // Don't start with ./ or ../
  if (importPath.startsWith('./') || importPath.startsWith('../')) {
    return false;
  }

  if (language === 'typescript' || language === 'javascript') {
    // External if doesn't start with @ or doesn't have @ in org scope
    return !importPath.startsWith('@/') && !importPath.startsWith('~');
  }

  if (language === 'python') {
    // External if it's a known stdlib or doesn't contain project indicators
    const stdlibModules = ['os', 'sys', 'json', 're', 'datetime', 'pathlib', 'typing'];
    const topLevel = importPath.split('.')[0];
    return stdlibModules.includes(topLevel);
  }

  if (language === 'go') {
    // External if it contains a domain or is a stdlib package
    return importPath.includes('.') || !importPath.includes('/');
  }

  return true;
}

/**
 * Resolve relative import
 */
function resolveRelativeImport(
  importPath: string,
  fromFile: string,
  projectPath: string,
  language: Language
): string | null {
  const fromDir = dirname(fromFile);
  const resolvedPath = resolve(fromDir, importPath);

  // Try different extensions
  const extensions = getExtensions(language);
  for (const ext of extensions) {
    const withExt = resolvedPath + ext;
    const fullPath = join(projectPath, withExt);
    if (existsSync(fullPath)) {
      return withExt;
    }
  }

  // Try index files
  for (const ext of extensions) {
    const indexPath = join(resolvedPath, `index${ext}`);
    const fullPath = join(projectPath, indexPath);
    if (existsSync(fullPath)) {
      return indexPath;
    }
  }

  return null;
}

/**
 * Resolve absolute import
 */
function resolveAbsoluteImport(
  importPath: string,
  base: string,
  projectPath: string,
  language: Language
): string | null {
  const basePath = join(base, importPath);
  const extensions = getExtensions(language);

  for (const ext of extensions) {
    const withExt = basePath + ext;
    const fullPath = join(projectPath, withExt);
    if (existsSync(fullPath)) {
      return withExt;
    }
  }

  return null;
}

/**
 * Get file extensions for language
 */
function getExtensions(language: Language): string[] {
  switch (language) {
    case 'typescript':
      return ['.ts', '.tsx', '.js', '.jsx'];
    case 'javascript':
      return ['.js', '.jsx', '.mjs', '.cjs'];
    case 'python':
      return ['.py'];
    case 'go':
      return ['.go'];
    case 'rust':
      return ['.rs'];
    default:
      return [];
  }
}

/**
 * Find hub files (most imported files)
 *
 * @param graph - Import graph
 * @param limit - Maximum number of hub files to return
 * @returns Array of hub file paths ranked by hub score
 */
export async function findHubFiles(graph: ImportGraph, limit: number): Promise<string[]> {
  // Convert nodes to array and sort by importCount
  const sortedNodes = Array.from(graph.nodes.values()).sort(
    (a, b) => b.importCount - a.importCount
  );

  // Return top N hub files
  return sortedNodes.slice(0, limit).map(node => node.path);
}
