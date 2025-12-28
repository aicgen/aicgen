import { createAIAnalyzer, isAIAnalysisAvailable } from './ai-analysis-service.js';
import type { AnalysisResult } from './ai-analysis/ai-analyzer.js';
import type { ProjectType, ArchitectureType, DatasourceType } from '../models/profile.js';

export interface AIEnhancedDetection {
  projectType?: ProjectType;
  architecture?: ArchitectureType;
  datasource?: DatasourceType;
  confidence: number;
  frameworks: string[];
  reasoning: string;
  executionTime: number;
}

export interface AIDetectionResult {
  available: boolean;
  result?: AIEnhancedDetection;
  error?: string;
}

/**
 * Run AI analysis to enhance init command with intelligent defaults
 */
export async function runAIDetectionForInit(
  projectPath: string,
  skipAI: boolean = false
): Promise<AIDetectionResult> {
  // Skip if requested or no API keys available
  if (skipAI || !isAIAnalysisAvailable()) {
    return { available: false };
  }

  try {
    const analyzer = createAIAnalyzer();
    if (!analyzer) {
      return { available: false };
    }

    // Run AI analysis (static + AI insights)
    const result = await analyzer.analyze(projectPath, {
      samplingStrategy: 'minimal',
      useCache: true
    });

    // Map AI results to init wizard options
    const enhanced = mapAIResultsToInitOptions(result);

    return {
      available: true,
      result: enhanced
    };
  } catch (error) {
    return {
      available: false,
      error: (error as Error).message
    };
  }
}

/**
 * Map AI analysis results to init wizard options
 */
function mapAIResultsToInitOptions(result: AnalysisResult): AIEnhancedDetection {
  const projectType = detectProjectType(result);
  const architecture = detectArchitecture(result);
  const datasource = detectDatasource(result);
  const frameworks = extractFrameworks(result);

  return {
    projectType,
    architecture,
    datasource,
    confidence: result.confidence || 0,
    frameworks,
    reasoning: result.reasoning || '',
    executionTime: result.executionTime
  };
}

/**
 * Detect project type from AI analysis
 */
function detectProjectType(result: AnalysisResult): ProjectType | undefined {
  const projectTypeStr = result.projectType?.toLowerCase() || '';
  const architecture = result.architecture?.toLowerCase() || '';
  const frameworks = result.frameworks || [];

  // Check for web frameworks
  const webFrameworks = ['react', 'vue', 'angular', 'svelte', 'next.js', 'nuxt', 'gatsby', 'remix'];
  if (frameworks.some(f => webFrameworks.some(wf => f.toLowerCase().includes(wf)))) {
    return 'web';
  }

  // Check for API/Backend indicators
  const apiFrameworks = ['express', 'fastify', 'koa', 'hapi', 'nestjs', 'fastapi', 'django', 'flask', 'gin', 'echo', 'actix'];
  if (frameworks.some(f => apiFrameworks.some(af => f.toLowerCase().includes(af)))) {
    return 'api';
  }

  // Check for CLI tools
  if (projectTypeStr.includes('cli') || projectTypeStr.includes('command-line')) {
    return 'cli';
  }

  // Check for libraries
  if (projectTypeStr.includes('library') || projectTypeStr.includes('package')) {
    return 'library';
  }

  // Check for desktop apps
  const desktopFrameworks = ['electron', 'tauri'];
  if (frameworks.some(f => desktopFrameworks.some(df => f.toLowerCase().includes(df)))) {
    return 'desktop';
  }

  // Check for mobile apps
  const mobileFrameworks = ['react-native', 'flutter', 'expo'];
  if (frameworks.some(f => mobileFrameworks.some(mf => f.toLowerCase().includes(mf)))) {
    return 'mobile';
  }

  // Fallback based on AI projectType
  if (projectTypeStr.includes('web')) return 'web';
  if (projectTypeStr.includes('api') || projectTypeStr.includes('backend')) return 'api';
  if (projectTypeStr.includes('desktop')) return 'desktop';
  if (projectTypeStr.includes('mobile')) return 'mobile';

  return undefined;
}

/**
 * Detect architecture pattern from AI analysis
 */
function detectArchitecture(result: AnalysisResult): ArchitectureType | undefined {
  const archStr = result.architecture?.toLowerCase() || '';
  const reasoning = result.reasoning?.toLowerCase() || '';
  const combined = `${archStr} ${reasoning}`;

  // Map AI architecture to our options
  if (combined.includes('microservice')) {
    return 'microservices';
  }

  if (combined.includes('event-driven') || combined.includes('event sourcing') || combined.includes('cqrs')) {
    return 'event-driven';
  }

  if (combined.includes('hexagonal') || combined.includes('ports and adapters') || combined.includes('ports & adapters')) {
    return 'hexagonal';
  }

  if (combined.includes('clean architecture') || combined.includes('clean-architecture')) {
    return 'clean-architecture';
  }

  if (combined.includes('domain-driven') || combined.includes('ddd') || combined.includes('bounded context')) {
    return 'ddd';
  }

  if (combined.includes('serverless') || combined.includes('faas') || combined.includes('lambda')) {
    return 'serverless';
  }

  if (combined.includes('modular monolith') || combined.includes('modular-monolith')) {
    return 'modular-monolith';
  }

  if (combined.includes('layered') || combined.includes('three-tier') || combined.includes('n-tier')) {
    return 'layered';
  }

  // Default to modular-monolith for most projects
  return 'modular-monolith';
}

/**
 * Detect datasource type from AI analysis
 */
function detectDatasource(result: AnalysisResult): DatasourceType | undefined {
  const dependencies = result.dependencies?.dependencies || [];
  const devDeps = result.dependencies?.devDependencies || [];
  const allDeps = [...dependencies, ...devDeps].map(d => d.toLowerCase());

  // Check for SQL databases
  const sqlDeps = ['pg', 'postgres', 'mysql', 'mysql2', 'sqlite3', 'better-sqlite3', 'mssql', 'oracledb', 'typeorm', 'sequelize', 'knex', 'prisma'];
  if (allDeps.some(dep => sqlDeps.some(sql => dep.includes(sql)))) {
    return 'sql';
  }

  // Check for NoSQL databases
  const nosqlDeps = ['mongodb', 'mongoose', 'redis', 'ioredis', 'dynamodb', 'cassandra', 'couchdb', 'neo4j', 'elasticsearch'];
  if (allDeps.some(dep => nosqlDeps.some(nosql => dep.includes(nosql)))) {
    return 'nosql';
  }

  // If no database detected, return none
  return 'none';
}

/**
 * Extract framework names from AI analysis
 */
function extractFrameworks(result: AnalysisResult): string[] {
  const frameworks: string[] = [];

  // Add detected frameworks from static analysis
  if (result.frameworks?.web) frameworks.push(...result.frameworks.web);
  if (result.frameworks?.backend) frameworks.push(...result.frameworks.backend);
  if (result.frameworks?.testing) frameworks.push(...result.frameworks.testing);
  if (result.frameworks?.mobile) frameworks.push(...result.frameworks.mobile);

  return frameworks.filter((f, i, arr) => arr.indexOf(f) === i); // deduplicate
}
