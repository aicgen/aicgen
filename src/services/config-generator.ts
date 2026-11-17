import { summarizeFindings } from './context-budget.js';
import { findLegacyOutputs, removeLegacyOutputs } from './legacy-migration.js';
import { join } from 'path';
import { exists, readJSON } from '../utils/file';
import { GuidelineLoader } from './guideline-loader';
import { AssistantFileWriter } from './assistant-file-writer';
import { DetectedProject, Language } from '../models/project';
import { ProfileSelection } from '../models/profile';
import { CONFIG } from '../config.js';
import { getAssistantConfigPaths, listAssistantDefinitions } from './assistant-registry.js';

export interface GenerationOptions {
  projectPath: string;
  selection: ProfileSelection;
  customGuidelineIds?: string[];
  dryRun?: boolean;
}

export interface GenerationResult {
  success: boolean;
  filesGenerated: string[];
  conflicts: string[];
  errors: string[];
  /** Context budget summary for the generated instruction files. */
  budget?: {
    alwaysOnTokens: number;
    onDemandFiles: number;
    warnings: string[];
  };
  /** aicgen 1.x outputs that were (or, in a dry run, would be) replaced by the 2.0 layout. */
  migrated?: string[];
}

export class ConfigGenerator {
  private guidelineLoader: GuidelineLoader;
  private fileWriter: AssistantFileWriter;

  static async create(): Promise<ConfigGenerator> {
    const guidelineLoader = await GuidelineLoader.create();
    const fileWriter = await AssistantFileWriter.create(undefined, CONFIG.APP_VERSION);
    return new ConfigGenerator(guidelineLoader, fileWriter);
  }

  private constructor(guidelineLoader: GuidelineLoader, fileWriter: AssistantFileWriter) {
    this.guidelineLoader = guidelineLoader;
    this.fileWriter = fileWriter;
  }

  async detectProject(projectPath: string): Promise<DetectedProject> {
    const name = await this.getProjectName(projectPath);
    const language = await this.detectLanguage(projectPath);
    const hasExistingConfig = await this.hasExistingConfig(projectPath);

    return { name, language, hasExistingConfig };
  }

  async generate(options: GenerationOptions): Promise<GenerationResult> {
    const errors: string[] = [];
    const filesGenerated: string[] = [];
    const conflicts: string[] = [];

    try {
      const guidelineIds = options.customGuidelineIds || this.guidelineLoader.getGuidelinesForProfile(
        options.selection.language,
        options.selection.level,
        options.selection.architecture,
        options.selection.datasource
      );

      if (guidelineIds.length === 0) {
        throw new Error(`No guidelines found for profile: ${options.selection.language}-${options.selection.level}-${options.selection.architecture}`);
      }

      const files = await this.fileWriter.generateFiles(
        options.selection.assistant,
        guidelineIds,
        options.selection,
        options.projectPath
      );

      const findings = this.fileWriter.analyzeBudget(options.selection.assistant, options.selection, files);
      const summary = summarizeFindings(findings);
      const budget = {
        alwaysOnTokens: summary.alwaysOnTokens,
        onDemandFiles: findings.filter(f => f.kind === 'scoped-rule' || f.kind === 'skill').length,
        warnings: [...summary.errors, ...summary.warnings].map(f => `${f.path.replace(options.projectPath, '').replace(/^[/\\]/, '')}: ${f.message}`),
      };

      if (summary.errors.length > 0) {
        throw new Error(`Generated files exceed assistant limits:\n${budget.warnings.join('\n')}`);
      }

      const migrated = await findLegacyOutputs(options.projectPath, options.selection.assistant);

      if (options.dryRun) {
        conflicts.push(...await this.findConflicts(files.map(file => file.path)));
        return {
          success: true,
          filesGenerated: files.map(f => f.path),
          conflicts,
          errors: [],
          budget,
          migrated
        };
      }

      conflicts.push(...await this.findConflicts(files.map(file => file.path)));
      await removeLegacyOutputs(migrated);
      await this.fileWriter.writeFiles(files);
      files.forEach(f => filesGenerated.push(f.path));

      return {
        success: true,
        filesGenerated,
        conflicts,
        errors: [],
        budget,
        migrated
      };
    } catch (error) {
      errors.push((error as Error).message);
      return {
        success: false,
        filesGenerated,
        conflicts,
        errors
      };
    }
  }

  getStats() {
    return this.guidelineLoader.getStats();
  }

  private async getProjectName(projectPath: string): Promise<string> {
    const pkgPath = join(projectPath, 'package.json');
    if (await exists(pkgPath)) {
      try {
        const pkg = await readJSON<{ name?: string }>(pkgPath);
        if (pkg.name) return pkg.name;
      } catch {
        // Ignore
      }
    }

    const parts = projectPath.split(/[/\\]/);
    return parts[parts.length - 1] || 'project';
  }

  private async detectLanguage(projectPath: string): Promise<Language> {
    if (await exists(join(projectPath, 'tsconfig.json'))) {
      return 'typescript';
    }
    // Cargo.toml wins over a bare package.json (napi-rs / wasm-pack style repos)
    if (await exists(join(projectPath, 'Cargo.toml'))) {
      return 'rust';
    }
    if (await exists(join(projectPath, 'package.json'))) {
      return 'javascript';
    }
    if (await exists(join(projectPath, 'requirements.txt')) ||
        await exists(join(projectPath, 'pyproject.toml')) ||
        await exists(join(projectPath, 'Pipfile'))) {
      return 'python';
    }
    if (await exists(join(projectPath, 'go.mod'))) {
      return 'go';
    }
    if (await exists(join(projectPath, 'Cargo.toml'))) {
      return 'rust';
    }
    if (await exists(join(projectPath, 'pom.xml')) ||
        await exists(join(projectPath, 'build.gradle'))) {
      return 'java';
    }
    if (await exists(join(projectPath, 'Gemfile'))) {
      return 'ruby';
    }
    if (await exists(join(projectPath, 'pubspec.yaml'))) {
      return 'dart';
    }
    if (await exists(join(projectPath, 'Package.swift'))) {
      return 'swift';
    }
    if (await exists(join(projectPath, 'build.gradle.kts')) ||
        await exists(join(projectPath, 'settings.gradle.kts')) ||
        await exists(join(projectPath, 'src/main/kotlin'))) {
      return 'kotlin';
    }
    if (await exists(join(projectPath, 'composer.json'))) {
      return 'php';
    }
    return 'unknown';
  }

  private async hasExistingConfig(projectPath: string): Promise<boolean> {
    const checks = listAssistantDefinitions()
      .flatMap(definition => getAssistantConfigPaths(definition.id, projectPath))
      .map(path => exists(path));

    return (await Promise.all(checks)).some(Boolean);
  }

  private async findConflicts(paths: string[]): Promise<string[]> {
    const uniquePaths = [...new Set(paths)];
    const results = await Promise.all(uniquePaths.map(async path => ({
      path,
      exists: await exists(path),
    })));

    return results
      .filter(result => result.exists)
      .map(result => result.path);
  }
}
