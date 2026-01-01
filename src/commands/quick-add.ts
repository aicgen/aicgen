import { select, checkbox, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { existsSync } from 'fs';
import { readFile, writeFile, appendFile, mkdir } from 'fs/promises';
import { join } from 'path';
import ora from 'ora';
import { AIAssistant, Language, ProjectType } from '../models/project';
import { GuidelineLoader } from '../services/guideline-loader';
import { showBanner } from '../utils/banner';
import { AssistantFileWriter } from '../services/assistant-file-writer';
import { ProfileSelection, ArchitectureType, InstructionLevel } from '../models/profile';
import { ConfigGenerator } from '../services/config-generator';

interface CheckboxChoice {
  name: string;
  value: string;
  checked?: boolean;
  disabled?: boolean | string;
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
    const categoryTree = loader.getCategoryTree(
      existingConfig.language,
      existingConfig.level,
      existingConfig.architecture || 'modular-monolith',
      existingConfig.datasource || 'sql'
    );

    // Build choices
    const choices: CheckboxChoice[] = [];
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
          await appendGuidelines(projectPath, assistant, validIds, loader);
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

async function detectAssistant(projectPath: string): Promise<AIAssistant | null> {
  const configs = [
    { path: 'CLAUDE.md', assistant: 'claude-code' as AIAssistant },
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
    let filePath = '';

    switch (assistant) {
      case 'claude-code': {
        // Check root first, then .claude/ for backward compatibility
        const rootPath = join(projectPath, 'CLAUDE.md');
        const legacyPath = join(projectPath, '.claude', 'CLAUDE.md');
        filePath = existsSync(rootPath) ? rootPath : legacyPath;
        break;
      }
      case 'copilot':
        filePath = join(projectPath, '.github', 'copilot-instructions.md');
        break;
      case 'gemini':
        filePath = join(projectPath, '.gemini', 'instructions.md');
        break;
      case 'antigravity':
        filePath = join(projectPath, '.agent', 'rules', 'instructions.md');
        break;
      case 'codex':
        filePath = join(projectPath, '.codex', 'instructions.md');
        break;
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
  // Check root first, then .claude/ for backward compatibility
  const rootPath = join(projectPath, 'CLAUDE.md');
  const legacyPath = join(projectPath, '.claude', 'CLAUDE.md');
  const instructionsPath = existsSync(rootPath) ? rootPath : legacyPath;

  if (!existsSync(instructionsPath)) {
    throw new Error('CLAUDE.md not found');
  }

  // Create guidelines directory
  const guidelinesDir = join(projectPath, '.claude', 'guidelines');
  await mkdir(guidelinesDir, { recursive: true });

  // Create or append to additional.md file
  const additionalFile = join(guidelinesDir, 'additional.md');
  const additionalContent = `# Additional Guidelines\n\n${guidelines.join('\n\n---\n\n')}`;

  if (existsSync(additionalFile)) {
    // Append to existing file
    await appendFile(additionalFile, `\n\n---\n\n${guidelines.join('\n\n---\n\n')}`, 'utf-8');
  } else {
    // Create new file
    await writeFile(additionalFile, additionalContent, 'utf-8');
  }

  // Update CLAUDE.md with reference if not already present
  const content = await readFile(instructionsPath, 'utf-8');

  if (content.includes('@.claude/guidelines/additional.md')) {
    // Reference already exists, file is updated, we're done
    return;
  }

  // Add reference to guidelines section
  const guidelinesMatch = content.match(/(## Guidelines[\s\S]*?)(?=\n## |$)/);
  if (guidelinesMatch) {
    const guidelinesSection = guidelinesMatch[1];
    const newGuidelinesSection = guidelinesSection.trimEnd() + '\n- **Additional**: @.claude/guidelines/additional.md';
    const newContent = content.replace(guidelinesSection, newGuidelinesSection);
    await writeFile(instructionsPath, newContent, 'utf-8');
  } else {
    // Fallback: append to end of file
    const newContent = content.trimEnd() + '\n\n- **Additional**: @.claude/guidelines/additional.md\n';
    await writeFile(instructionsPath, newContent, 'utf-8');
  }
}

async function appendToCopilot(projectPath: string, guidelines: string[]): Promise<void> {
  const instructionsPath = join(projectPath, '.github', 'copilot-instructions.md');

  if (!existsSync(instructionsPath)) {
    throw new Error('copilot-instructions.md not found');
  }

  // Create instructions directory
  const instructionsDir = join(projectPath, '.github', 'instructions');
  await mkdir(instructionsDir, { recursive: true });

  // Create additional instructions file with frontmatter
  const additionalFile = join(instructionsDir, 'additional.instructions.md');
  const additionalContent = `---
applyTo: "**/*"
description: "Additional guidelines"
---

# Additional Guidelines

${guidelines.join('\n\n---\n\n')}`;

  if (existsSync(additionalFile)) {
    // Append to existing file (skip frontmatter)
    await appendFile(additionalFile, `\n\n---\n\n${guidelines.join('\n\n---\n\n')}`, 'utf-8');
  } else {
    // Create new file
    await writeFile(additionalFile, additionalContent, 'utf-8');
  }

  // Update copilot-instructions.md with reference if not already present
  const content = await readFile(instructionsPath, 'utf-8');

  if (content.includes('@.github/instructions/additional.instructions.md')) {
    // Reference already exists
    return;
  }

  // Add reference to guidelines section
  const guidelinesMatch = content.match(/(## Guidelines[\s\S]*?)(?=\n## |$)/);
  if (guidelinesMatch) {
    const guidelinesSection = guidelinesMatch[1];
    const newGuidelinesSection = guidelinesSection.trimEnd() + '\n- Additional: @.github/instructions/additional.instructions.md';
    const newContent = content.replace(guidelinesSection, newGuidelinesSection);
    await writeFile(instructionsPath, newContent, 'utf-8');
  } else {
    // Fallback: append to end
    const newContent = content.trimEnd() + '\n\n- Additional: @.github/instructions/additional.instructions.md\n';
    await writeFile(instructionsPath, newContent, 'utf-8');
  }
}

async function appendToGemini(projectPath: string, guidelines: string[]): Promise<void> {
  const instructionsPath = join(projectPath, '.gemini', 'instructions.md');

  if (!existsSync(instructionsPath)) {
    throw new Error('instructions.md not found');
  }

  // Create guidelines directory
  const geminiDir = join(projectPath, '.gemini');
  await mkdir(geminiDir, { recursive: true });

  // Create additional guidelines file
  const additionalFile = join(geminiDir, 'additional-guidelines.md');
  const additionalContent = `# Additional Guidelines\n\n${guidelines.join('\n\n---\n\n')}`;

  if (existsSync(additionalFile)) {
    // Append to existing file
    await appendFile(additionalFile, `\n\n---\n\n${guidelines.join('\n\n---\n\n')}`, 'utf-8');
  } else {
    // Create new file
    await writeFile(additionalFile, additionalContent, 'utf-8');
  }

  // Update instructions.md with import reference if not already present
  const content = await readFile(instructionsPath, 'utf-8');

  if (content.includes('additional-guidelines.md')) {
    // Reference already exists
    return;
  }

  // Add reference before the closing section
  const newContent = content.trimEnd() + `\n\n## Additional Guidelines\n\nSee: additional-guidelines.md\n`;
  await writeFile(instructionsPath, newContent, 'utf-8');
}

async function appendToAntigravity(
  projectPath: string,
  guidelines: string[]
): Promise<void> {
  // Create rules directory
  const rulesDir = join(projectPath, '.agent', 'rules');
  await mkdir(rulesDir, { recursive: true });

  // Create additional rules file
  const additionalRulesPath = join(rulesDir, 'additional.md');
  const additionalContent = `# Additional Rules\n\n${guidelines.join('\n\n---\n\n')}\n\n---\n*Generated by aicgen*\n`;

  if (existsSync(additionalRulesPath)) {
    // Append to existing file
    await appendFile(additionalRulesPath, `\n\n---\n\n${guidelines.join('\n\n---\n\n')}`, 'utf-8');
  } else {
    // Create new file
    await writeFile(additionalRulesPath, additionalContent, 'utf-8');
  }

  // Update instructions.md with reference if not already present
  const instructionsPath = join(rulesDir, 'instructions.md');
  if (existsSync(instructionsPath)) {
    const content = await readFile(instructionsPath, 'utf-8');

    if (content.includes('@.agent/rules/additional.md')) {
      // Reference already exists
      return;
    }

    // Add reference to rule index section
    const ruleIndexMatch = content.match(/(## Rule Index[\s\S]*?)(?=\n## |$)/);
    if (ruleIndexMatch) {
      const ruleIndexSection = ruleIndexMatch[1];
      const newRuleIndexSection = ruleIndexSection.trimEnd() + '\n- **Additional**: @.agent/rules/additional.md';
      const newContent = content.replace(ruleIndexSection, newRuleIndexSection);
      await writeFile(instructionsPath, newContent, 'utf-8');
    } else {
      // Fallback: append to end
      const newContent = content.trimEnd() + '\n\n- **Additional**: @.agent/rules/additional.md\n';
      await writeFile(instructionsPath, newContent, 'utf-8');
    }
  }
}

async function appendToCodex(projectPath: string, guidelines: string[]): Promise<void> {
  const instructionsPath = join(projectPath, '.codex', 'instructions.md');

  if (!existsSync(instructionsPath)) {
    throw new Error('instructions.md not found');
  }

  // Create codex directory
  const codexDir = join(projectPath, '.codex');
  await mkdir(codexDir, { recursive: true });

  // Create additional guidelines file
  const additionalFile = join(codexDir, 'additional-guidelines.md');
  const additionalContent = `# Additional Guidelines\n\n${guidelines.join('\n\n---\n\n')}`;

  if (existsSync(additionalFile)) {
    // Append to existing file
    await appendFile(additionalFile, `\n\n---\n\n${guidelines.join('\n\n---\n\n')}`, 'utf-8');
  } else {
    // Create new file
    await writeFile(additionalFile, additionalContent, 'utf-8');
  }

  // Update instructions.md with import reference if not already present
  const content = await readFile(instructionsPath, 'utf-8');

  if (content.includes('additional-guidelines.md')) {
    // Reference already exists
    return;
  }

  // Add reference before the closing section
  const newContent = content.trimEnd() + `\n\n## Additional Guidelines\n\nSee: additional-guidelines.md\n`;
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
    existingConfig.language,
    existingConfig.level,
    existingConfig.architecture,
    existingConfig.datasource
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
