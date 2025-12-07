import { join } from 'path';
import { exists, readJSON } from '../utils/file.js';
import { GuidelineLoader } from './guideline-loader.js';
import { AssistantFileWriter } from './assistant-file-writer.js';
import { DetectedProject, Language } from '../models/project.js';
import { ProfileSelection } from '../models/profile.js';

export interface GenerationOptions {
  projectPath: string;
  selection: ProfileSelection;
  dryRun?: boolean;
}

export interface GenerationResult {
  success: boolean;
  filesGenerated: string[];
  errors: string[];
}

export class ConfigGenerator {
  private guidelineLoader: GuidelineLoader;
  private fileWriter: AssistantFileWriter;

  constructor() {
    this.guidelineLoader = new GuidelineLoader();
    this.fileWriter = new AssistantFileWriter();
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

    try {
      const assembledContent = this.guidelineLoader.assembleProfile(
        options.selection.assistant,
        options.selection.language,
        options.selection.level,
        options.selection.architecture
      );

      const files = this.fileWriter.generateFiles(
        options.selection.assistant,
        assembledContent,
        options.selection,
        options.projectPath
      );

      if (options.dryRun) {
        return {
          success: true,
          filesGenerated: files.map(f => f.path),
          errors: []
        };
      }

      await this.fileWriter.writeFiles(files);
      files.forEach(f => filesGenerated.push(f.path));

      return {
        success: true,
        filesGenerated,
        errors: []
      };
    } catch (error) {
      errors.push((error as Error).message);
      return {
        success: false,
        filesGenerated,
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
    return 'unknown';
  }

  private async hasExistingConfig(projectPath: string): Promise<boolean> {
    return (
      await exists(join(projectPath, 'claude.md')) ||
      await exists(join(projectPath, '.claude')) ||
      await exists(join(projectPath, '.github', 'copilot-instructions.md')) ||
      await exists(join(projectPath, '.gemini')) ||
      await exists(join(projectPath, '.agent')) ||
      await exists(join(projectPath, '.codex'))
    );
  }
}
