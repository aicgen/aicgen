import glob from 'fast-glob';
import { join } from 'path';
import { readFile, exists } from '../utils/file.js';
import { Language } from '../models/project.js';
import { createHash } from 'crypto';

export interface ProjectMetadata {
  structure: string[];
  files: string[];
  language: Language;
  frameworks: string[];
  buildTools: string[];
  packageManager: string;
  repoType: 'monorepo' | 'polyrepo' | 'unknown';
  fingerprint: string;
}

export interface FileSample {
  path: string;
  content: string;
}

export interface AnalysisContext {
  metadata: ProjectMetadata;
  samples: FileSample[];
}

export class ProjectAnalyzer {
  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  async analyze(): Promise<AnalysisContext> {
    const metadata = await this.performStaticAnalysis();
    const samples = await this.sampleFiles(metadata);
    return { metadata, samples };
  }

  private async performStaticAnalysis(): Promise<ProjectMetadata> {
    const files = await glob(['**/*'], { 
      cwd: this.projectPath,
      ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**'],
      onlyFiles: true,
      deep: 4 
    });

    const structure = await glob(['**/*'], { 
        cwd: this.projectPath,
        ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**'],
        onlyDirectories: true,
        deep: 3
    });

    const language = await this.detectLanguage();
    const { frameworks, buildTools, packageManager } = await this.detectDependencies();
    const repoType = await this.detectRepoType(structure);
    const fingerprint = this.generateFingerprint(structure, files, language, frameworks, buildTools);

    return {
      structure,
      files,
      language,
      frameworks,
      buildTools,
      packageManager,
      repoType,
      fingerprint
    };
  }

  private async detectRepoType(structure: string[]): Promise<'monorepo' | 'polyrepo' | 'unknown'> {
    if (await exists(join(this.projectPath, 'nx.json')) || await exists(join(this.projectPath, 'turbo.json'))) return 'monorepo';
    if (structure.some(d => d.startsWith('packages/') || d.startsWith('apps/'))) return 'monorepo';
    if (await exists(join(this.projectPath, 'pnpm-workspace.yaml'))) return 'monorepo';
    return 'polyrepo';
  }

  private generateFingerprint(structure: string[], files: string[], language: string, frameworks: string[], buildTools: string[]): string {
    const hash = createHash('sha256');
    hash.update(JSON.stringify(structure.sort()));
    hash.update(JSON.stringify(files.sort()));
    hash.update(language);
    hash.update(frameworks.sort().join(','));
    hash.update(buildTools.sort().join(','));
    // Ideally we'd add lockfile content but file list is a decent proxy for structure for now
    return hash.digest('hex');
  }

  private async detectLanguage(): Promise<Language> {
    if (await exists(join(this.projectPath, 'tsconfig.json'))) return 'typescript';
    if (await exists(join(this.projectPath, 'package.json'))) return 'javascript';
    if (await exists(join(this.projectPath, 'go.mod'))) return 'go';
    if (await exists(join(this.projectPath, 'Cargo.toml'))) return 'rust';
    if (await exists(join(this.projectPath, 'pom.xml'))) return 'java';
    if (await exists(join(this.projectPath, 'Gemfile'))) return 'ruby';
    if (await exists(join(this.projectPath, 'requirements.txt')) || await exists(join(this.projectPath, 'pyproject.toml'))) return 'python';
    return 'unknown';
  }

  private async detectDependencies(): Promise<{ frameworks: string[], buildTools: string[], packageManager: string }> {
    const frameworks: string[] = [];
    const buildTools: string[] = [];
    let packageManager = 'unknown';

    // Node.js
    if (await exists(join(this.projectPath, 'package.json'))) {
      const pkg = JSON.parse(await readFile(join(this.projectPath, 'package.json')));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      
      const frameworkMap: Record<string, string> = {
        'react': 'React', 'vue': 'Vue', 'angular': 'Angular', 'svelte': 'Svelte',
        'next': 'Next.js', 'nuxt': 'Nuxt', 'express': 'Express', 'nest': 'NestJS',
        'fastify': 'Fastify'
      };

      const toolMap: Record<string, string> = {
        'typescript': 'TypeScript', 'vite': 'Vite', 'webpack': 'Webpack', 
        'rollup': 'Rollup', 'esbuild': 'esbuild', 'jest': 'Jest', 'mocha': 'Mocha'
      };

      Object.keys(deps).forEach(dep => {
        if (frameworkMap[dep]) frameworks.push(frameworkMap[dep]);
        if (toolMap[dep]) buildTools.push(toolMap[dep]);
      });

      if (await exists(join(this.projectPath, 'yarn.lock'))) packageManager = 'yarn';
      else if (await exists(join(this.projectPath, 'pnpm-lock.yaml'))) packageManager = 'pnpm';
      else if (await exists(join(this.projectPath, 'bun.lockb')) || await exists(join(this.projectPath, 'bun.lock'))) packageManager = 'bun';
      else packageManager = 'npm';
    }

    return { frameworks, buildTools, packageManager };
  }

  private async sampleFiles(metadata: ProjectMetadata): Promise<FileSample[]> {
    const samples: FileSample[] = [];
    const MAX_FILES = 12;
    
    // 1. Config Files (High Signal)
    const configFiles = [
        'package.json', 'tsconfig.json', 'go.mod', 'cargo.toml', 'pyproject.toml', 
        'nx.json', 'turbo.json', 'next.config.js', 'vite.config.ts'
    ];
    for (const file of configFiles) {
      if (metadata.files.includes(file)) {
        samples.push(await this.readSample(file));
      }
    }

    // 2. Entry Points
    const entryPoints = metadata.files.filter(f => 
       f.match(/^(src\/)?(main|index|app|server)\.(ts|js|go|py|rs)$/)
    );
    for (const file of entryPoints.slice(0, 2)) {
         if (!samples.find(s => s.path === file)) {
            samples.push(await this.readSample(file));
         }
    }

    // 3. High-Signal Source Files (Heuristic: Import Density)
    const sourceFiles = metadata.files.filter(f => 
        (f.startsWith('src/') || f.startsWith('lib/') || f.startsWith('cmd/') || f.startsWith('internal/')) &&
        !f.endsWith('.d.ts') && !f.endsWith('.test.ts') && !f.endsWith('.spec.ts')
    );

    // Read headers of source files to count imports (fast check)
    const scoredFiles: { path: string, score: number }[] = [];
    for (const file of sourceFiles.slice(0, 50)) { // Limit check to top 50 to stay fast
        try {
            const content = await readFile(join(this.projectPath, file));
            const importCount = (content.match(/import\s+.*from/g) || []).length + (content.match(/require\(/g) || []).length;
            scoredFiles.push({ path: file, score: importCount });
        } catch { /* ignore read errors */ }
    }
    
    scoredFiles.sort((a, b) => b.score - a.score);
    
    for (const file of scoredFiles.slice(0, 4)) {
         if (!samples.find(s => s.path === file.path)) {
            samples.push(await this.readSample(file.path));
         }
    }

    // 4. Representative Test
    const testFile = metadata.files.find(f => f.includes('test') || f.endsWith('.spec.ts') || f.endsWith('_test.go'));
    if (testFile && !samples.find(s => s.path === testFile)) {
        samples.push(await this.readSample(testFile));
    }

    return samples.slice(0, MAX_FILES);
  }

  private async readSample(relativePath: string, maxLength: number = 10000): Promise<FileSample> {
    try {
        let content = await readFile(join(this.projectPath, relativePath));
        if (content.length > maxLength) {
            content = content.substring(0, maxLength) + '\n... (truncated)';
        }
        return { path: relativePath, content };
    } catch (e) {
        return { path: relativePath, content: '(Error reading file)' };
    }
  }
}
