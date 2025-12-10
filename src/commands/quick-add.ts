import { select, checkbox } from '@inquirer/prompts';
import chalk from 'chalk';
import { existsSync } from 'fs';
import { readFile, writeFile, appendFile } from 'fs/promises';
import { join } from 'path';
import ora from 'ora';
import { AIAssistant, Language } from '../models/project.js';
import { GuidelineLoader } from '../services/guideline-loader.js';
import { showBanner } from '../utils/banner.js';
import { AssistantFileWriter } from '../services/assistant-file-writer.js';
import { ProfileSelection } from '../models/profile.js';

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

  // Organize by category
  const categoryTree = loader.getCategoryTree(
    existingConfig.language,
    existingConfig.level,
    existingConfig.architecture || 'modular-monolith'
  );

  // Build choices
  const choices: any[] = [];
  const guidelineMap = new Map<string, string>();

  for (const category of categoryTree) {
    choices.push({
      name: chalk.bold.cyan(`${category.name} (${category.count})`),
      value: `__CATEGORY_${category.name}__`,
      disabled: true
    });

    for (const guideline of category.guidelines) {
      choices.push({
        name: `   ${guideline.name}`,
        value: guideline.id,
        checked: false
      });
      guidelineMap.set(guideline.id, guideline.name);
    }
  }

  // Let user select guidelines
  const selectedIds = await checkbox({
    message: 'Select guidelines to add (Space to toggle, Enter to confirm):',
    choices,
    pageSize: 25,
    loop: false
  }) as string[];

  if (selectedIds.length === 0) {
    console.log(chalk.gray('\nNo guidelines selected.'));
    return;
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

  // Ask how to add
  const addMode = await select({
    message: 'How would you like to add these guidelines?',
    choices: [
      { value: 'append', name: 'Append to existing config', description: 'Add to current configuration' },
      { value: 'replace', name: 'Replace entire config', description: 'Regenerate with selected + existing guidelines' },
      { value: 'cancel', name: 'Cancel', description: 'Exit without changes' }
    ]
  });

  if (addMode === 'cancel') {
    console.log(chalk.gray('\nCancelled.'));
    return;
  }

  spinner.start('Adding guidelines...');

  try {
    if (addMode === 'append') {
      await appendGuidelines(projectPath, assistant, validIds, loader);
    } else {
      await regenerateConfig(projectPath, existingConfig, validIds, loader);
    }

    spinner.succeed('Guidelines added successfully!');
    console.log(chalk.green(`\n✅ Added ${validIds.length} guideline(s) to ${assistant} configuration`));
  } catch (error) {
    spinner.fail('Failed to add guidelines');
    console.error(chalk.red(`\n❌ Error: ${error}`));
  }
}

async function detectAssistant(projectPath: string): Promise<AIAssistant | null> {
  const configs = [
    { path: '.claude', assistant: 'claude-code' as AIAssistant },
    { path: '.github/copilot-instructions.md', assistant: 'copilot' as AIAssistant },
    { path: '.gemini', assistant: 'gemini' as AIAssistant },
    { path: '.agent', assistant: 'antigravity' as AIAssistant },
    { path: '.codex', assistant: 'codex' as AIAssistant }
  ];

  for (const config of configs) {
    if (existsSync(join(projectPath, config.path))) {
      return config.assistant;
    }
  }

  return null;
}

async function loadExistingConfig(_projectPath: string, assistant: AIAssistant): Promise<ProfileSelection> {
  // Try to extract config from existing files
  // For now, return defaults - in real implementation, parse the config files
  return {
    assistant,
    language: 'typescript' as Language, // TODO: detect from project
    level: 'standard',
    architecture: 'modular-monolith',
    projectType: 'web'
  };
}

async function appendGuidelines(
  projectPath: string,
  assistant: AIAssistant,
  guidelineIds: string[],
  loader: GuidelineLoader
): Promise<void> {
  const guidelines = guidelineIds.map(id => loader.loadGuideline(id)).filter(Boolean);

  switch (assistant) {
    case 'claude-code':
      await appendToClaudeCode(projectPath, guidelines);
      break;
    case 'copilot':
      await appendToCopilot(projectPath, guidelines);
      break;
    case 'gemini':
      await appendToGemini(projectPath, guidelines);
      break;
    case 'antigravity':
      await appendToAntigravity(projectPath, guidelines);
      break;
    case 'codex':
      await appendToCodex(projectPath, guidelines);
      break;
  }
}

async function appendToClaudeCode(projectPath: string, guidelines: string[]): Promise<void> {
  const instructionsPath = join(projectPath, '.claude', 'CLAUDE.md');

  if (!existsSync(instructionsPath)) {
    throw new Error('CLAUDE.md not found');
  }

  const content = await readFile(instructionsPath, 'utf-8');
  const newContent = `${content}\n\n## Additional Guidelines\n\n${guidelines.join('\n\n---\n\n')}`;

  await writeFile(instructionsPath, newContent, 'utf-8');
}

async function appendToCopilot(projectPath: string, guidelines: string[]): Promise<void> {
  const instructionsPath = join(projectPath, '.github', 'copilot-instructions.md');

  if (!existsSync(instructionsPath)) {
    throw new Error('copilot-instructions.md not found');
  }

  const content = await readFile(instructionsPath, 'utf-8');
  const newContent = `${content}\n\n## Additional Guidelines\n\n${guidelines.join('\n\n---\n\n')}`;

  await writeFile(instructionsPath, newContent, 'utf-8');
}

async function appendToGemini(projectPath: string, guidelines: string[]): Promise<void> {
  const instructionsPath = join(projectPath, '.gemini', 'instructions.md');

  if (!existsSync(instructionsPath)) {
    throw new Error('instructions.md not found');
  }

  const content = await readFile(instructionsPath, 'utf-8');
  const newContent = `${content}\n\n## Additional Guidelines\n\n${guidelines.join('\n\n---\n\n')}`;

  await writeFile(instructionsPath, newContent, 'utf-8');
}

async function appendToAntigravity(
  projectPath: string,
  guidelines: string[]
): Promise<void> {
  // For Antigravity, create a new rule file for the added guidelines
  const rulesDir = join(projectPath, '.agent', 'rules');
  const additionalRulesPath = join(rulesDir, 'additional-guidelines.md');

  // Convert to bullet points
  const bullets = guidelines.map(g => {
    const lines = g.split('\n').filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('---'));
    return lines.map(l => l.trim().startsWith('*') ? l : `* ${l}`).join('\n');
  }).join('\n');

  if (existsSync(additionalRulesPath)) {
    await appendFile(additionalRulesPath, `\n\n${bullets}`, 'utf-8');
  } else {
    await writeFile(additionalRulesPath, bullets, 'utf-8');
  }
}

async function appendToCodex(projectPath: string, guidelines: string[]): Promise<void> {
  const instructionsPath = join(projectPath, '.codex', 'instructions.md');

  if (!existsSync(instructionsPath)) {
    throw new Error('instructions.md not found');
  }

  const content = await readFile(instructionsPath, 'utf-8');
  const newContent = `${content}\n\n## Additional Guidelines\n\n${guidelines.join('\n\n---\n\n')}`;

  await writeFile(instructionsPath, newContent, 'utf-8');
}

async function regenerateConfig(
  projectPath: string,
  existingConfig: ProfileSelection,
  additionalIds: string[],
  loader: GuidelineLoader
): Promise<void> {
  // Get existing guidelines + new ones
  const existingIds = loader.getGuidelinesForProfile(
    existingConfig.assistant,
    existingConfig.language,
    existingConfig.level,
    existingConfig.architecture
  );

  const allIds = [...new Set([...existingIds, ...additionalIds])];

  // Regenerate configuration with all guidelines
  const fileWriter = await AssistantFileWriter.create();
  const files = await fileWriter.generateFiles(
    existingConfig.assistant,
    allIds,
    existingConfig,
    projectPath
  );

  await fileWriter.writeFiles(files);
}
