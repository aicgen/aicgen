import { readFile } from 'fs/promises';
import { join, relative } from 'path';
import { existsSync } from 'fs';
import type { SampledFile, SamplingContext, SamplingReason } from '../types.js';
import { detectEntryPoints } from './entry-point-detector.js';
import { buildImportGraph, findHubFiles } from './import-graph-analyzer.js';
import { analyzeComplexity, findMostComplexFiles } from './complexity-analyzer.js';
import { rankConfigFiles } from './config-file-ranker.js';

export interface SamplingStrategy {
  readonly name: string;
  select(context: SamplingContext): Promise<SampledFile[]>;
}

interface SelectedFile {
  path: string;
  reason: SamplingReason;
  importance: number;
}

export class MinimalStrategy implements SamplingStrategy {
  readonly name = 'minimal';

  async select(context: SamplingContext): Promise<SampledFile[]> {
    const selected: SelectedFile[] = [];
    const { projectPath, staticAnalysis, language, maxFiles, maxTokens } = context;

    const entryPoints = await detectEntryPoints(projectPath, language, staticAnalysis);
    if (entryPoints.length > 0) {
      selected.push({
        path: entryPoints[0].path,
        reason: 'entry-point',
        importance: 1.0
      });
    }

    const sourceFiles = await this.collectSourceFiles(projectPath, language);
    if (sourceFiles.length > 0) {
      const graph = await buildImportGraph(projectPath, sourceFiles, language);
      const hubFiles = findHubFiles(graph, 1);

      if (hubFiles.length > 0) {
        selected.push({
          path: hubFiles[0].path,
          reason: 'hub-file',
          importance: 0.9
        });
      }
    }

    const configFiles = await rankConfigFiles(projectPath, staticAnalysis);
    if (configFiles.length > 0) {
      selected.push({
        path: configFiles[0].path,
        reason: 'config-file',
        importance: 0.8
      });
    }

    return this.readFileContents(selected.slice(0, Math.min(maxFiles, 5)), projectPath, maxTokens);
  }

  private async collectSourceFiles(projectPath: string, language: string): Promise<string[]> {
    const { glob } = await import('glob');
    const extensions = this.getExtensionsForLanguage(language);
    const patterns = extensions.map(ext => `**/*${ext}`);

    const files: string[] = [];
    for (const pattern of patterns) {
      const matches = await glob(pattern, {
        cwd: projectPath,
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**', '**/coverage/**', '**/__tests__/**', '**/*.test.*', '**/*.spec.*'],
        nodir: true,
        absolute: false
      });
      files.push(...matches);
    }

    return files;
  }

  private getExtensionsForLanguage(language: string): string[] {
    const extMap: Record<string, string[]> = {
      'typescript': ['.ts', '.tsx'],
      'javascript': ['.js', '.jsx', '.mjs'],
      'python': ['.py'],
      'go': ['.go'],
      'rust': ['.rs'],
      'java': ['.java'],
      'csharp': ['.cs'],
      'ruby': ['.rb']
    };
    return extMap[language] || ['.ts', '.js'];
  }

  private async readFileContents(
    selected: SelectedFile[],
    projectPath: string,
    maxTokens: number
  ): Promise<SampledFile[]> {
    const sampledFiles: SampledFile[] = [];
    let totalTokens = 0;

    for (const file of selected) {
      const fullPath = join(projectPath, file.path);
      if (!existsSync(fullPath)) continue;

      try {
        const content = await readFile(fullPath, 'utf-8');
        const size = Buffer.byteLength(content);
        const estimatedTokens = this.estimateTokens(content);

        if (totalTokens + estimatedTokens > maxTokens) break;

        const language = this.detectLanguageFromPath(file.path);

        sampledFiles.push({
          path: file.path,
          content,
          size,
          estimatedTokens,
          reason: file.reason,
          language,
          importance: file.importance
        });

        totalTokens += estimatedTokens;
      } catch (error) {
        continue;
      }
    }

    return sampledFiles;
  }

  private estimateTokens(content: string): number {
    return Math.ceil(content.length / 4);
  }

  private detectLanguageFromPath(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase() || '';
    const langMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'mjs': 'javascript',
      'py': 'python',
      'go': 'go',
      'rs': 'rust',
      'java': 'java',
      'cs': 'csharp',
      'rb': 'ruby',
      'json': 'json',
      'yaml': 'yaml',
      'yml': 'yaml',
      'toml': 'toml'
    };
    return langMap[ext] || 'text';
  }
}

export class BalancedStrategy implements SamplingStrategy {
  readonly name = 'balanced';

  async select(context: SamplingContext): Promise<SampledFile[]> {
    const selected: SelectedFile[] = [];
    const { projectPath, staticAnalysis, language, maxFiles, maxTokens, includeTests } = context;

    const entryPoints = await detectEntryPoints(projectPath, language, staticAnalysis);
    entryPoints.slice(0, 2).forEach((ep, i) => {
      selected.push({
        path: ep.path,
        reason: 'entry-point',
        importance: 1.0 - (i * 0.1)
      });
    });

    const sourceFiles = await this.collectSourceFiles(projectPath, language);
    if (sourceFiles.length > 0) {
      const graph = await buildImportGraph(projectPath, sourceFiles, language);
      const hubFiles = findHubFiles(graph, 3);

      hubFiles.forEach((hub, i) => {
        selected.push({
          path: hub.path,
          reason: 'hub-file',
          importance: 0.9 - (i * 0.05)
        });
      });

      const complexFiles = await this.findComplexFiles(projectPath, sourceFiles, language, 2);
      complexFiles.forEach((file, i) => {
        selected.push({
          path: file,
          reason: 'high-complexity',
          importance: 0.7 - (i * 0.05)
        });
      });
    }

    if (includeTests) {
      const testFiles = await this.findTestFiles(projectPath, language);
      if (testFiles.length > 0) {
        selected.push({
          path: testFiles[0],
          reason: 'test-file',
          importance: 0.6
        });
      }
    }

    const configFiles = await rankConfigFiles(projectPath, staticAnalysis);
    configFiles.slice(0, 3).forEach((config, i) => {
      selected.push({
        path: config.path,
        reason: 'config-file',
        importance: 0.8 - (i * 0.1)
      });
    });

    const deduplicated = this.deduplicateFiles(selected);
    const sorted = deduplicated.sort((a, b) => b.importance - a.importance);

    return this.readFileContents(sorted.slice(0, maxFiles), projectPath, maxTokens);
  }

  private async collectSourceFiles(projectPath: string, language: string): Promise<string[]> {
    const { glob } = await import('glob');
    const extensions = this.getExtensionsForLanguage(language);
    const patterns = extensions.map(ext => `**/*${ext}`);

    const files: string[] = [];
    for (const pattern of patterns) {
      const matches = await glob(pattern, {
        cwd: projectPath,
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**', '**/coverage/**', '**/__tests__/**', '**/*.test.*', '**/*.spec.*'],
        nodir: true,
        absolute: false
      });
      files.push(...matches);
    }

    return files;
  }

  private async findComplexFiles(
    projectPath: string,
    files: string[],
    language: string,
    count: number
  ): Promise<string[]> {
    const complexityResults = await Promise.all(
      files.map(file => analyzeComplexity(join(projectPath, file), language))
    );

    const mostComplex = findMostComplexFiles(complexityResults, count);
    return mostComplex.map(c => c.file);
  }

  private async findTestFiles(projectPath: string, language: string): Promise<string[]> {
    const { glob } = await import('glob');
    const extensions = this.getExtensionsForLanguage(language);
    const patterns = extensions.flatMap(ext => [
      `**/*.test${ext}`,
      `**/*.spec${ext}`,
      `**/__tests__/**/*${ext}`
    ]);

    const files: string[] = [];
    for (const pattern of patterns) {
      const matches = await glob(pattern, {
        cwd: projectPath,
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
        nodir: true,
        absolute: false
      });
      files.push(...matches);
    }

    return files;
  }

  private getExtensionsForLanguage(language: string): string[] {
    const extMap: Record<string, string[]> = {
      'typescript': ['.ts', '.tsx'],
      'javascript': ['.js', '.jsx', '.mjs'],
      'python': ['.py'],
      'go': ['.go'],
      'rust': ['.rs'],
      'java': ['.java'],
      'csharp': ['.cs'],
      'ruby': ['.rb']
    };
    return extMap[language] || ['.ts', '.js'];
  }

  private deduplicateFiles(files: SelectedFile[]): SelectedFile[] {
    const seen = new Set<string>();
    return files.filter(file => {
      if (seen.has(file.path)) return false;
      seen.add(file.path);
      return true;
    });
  }

  private async readFileContents(
    selected: SelectedFile[],
    projectPath: string,
    maxTokens: number
  ): Promise<SampledFile[]> {
    const sampledFiles: SampledFile[] = [];
    let totalTokens = 0;

    for (const file of selected) {
      const fullPath = join(projectPath, file.path);
      if (!existsSync(fullPath)) continue;

      try {
        const content = await readFile(fullPath, 'utf-8');
        const size = Buffer.byteLength(content);
        const estimatedTokens = this.estimateTokens(content);

        if (totalTokens + estimatedTokens > maxTokens) break;

        const language = this.detectLanguageFromPath(file.path);

        sampledFiles.push({
          path: file.path,
          content,
          size,
          estimatedTokens,
          reason: file.reason,
          language,
          importance: file.importance
        });

        totalTokens += estimatedTokens;
      } catch (error) {
        continue;
      }
    }

    return sampledFiles;
  }

  private estimateTokens(content: string): number {
    return Math.ceil(content.length / 4);
  }

  private detectLanguageFromPath(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase() || '';
    const langMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'mjs': 'javascript',
      'py': 'python',
      'go': 'go',
      'rs': 'rust',
      'java': 'java',
      'cs': 'csharp',
      'rb': 'ruby',
      'json': 'json',
      'yaml': 'yaml',
      'yml': 'yaml',
      'toml': 'toml'
    };
    return langMap[ext] || 'text';
  }
}

export class ComprehensiveStrategy implements SamplingStrategy {
  readonly name = 'comprehensive';

  async select(context: SamplingContext): Promise<SampledFile[]> {
    const selected: SelectedFile[] = [];
    const { projectPath, staticAnalysis, language, maxFiles, maxTokens, includeTests } = context;

    const entryPoints = await detectEntryPoints(projectPath, language, staticAnalysis);
    entryPoints.slice(0, 2).forEach((ep, i) => {
      selected.push({
        path: ep.path,
        reason: 'entry-point',
        importance: 1.0 - (i * 0.05)
      });
    });

    const sourceFiles = await this.collectSourceFiles(projectPath, language);
    if (sourceFiles.length > 0) {
      const graph = await buildImportGraph(projectPath, sourceFiles, language);
      const hubFiles = findHubFiles(graph, 4);

      hubFiles.forEach((hub, i) => {
        selected.push({
          path: hub.path,
          reason: 'hub-file',
          importance: 0.95 - (i * 0.05)
        });
      });

      const complexFiles = await this.findComplexFiles(projectPath, sourceFiles, language, 3);
      complexFiles.forEach((file, i) => {
        selected.push({
          path: file,
          reason: 'high-complexity',
          importance: 0.75 - (i * 0.05)
        });
      });
    }

    if (includeTests) {
      const testFiles = await this.findTestFiles(projectPath, language);
      testFiles.slice(0, 2).forEach((file, i) => {
        selected.push({
          path: file,
          reason: 'test-file',
          importance: 0.65 - (i * 0.05)
        });
      });
    }

    const configFiles = await rankConfigFiles(projectPath, staticAnalysis);
    configFiles.slice(0, 4).forEach((config, i) => {
      selected.push({
        path: config.path,
        reason: 'config-file',
        importance: 0.85 - (i * 0.05)
      });
    });

    const deduplicated = this.deduplicateFiles(selected);
    const sorted = deduplicated.sort((a, b) => b.importance - a.importance);

    return this.readFileContents(sorted.slice(0, maxFiles), projectPath, maxTokens);
  }

  private async collectSourceFiles(projectPath: string, language: string): Promise<string[]> {
    const { glob } = await import('glob');
    const extensions = this.getExtensionsForLanguage(language);
    const patterns = extensions.map(ext => `**/*${ext}`);

    const files: string[] = [];
    for (const pattern of patterns) {
      const matches = await glob(pattern, {
        cwd: projectPath,
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**', '**/coverage/**', '**/__tests__/**', '**/*.test.*', '**/*.spec.*'],
        nodir: true,
        absolute: false
      });
      files.push(...matches);
    }

    return files;
  }

  private async findComplexFiles(
    projectPath: string,
    files: string[],
    language: string,
    count: number
  ): Promise<string[]> {
    const complexityResults = await Promise.all(
      files.map(file => analyzeComplexity(join(projectPath, file), language))
    );

    const mostComplex = findMostComplexFiles(complexityResults, count);
    return mostComplex.map(c => c.file);
  }

  private async findTestFiles(projectPath: string, language: string): Promise<string[]> {
    const { glob } = await import('glob');
    const extensions = this.getExtensionsForLanguage(language);
    const patterns = extensions.flatMap(ext => [
      `**/*.test${ext}`,
      `**/*.spec${ext}`,
      `**/__tests__/**/*${ext}`
    ]);

    const files: string[] = [];
    for (const pattern of patterns) {
      const matches = await glob(pattern, {
        cwd: projectPath,
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
        nodir: true,
        absolute: false
      });
      files.push(...matches);
    }

    return files;
  }

  private getExtensionsForLanguage(language: string): string[] {
    const extMap: Record<string, string[]> = {
      'typescript': ['.ts', '.tsx'],
      'javascript': ['.js', '.jsx', '.mjs'],
      'python': ['.py'],
      'go': ['.go'],
      'rust': ['.rs'],
      'java': ['.java'],
      'csharp': ['.cs'],
      'ruby': ['.rb']
    };
    return extMap[language] || ['.ts', '.js'];
  }

  private deduplicateFiles(files: SelectedFile[]): SelectedFile[] {
    const seen = new Set<string>();
    return files.filter(file => {
      if (seen.has(file.path)) return false;
      seen.add(file.path);
      return true;
    });
  }

  private async readFileContents(
    selected: SelectedFile[],
    projectPath: string,
    maxTokens: number
  ): Promise<SampledFile[]> {
    const sampledFiles: SampledFile[] = [];
    let totalTokens = 0;

    for (const file of selected) {
      const fullPath = join(projectPath, file.path);
      if (!existsSync(fullPath)) continue;

      try {
        const content = await readFile(fullPath, 'utf-8');
        const size = Buffer.byteLength(content);
        const estimatedTokens = this.estimateTokens(content);

        if (totalTokens + estimatedTokens > maxTokens) break;

        const language = this.detectLanguageFromPath(file.path);

        sampledFiles.push({
          path: file.path,
          content,
          size,
          estimatedTokens,
          reason: file.reason,
          language,
          importance: file.importance
        });

        totalTokens += estimatedTokens;
      } catch (error) {
        continue;
      }
    }

    return sampledFiles;
  }

  private estimateTokens(content: string): number {
    return Math.ceil(content.length / 4);
  }

  private detectLanguageFromPath(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase() || '';
    const langMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'mjs': 'javascript',
      'py': 'python',
      'go': 'go',
      'rs': 'rust',
      'java': 'java',
      'cs': 'csharp',
      'rb': 'ruby',
      'json': 'json',
      'yaml': 'yaml',
      'yml': 'yaml',
      'toml': 'toml'
    };
    return langMap[ext] || 'text';
  }
}

export function getStrategy(name: 'minimal' | 'balanced' | 'comprehensive'): SamplingStrategy {
  switch (name) {
    case 'minimal':
      return new MinimalStrategy();
    case 'balanced':
      return new BalancedStrategy();
    case 'comprehensive':
      return new ComprehensiveStrategy();
  }
}
