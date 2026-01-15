import glob from 'fast-glob';
import { join } from 'path';
import { readFile, exists } from '../utils/file';
import { Language } from '../models/project';
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
  // Architecture hints
  architectureHints: string[];
  databaseHints: {
    hasSql: boolean;
    hasNoSql: boolean;
    detected: string[];
  };
  testingHints: {
    frameworks: string[];
    hasTests: boolean;
    testFileCount: number;
  };
  projectTypeHints: string[];
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
    const architectureHints = await this.detectArchitectureHints(structure, frameworks);
    const databaseHints = await this.detectDatabaseHints();
    const testingHints = this.detectTestingHints(files);
    const projectTypeHints = this.detectProjectTypeHints(files, frameworks);
    const fingerprint = this.generateFingerprint(structure, files, language, frameworks, buildTools);

    return {
      structure,
      files,
      language,
      frameworks,
      buildTools,
      packageManager,
      repoType,
      fingerprint,
      architectureHints,
      databaseHints,
      testingHints,
      projectTypeHints
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
    if (await exists(join(this.projectPath, 'pubspec.yaml'))) return 'dart';
    if (await exists(join(this.projectPath, 'Package.swift'))) return 'swift';
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
        'fastify': 'Fastify', 'koa': 'Koa', 'hapi': 'Hapi',
        'flutter': 'Flutter', 'react-native': 'React Native',
        'serverless': 'Serverless Framework', 'aws-cdk': 'AWS CDK',
        'kafka': 'Kafka', 'rabbitmq': 'RabbitMQ'
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

  private async detectArchitectureHints(structure: string[], frameworks: string[]): Promise<string[]> {
    const hints: string[] = [];

    // Monorepo indicators
    if (await exists(join(this.projectPath, 'nx.json'))) hints.push('nx-monorepo');
    if (await exists(join(this.projectPath, 'turbo.json'))) hints.push('turborepo');
    if (await exists(join(this.projectPath, 'lerna.json'))) hints.push('lerna-monorepo');
    if (structure.some(d => d.startsWith('packages/') || d.startsWith('apps/'))) {
      hints.push('workspace-structure');
    }

    // Microservices indicators
    if (structure.some(d => d.startsWith('services/') || d.startsWith('microservices/'))) {
      hints.push('microservices-structure');
    }
    if (await exists(join(this.projectPath, 'docker-compose.yml'))) hints.push('docker-compose');
    if (await exists(join(this.projectPath, 'kubernetes')) || await exists(join(this.projectPath, 'k8s'))) {
      hints.push('kubernetes');
    }

    // Serverless indicators
    if (await exists(join(this.projectPath, 'serverless.yml')) || await exists(join(this.projectPath, 'serverless.yaml'))) {
      hints.push('serverless-framework');
    }
    if (await exists(join(this.projectPath, 'netlify.toml'))) hints.push('netlify');
    if (await exists(join(this.projectPath, 'vercel.json'))) hints.push('vercel');
    if (structure.some(d => d === 'functions' || d === 'netlify/functions' || d === 'api')) {
      hints.push('serverless-functions');
    }

    // DDD indicators
    if (structure.some(d => d.includes('domain') && (d.includes('aggregate') || d.includes('entity') || d.includes('value-object')))) {
      hints.push('ddd-structure');
    }
    if (structure.some(d => d.match(/bounded-context|contexts/i))) hints.push('bounded-contexts');

    // Hexagonal/Clean Architecture indicators
    if (structure.some(d => d.match(/^(src\/)?domain/) && structure.some(d => d.match(/^(src\/)?infrastructure/)))) {
      hints.push('hexagonal-layers');
    }
    if (structure.some(d => d.match(/adapters|ports/i))) hints.push('ports-and-adapters');
    if (structure.some(d => d.match(/use-?cases|usecases/i))) hints.push('use-cases');

    // Layered indicators
    if (structure.some(d => d.match(/^(src\/)?(controllers?|routes?|handlers?)$/))) hints.push('mvc-controllers');
    if (structure.some(d => d.match(/^(src\/)?(models?|entities?)$/)) &&
        structure.some(d => d.match(/^(src\/)?(views?|templates?)$/))) {
      hints.push('mvc-pattern');
    }

    // Event-driven indicators
    if (structure.some(d => d.match(/events?|event-?handlers?|sagas?|event-?sourcing/i))) {
      hints.push('event-driven');
    }
    if (frameworks.some(f => f.match(/kafka|rabbitmq|eventbridge/i))) hints.push('message-queue');

    // Modular monolith indicators
    if (structure.some(d => d.match(/^(src\/)?modules?\//)) && !hints.includes('microservices-structure')) {
      hints.push('modular-structure');
    }

    return hints;
  }

  private async detectDatabaseHints(): Promise<{ hasSql: boolean; hasNoSql: boolean; detected: string[] }> {
    const detected: string[] = [];
    let hasSql = false;
    let hasNoSql = false;

    // Check package.json for database drivers
    if (await exists(join(this.projectPath, 'package.json'))) {
      try {
        const pkg = JSON.parse(await readFile(join(this.projectPath, 'package.json')));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };

        // SQL databases
        if (deps['pg'] || deps['postgres']) { detected.push('PostgreSQL'); hasSql = true; }
        if (deps['mysql'] || deps['mysql2']) { detected.push('MySQL'); hasSql = true; }
        if (deps['sqlite3'] || deps['better-sqlite3']) { detected.push('SQLite'); hasSql = true; }
        if (deps['tedious'] || deps['mssql']) { detected.push('SQL Server'); hasSql = true; }
        if (deps['typeorm'] || deps['sequelize'] || deps['prisma'] || deps['knex']) {
          detected.push('SQL ORM');
          hasSql = true;
        }

        // NoSQL databases
        if (deps['mongodb']) { detected.push('MongoDB'); hasNoSql = true; }
        if (deps['redis'] || deps['ioredis']) { detected.push('Redis'); hasNoSql = true; }
        if (deps['aws-sdk'] || deps['@aws-sdk/client-dynamodb']) { detected.push('DynamoDB'); hasNoSql = true; }
        if (deps['cassandra-driver']) { detected.push('Cassandra'); hasNoSql = true; }
        if (deps['mongoose']) { detected.push('MongoDB (Mongoose)'); hasNoSql = true; }
      } catch {
        // Ignore parse errors
      }
    }

    // Check for Prisma schema
    if (await exists(join(this.projectPath, 'prisma/schema.prisma'))) {
      if (!detected.includes('Prisma')) detected.push('Prisma');
      hasSql = true;
    }

    // Check Python dependencies
    if (await exists(join(this.projectPath, 'requirements.txt'))) {
      try {
        const reqs = await readFile(join(this.projectPath, 'requirements.txt'));
        if (reqs.includes('psycopg')) { detected.push('PostgreSQL'); hasSql = true; }
        if (reqs.includes('pymongo')) { detected.push('MongoDB'); hasNoSql = true; }
        if (reqs.includes('redis')) { detected.push('Redis'); hasNoSql = true; }
        if (reqs.includes('sqlalchemy')) { detected.push('SQLAlchemy'); hasSql = true; }
        if (reqs.includes('django')) { detected.push('Django ORM'); hasSql = true; }
      } catch {
        // Ignore read errors
      }
    }

    // Check Go dependencies
    if (await exists(join(this.projectPath, 'go.mod'))) {
      try {
        const gomod = await readFile(join(this.projectPath, 'go.mod'));
        if (gomod.includes('github.com/lib/pq')) { detected.push('PostgreSQL'); hasSql = true; }
        if (gomod.includes('go.mongodb.org/mongo-driver')) { detected.push('MongoDB'); hasNoSql = true; }
        if (gomod.includes('github.com/go-redis/redis')) { detected.push('Redis'); hasNoSql = true; }
        if (gomod.includes('gorm.io/gorm')) { detected.push('GORM'); hasSql = true; }
      } catch {
        // Ignore read errors
      }
    }

    return { hasSql, hasNoSql, detected };
  }

  private detectTestingHints(files: string[]): { frameworks: string[]; hasTests: boolean; testFileCount: number } {
    const testFiles = files.filter(f =>
      f.match(/\.(test|spec)\.(ts|js|tsx|jsx|py|go|rs|rb|dart|swift)$/) ||
      f.match(/_test\.(go|py)$/) ||
      f.match(/Test\.(java|swift)$/)
    );

    const frameworks: string[] = [];
    const testFileCount = testFiles.length;
    const hasTests = testFileCount > 0;

    // Detect by file patterns
    if (testFiles.some(f => f.includes('.spec.'))) frameworks.push('Spec-style tests');
    if (testFiles.some(f => f.includes('.test.'))) frameworks.push('Test-style tests');
    if (testFiles.some(f => f.includes('_test.go'))) frameworks.push('Go testing');
    if (testFiles.some(f => f.includes('_test.py'))) frameworks.push('Python unittest');

    return { frameworks, hasTests, testFileCount };
  }

  private detectProjectTypeHints(files: string[], frameworks: string[]): string[] {
    const hints: string[] = [];

    // Web frontend indicators
    if (files.some(f => f.match(/^(src\/)?components?\//i))) hints.push('component-based-ui');
    if (files.some(f => f.match(/^(public|static|assets)\//))) hints.push('static-assets');
    if (frameworks.some(f => f.match(/React|Vue|Angular|Svelte/))) hints.push('spa-framework');
    if (files.some(f => f.match(/index\.html$/))) hints.push('web-app');

    // API/Backend indicators
    if (files.some(f => f.match(/^(src\/)?routes?\//i))) hints.push('api-routes');
    if (files.some(f => f.match(/^(src\/)?(controllers?|handlers?)\//i))) hints.push('api-handlers');
    if (frameworks.some(f => f.match(/Express|Fastify|NestJS/))) hints.push('web-framework');
    if (files.some(f => f.match(/api\//))) hints.push('api-structure');

    // CLI indicators
    if (files.some(f => f.match(/^(src\/)?commands?\//i))) hints.push('cli-commands');
    if (files.some(f => f.match(/^(bin|cli)\//))) hints.push('cli-structure');

    // Library indicators
    if (files.some(f => f === 'index.ts' || f === 'src/index.ts')) hints.push('library-entry');
    if (files.some(f => f.match(/^(lib|dist)\//))) hints.push('library-build');

    // Mobile indicators
    if (files.some(f => f.match(/\.(ios|android)\./))) hints.push('mobile-platform');
    if (files.some(f => f.match(/^(ios|android)\//))) hints.push('native-mobile');

    return hints;
  }
}
