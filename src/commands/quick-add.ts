import { select, checkbox, confirm, Separator } from '@inquirer/prompts';
import chalk from 'chalk';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';
import ora from 'ora';
import { AIAssistant, Language, ProjectType } from '../models/project';
import { GuidelineLoader } from '../services/guideline-loader';
import { showBanner } from '../utils/banner';
import { AssistantFileWriter } from '../services/assistant-file-writer';
import { ProfileSelection, ArchitectureType, InstructionLevel } from '../models/profile';
import { ConfigGenerator } from '../services/config-generator';
import { CONFIG } from '../config.js';
import { detectAssistant } from '../services/assistant-registry.js';
import { buildGuidelineUnits, renderGuidelineFiles } from '../services/guideline-delivery.js';
import { writeFiles } from '../utils/file.js';
import type { CategoryNode } from '../services/guideline-loader';

interface CheckboxChoice {
  name: string;
  value: string;
  checked?: boolean;
  disabled?: boolean | string;
  description?: string;
}

/**
 * Guidelines worth offering: everything available for this language (up to the `full` level)
 * that the current profile does not already include. Offering only the current level would list
 * exactly what is already installed.
 */
export function buildAddableTree(loader: GuidelineLoader, config: ProfileSelection): CategoryNode[] {
  const installed = new Set(loader.getGuidelinesForProfile(config.language, config.level, config.architecture, config.datasource));

  return loader.getCategoryTree(config.language, 'full', config.architecture, config.datasource)
    .map(category => {
      const guidelines = category.guidelines.filter(guideline => !installed.has(guideline.id));
      return { ...category, guidelines, count: guidelines.length };
    })
    .filter(category => category.count > 0);
}


export async function quickAddCommand() {
  showBanner();
  console.log(chalk.cyan('🚀 Quick Add Guidelines\n'));

  const projectPath = process.cwd();
  const spinner = ora('Detecting project configuration...').start();

  // Detect which assistant is being used
  const assistant = await detectAssistant(projectPath);

  if (!assistant) {
    spinner.fail('No AI configuration found');
    console.log(chalk.yellow('\n⚠️  No existing AI configuration detected.'));
    console.log(chalk.gray('   Run `aicgen init` first to create a configuration.\n'));
    return;
  }

  spinner.succeed(`Detected: ${assistant}`);

  // Load existing configuration
  const existingConfig = await loadExistingConfig(projectPath, assistant);

  console.log(chalk.cyan('\n📋 Current Configuration:'));
  console.log(`   Assistant: ${existingConfig.assistant}`);
  console.log(`   Language: ${existingConfig.language}`);
  console.log(`   Level: ${existingConfig.level}`);
  console.log(`   Architecture: ${existingConfig.architecture || 'Not specified'}`);

  // Load guideline library
  const loader = await GuidelineLoader.create();

  let continueLoop = true;
  while (continueLoop) {
    // Organize by category
    const categoryTree = buildAddableTree(loader, {
      ...existingConfig,
      architecture: existingConfig.architecture || 'modular-monolith',
      datasource: existingConfig.datasource || 'sql',
    });

    if (categoryTree.length === 0) {
      console.log(chalk.gray('\nEvery available guideline for this project is already part of your configuration.'));
      return;
    }

    // Build choices
    const choices: Array<CheckboxChoice | Separator> = [];
    const guidelineMap = new Map<string, string>();

    for (const category of categoryTree) {
      // A separator is skipped by the cursor, unlike a disabled choice that starts focused.
      choices.push(new Separator(chalk.bold.cyan(`${category.name} (${category.count})`)));

      for (const guideline of category.guidelines) {
        choices.push({
          // The id is unique and readable; file names such as "patterns" repeat across categories.
          name: guideline.id,
          value: guideline.id,
          checked: false,
          description: guideline.description
        });
        guidelineMap.set(guideline.id, guideline.id);
      }
    }

    // Let user select guidelines
    const selectedIds = await checkbox({
      message: 'Select guidelines to add (Space to toggle, Enter to confirm, or press Enter with no selection to cancel):',
      choices,
      pageSize: 25,
      loop: false
    }) as string[];

    if (selectedIds.length === 0) {
      const action = await select({
        message: 'No guidelines selected. What would you like to do?',
        choices: [
          { value: 'retry', name: 'Try again', description: 'Go back to guideline selection' },
          { value: 'cancel', name: 'Cancel', description: 'Exit without changes' }
        ]
      });

      if (action === 'cancel') {
        console.log(chalk.gray('\nCancelled.'));
        return;
      }

      console.clear();
      showBanner();
      console.log(chalk.cyan('🚀 Quick Add Guidelines\n'));
      console.log(chalk.cyan('📋 Current Configuration:'));
      console.log(`   Assistant: ${existingConfig.assistant}`);
      console.log(`   Language: ${existingConfig.language}`);
      console.log(`   Level: ${existingConfig.level}`);
      console.log(`   Architecture: ${existingConfig.architecture || 'Not specified'}\n`);
      continue;
    }

    // Filter out category separators
    const validIds = selectedIds.filter(id => !id.startsWith('__CATEGORY_'));

    console.log(chalk.cyan(`\n✓ Selected ${validIds.length} guideline(s)`));

    // Show what will be added
    console.log(chalk.cyan('\n📚 Adding:'));
    validIds.slice(0, 10).forEach(id => {
      console.log(`   • ${guidelineMap.get(id) || id}`);
    });
    if (validIds.length > 10) {
      console.log(chalk.gray(`   ... and ${validIds.length - 10} more`));
    }

    // Inner loop for "how to add" and confirmation
    let addModeLoop = true;
    while (addModeLoop) {
      // Ask how to add
      const addChoices = [
        { value: 'append', name: 'Append to existing config', description: 'Add to current configuration' },
        { value: 'replace', name: 'Replace entire config', description: 'Regenerate with selected + existing guidelines' },
        { value: 'back', name: '← Back to selection', description: 'Change selected guidelines' },
        { value: 'cancel', name: 'Cancel', description: 'Exit without changes' }
      ];

      const addMode = await select({
        message: 'How would you like to add these guidelines?',
        choices: addChoices
      });

      if (addMode === 'back') {
        console.clear();
        showBanner();
        console.log(chalk.cyan('🚀 Quick Add Guidelines\n'));
        console.log(chalk.cyan('📋 Current Configuration:'));
        console.log(`   Assistant: ${existingConfig.assistant}`);
        console.log(`   Language: ${existingConfig.language}`);
        console.log(`   Level: ${existingConfig.level}`);
        console.log(`   Architecture: ${existingConfig.architecture || 'Not specified'}\n`);
        addModeLoop = false; // Exit inner loop, continue outer loop
        continue;
      }

      if (addMode === 'cancel') {
        console.log(chalk.gray('\nCancelled.'));
        return;
      }

      // Warn before destructive replace
      if (addMode === 'replace') {
        console.log(chalk.yellow('\n⚠️  Warning: Replace mode will regenerate your entire configuration.'));
        console.log(chalk.gray('   This will overwrite any manual edits to settings, hooks, or guidelines.'));

        const confirmReplace = await confirm({
          message: 'Are you sure you want to replace the entire configuration?',
          default: false
        });

        if (!confirmReplace) {
          console.log(chalk.gray('\nGoing back to mode selection...\n'));
          continue; // Stay in inner loop - go back to "how to add" question
        }
      }

      // Execute the operation
      spinner.start('Adding guidelines...');

      try {
        if (addMode === 'append') {
          await appendGuidelines(projectPath, assistant, validIds, loader, existingConfig.language);
        } else {
          await regenerateConfig(projectPath, existingConfig, validIds, loader);
        }

        spinner.succeed('Guidelines added successfully!');
        console.log(chalk.green(`\n✅ Added ${validIds.length} guideline(s) to ${assistant} configuration`));
        continueLoop = false;
        addModeLoop = false;
      } catch (error) {
        spinner.fail('Failed to add guidelines');
        console.error(chalk.red(`\n❌ Error: ${error}`));
        continueLoop = false;
        addModeLoop = false;
      }
    }
  }
}

async function loadExistingConfig(projectPath: string, assistant: AIAssistant): Promise<ProfileSelection> {
  // Default fallback - get project name from path
  const pathParts = projectPath.split(/[/\\]/);
  const defaultName = pathParts[pathParts.length - 1] || 'project';

  const config: ProfileSelection = {
    assistant,
    language: 'typescript',
    level: 'standard',
    architecture: 'modular-monolith',
    projectType: 'web',
    projectName: defaultName,
    datasource: 'sql'
  };

  // 1. Detect language and name from project files using ConfigGenerator logic
  try {
    const generator = await ConfigGenerator.create();
    const detected = await generator.detectProject(projectPath);
    if (detected.language !== 'unknown') {
      config.language = detected.language;
    }
    config.projectName = detected.name;
  } catch {
    // Ignore errors here
  }

  // 2. Parsed from instruction files if possible
  try {
    let content = '';
    let filePath = join(projectPath, 'AGENTS.md');

    // AGENTS.md carries Language, Type, Level and Architecture for every assistant.
    // Fall back to the tool's own main file for configurations created before 2.0.
    if (!existsSync(filePath)) {
      switch (assistant) {
        case 'claude-code': {
          const rootPath = join(projectPath, 'CLAUDE.md');
          filePath = existsSync(rootPath) ? rootPath : join(projectPath, '.claude', 'CLAUDE.md');
          break;
        }
        case 'copilot':
          filePath = join(projectPath, '.github', 'copilot-instructions.md');
          break;
        case 'antigravity':
          filePath = join(projectPath, '.agents', 'rules', 'aicgen-instructions.md');
          break;
        case 'codex':
          filePath = join(projectPath, '.codex', 'instructions.md');
          break;
      }
    }

    if (filePath && existsSync(filePath)) {
      content = await readFile(filePath, 'utf-8');

      // Extract Language
      const langMatch = content.match(/Language:\*\*\s*([\w-#]+)/i) || content.match(/Language:\s*([\w-#]+)/i);
      if (langMatch && langMatch[1]) {
        config.language = langMatch[1].toLowerCase().trim() as Language;
      }

      // Extract Architecture
      const archMatch = content.match(/Architecture:\*\*\s*([\w-]+)/i) || content.match(/Architecture:\s*([\w-]+)/i);
      if (archMatch && archMatch[1]) {
        config.architecture = archMatch[1].toLowerCase().trim() as ArchitectureType;
      }

      // Extract Type
      const typeMatch = content.match(/Type:\*\*\s*([\w-]+)/i) || content.match(/Type:\s*([\w-]+)/i);
      if (typeMatch && typeMatch[1]) {
        const typeStr = typeMatch[1].toLowerCase().trim();
        // Simple mapping verification
        if (['web', 'api', 'cli', 'library', 'desktop', 'mobile', 'other'].includes(typeStr)) {
          config.projectType = typeStr as ProjectType;
        }
      }

      // Extract Level
      const levelMatch = content.match(/Level:\*\*\s*([\w-]+)/i) || content.match(/Level:\s*([\w-]+)/i);
      if (levelMatch && levelMatch[1]) {
        config.level = levelMatch[1].toLowerCase().trim() as InstructionLevel;
      }
    }
  } catch (err) {
    console.log(chalk.yellow(`\n⚠️  Could not parse existing config, using defaults: ${err}`));
  }

  return config;
}

/**
 * Add guidelines using the same per-guideline delivery as `aicgen init`: path-scoped
 * rules or on-demand skills. Each guideline is its own file, so this is idempotent and
 * never edits (or bloats) the always-on instruction files.
 */
async function appendGuidelines(
  projectPath: string,
  assistant: AIAssistant,
  guidelineIds: string[],
  loader: GuidelineLoader,
  language: string
): Promise<void> {
  const units = buildGuidelineUnits(guidelineIds, loader, language);
  const files = renderGuidelineFiles(assistant, units);

  await writeFiles(files.map(file => ({ path: join(projectPath, file.path), content: file.content })));
}

async function regenerateConfig(
  projectPath: string,
  existingConfig: ProfileSelection,
  additionalIds: string[],
  loader: GuidelineLoader
): Promise<void> {
  // Get existing guidelines + new ones
  const existingIds = loader.getGuidelinesForProfile(
    existingConfig.language,
    existingConfig.level,
    existingConfig.architecture,
    existingConfig.datasource
  );

  const allIds = [...new Set([...existingIds, ...additionalIds])];

  // Regenerate configuration with all guidelines
  const fileWriter = await AssistantFileWriter.create(undefined, CONFIG.APP_VERSION);
  const files = await fileWriter.generateFiles(
    existingConfig.assistant,
    allIds,
    existingConfig,
    projectPath
  );

  await fileWriter.writeFiles(files);
}

