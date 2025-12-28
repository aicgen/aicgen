import { select, confirm } from '@inquirer/prompts';
import ora from 'ora';
import chalk from 'chalk';
import { ConfigGenerator } from '../services/config-generator.js';
import { ProfileSelection, InstructionLevel, ArchitectureType, DatasourceType } from '../models/profile.js';
import { AIAssistant, Language, ProjectType } from '../models/project.js';
import { GuidelineLoader } from '../services/guideline-loader.js';
import { showBanner, showInstructions } from '../utils/banner.js';
import { WizardStateManager, BACK_VALUE, addBackOption } from '../utils/wizard-state.js';
import { createSummaryBox, createMetricsBox } from '../utils/formatting.js';
import { selectGuidelines } from './guideline-selector.js';
import { CONFIG, GITHUB_RELEASES_URL } from '../config.js';
import { ensureDataInitialized } from '../services/first-run-init.js';
import { input } from '@inquirer/prompts';


interface InitOptions {
  assistant?: string;
  level?: string;
  architecture?: string;
  force?: boolean;
  dryRun?: boolean;
  analyze?: boolean;
}

import { LANGUAGES, PROJECT_TYPES, ASSISTANTS, ARCHITECTURES, DATASOURCES } from '../constants.js';

export async function initCommand(options: InitOptions) {
  showBanner();
  showInstructions();

  // First-run initialization
  await ensureDataInitialized();

  // Check for guideline updates (non-blocking)
  checkForUpdatesInBackground();

  const generator = await ConfigGenerator.create();
  const projectPath = process.cwd();
  const wizard = new WizardStateManager();

  const spinner = ora('Detecting project...').start();

  try {
    // Detect project
    const detected = await generator.detectProject(projectPath);
    spinner.succeed('Project detected');

    wizard.updateState({
      detectedLanguage: detected.language !== 'unknown' ? detected.language : undefined,
      detectedProjectName: detected.name,
      hasExistingConfig: detected.hasExistingConfig
    });

    // Show detection results in box
    console.log('\n' + createSummaryBox('📁 Project Detection', [
      { label: 'Name', value: detected.name },
      { label: 'Language', value: detected.language !== 'unknown' ? detected.language : 'Not detected' }
    ]));

    // AI Analysis Flow
    if (options.analyze || await confirm({ message: 'Run AI Project Analysis to suggest optimal config?', default: true })) {
        const { ProjectAnalyzer } = await import('../services/project-analyzer.js');
        const { AIAnalysisService } = await import('../services/ai-analysis-service.js');
        
        const analyzer = new ProjectAnalyzer(projectPath);
        const aiService = new AIAnalysisService();
        
        spinner.start('Performing deep analysis...');
        const context = await analyzer.analyze();
        spinner.text = 'Consulting AI Architect...';
        
        // Check for API Keys
        let apiKey = process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
        let provider: AIAssistant = 'claude-code'; // Default

        if (process.env.ANTHROPIC_API_KEY) provider = 'claude-code';
        else if (process.env.GEMINI_API_KEY) provider = 'gemini';
        else if (process.env.OPENAI_API_KEY) provider = 'codex';
        else {
             spinner.stop();
             console.log(chalk.yellow('\n⚠️  No AI API Keys found in environment.'));
             const providerChoice = await select({
                 message: 'Select AI Provider:',
                 choices: [
                     { value: 'claude-code', name: 'Claude (Anthropic)' },
                     { value: 'gemini', name: 'Gemini (Google)' },
                     { value: 'codex', name: 'OpenAI' }
                 ]
             });
             provider = providerChoice as AIAssistant;
             
             // In a real CLI we would use a password prompt, simple input for now
             const key = await input({ message: 'Enter API Key:' }); 
             apiKey = key;
             spinner.start('Consulting AI Architect...');
        }

        try {
            const suggestions = await aiService.analyzeProject(context, provider, apiKey!);
            spinner.succeed('Analysis complete');
            
            console.log('\n' + createSummaryBox('🤖 AI Suggestions', [
                { label: 'Architecture', value: `${suggestions.architecture.pattern} (${Math.round(suggestions.architecture.confidence * 100)}%)` },
                { label: 'Project Type', value: suggestions.projectType },
                { label: 'Level', value: suggestions.level },
                { label: 'Testing', value: suggestions.testingMaturity },
                { label: 'Reasoning', value: suggestions.reasoning }
            ]));

            const useSuggestions = await confirm({ message: 'Apply these suggestions?', default: true });
            if (useSuggestions) {
                wizard.updateState({
                    language: suggestions.language,
                    projectType: suggestions.projectType,
                    architecture: suggestions.architecture.pattern,
                    datasource: suggestions.datasource,
                    level: suggestions.level,
                    assistant: provider
                });
            }
        } catch (e) {
            spinner.fail('AI Analysis failed');
            console.error(chalk.red((e as Error).message));
        }
    }



    // Check for existing config
    if (detected.hasExistingConfig && !options.force) {
      console.log(chalk.yellow('\n⚠️  Existing AI config detected'));

      const action = await select({
        message: 'How would you like to proceed?',
        choices: [
          { value: 'overwrite', name: 'Overwrite existing config', description: 'Keep other AI configs, replace matching ones' },
          { value: 'clear', name: 'Clear all configs first', description: 'Remove all AI configs, then generate new' },
          { value: 'cancel', name: 'Cancel', description: 'Exit without making changes' }
        ]
      });

      if (action === 'cancel') {
        console.log(chalk.gray('\nCancelled.'));
        return;
      }

      if (action === 'clear') {
        // Import and run clear command logic
        const { clearCommand } = await import('./clear.js');
        await clearCommand({ force: true });
        console.log(''); // Add spacing
      }
    }

    // Wizard loop with back navigation
    while (!wizard.isComplete()) {
      const state = wizard.getState();

      switch (state.currentStep) {
        case 'language':
          await handleLanguageStep(wizard, detected.language);
          break;

        case 'projectType':
          if (await handleProjectTypeStep(wizard) === BACK_VALUE) {
            wizard.goBack();
            continue;
          }
          break;

        case 'assistant':
          if (await handleAssistantStep(wizard, options) === BACK_VALUE) {
            wizard.goBack();
            continue;
          }
          break;

        case 'setupType':
          if (await handleSetupTypeStep(wizard) === BACK_VALUE) {
            wizard.goBack();
            continue;
          }
          break;

        case 'architecture':
          if (await handleArchitectureStep(wizard, options) === BACK_VALUE) {
            wizard.goBack();
            continue;
          }
          break;

        case 'datasource':
          if (await handleDatasourceStep(wizard) === BACK_VALUE) {
            wizard.goBack();
            continue;
          }
          break;

        case 'level':
          if (await handleLevelStep(wizard, options) === BACK_VALUE) {
            wizard.goBack();
            continue;
          }
          break;

        case 'guidelines':
          if (state.setupType === 'custom') {
            if (await handleGuidelinesStep(wizard) === BACK_VALUE) {
              wizard.goBack();
              continue;
            }
          } else {
            wizard.goToNextStep();
          }
          break;

        case 'summary': {
          const shouldGenerate = await handleSummaryStep(wizard);
          if (shouldGenerate === BACK_VALUE) {
            wizard.goBack();
            continue;
          } else if (!shouldGenerate) {
            console.log(chalk.gray('\nCancelled.'));
            return;
          }
          break;
        }
      }

      if (state.currentStep !== 'summary') {
        wizard.goToNextStep();
      } else {
        break;
      }
    }

    // Generate configuration
    const state = wizard.getState();
    const selection: ProfileSelection = {
      assistant: state.assistant!,
      language: state.language!,
      level: state.level!,
      architecture: state.architecture!,
      projectType: state.projectType!,
      projectName: detected.name,
      datasource: state.datasource!
    };

    spinner.start('Generating configuration...');

    const result = await generator.generate({
      projectPath,
      selection,
      customGuidelineIds: state.selectedGuidelineIds,
      dryRun: options.dryRun
    });

    if (!result.success) {
      spinner.fail('Generation failed');
      console.error(chalk.red('\n❌ Errors:'));
      result.errors.forEach(err => console.error(chalk.red(`   - ${err}`)));
      process.exit(1);
    }

    spinner.succeed(options.dryRun ? 'Dry run complete' : 'Configuration generated');

    // Show results
    if (options.dryRun) {
      console.log(chalk.yellow('\n📋 Files that would be generated:'));
    } else {
      console.log(chalk.green('\n✅ Generated files:'));
    }

    result.filesGenerated.forEach(file => {
      const relativePath = file.replace(projectPath, '').replace(/^[/\\]/, '');
      console.log(chalk.gray(`   ${relativePath}`));
    });

    if (!options.dryRun) {
      console.log(chalk.cyan('\n🚀 Next steps:'));
      printNextSteps(state.assistant!);
    }

  } catch (error) {
    spinner.fail('Error');
    console.error(chalk.red(`\n❌ ${(error as Error).message}`));
    process.exit(1);
  }
}

async function handleLanguageStep(wizard: WizardStateManager, detectedLanguage?: Language): Promise<void> {
  let language: Language;

  if (wizard.getState().language) return;

  if (detectedLanguage && detectedLanguage !== 'unknown') {
    const useDetected = await confirm({
      message: `Use detected language: ${chalk.cyan(detectedLanguage)}?`,
      default: true
    });

    if (useDetected) {
      language = detectedLanguage;
    } else {
      language = await select({
        message: 'Select language:',
        choices: LANGUAGES.map(l => ({ value: l.value, name: l.name }))
      }) as Language;
    }
  } else {
    language = await select({
      message: 'Select language:',
      choices: LANGUAGES.map(l => ({ value: l.value, name: l.name }))
    }) as Language;
  }

  wizard.updateState({ language });
}

async function handleProjectTypeStep(wizard: WizardStateManager): Promise<string> {
  const state = wizard.getState();
  if (state.projectType) return state.projectType;

  const choices = addBackOption(
    PROJECT_TYPES.map(pt => ({
      value: pt.value,
      name: pt.name,
      description: pt.description
    })),
    wizard.canGoBack()
  );

  const projectType = await select({
    message: 'What type of project is this?',
    choices
  }) as ProjectType | typeof BACK_VALUE;

  if (projectType !== BACK_VALUE) {
    wizard.updateState({ projectType: projectType as ProjectType });
  }

  return projectType;
}

async function handleAssistantStep(wizard: WizardStateManager, options: InitOptions): Promise<string> {
  const state = wizard.getState();
  if (state.assistant) return state.assistant;

  if (options.assistant) {
    wizard.updateState({ assistant: options.assistant as AIAssistant });
    return options.assistant;
  }

  const choices = addBackOption(
    ASSISTANTS.map(a => ({
      value: a.value,
      name: a.name,
      description: a.description
    })),
    wizard.canGoBack()
  );

  const assistant = await select({
    message: 'Which AI assistant?',
    choices
  }) as AIAssistant | typeof BACK_VALUE;

  if (assistant !== BACK_VALUE) {
    wizard.updateState({ assistant: assistant as AIAssistant });
  }

  return assistant;
}

async function handleSetupTypeStep(wizard: WizardStateManager): Promise<string> {
  const choices = addBackOption(
    [
      { value: 'quick', name: 'Quick Setup', description: 'Recommended settings for common use cases' },
      { value: 'custom', name: 'Custom', description: 'Select individual guidelines' }
    ],
    wizard.canGoBack()
  );

  const setupType = await select({
    message: 'Setup type?',
    choices
  }) as 'quick' | 'custom' | typeof BACK_VALUE;

  if (setupType !== BACK_VALUE) {
    wizard.updateState({ setupType: setupType as 'quick' | 'custom' });
  }

  return setupType;
}

async function handleArchitectureStep(wizard: WizardStateManager, options: InitOptions): Promise<string> {
  const state = wizard.getState();
  if (state.architecture) return state.architecture;

  if (options.architecture) {
    wizard.updateState({ architecture: options.architecture as ArchitectureType });
    return options.architecture;
  }

  const choices = addBackOption(
    ARCHITECTURES.map(a => ({
      value: a.value,
      name: a.name,
      description: a.description
    })),
    wizard.canGoBack()
  );

  const architecture = await select({
    message: 'Architecture pattern?',
    choices,
    default: 'modular-monolith'
  }) as ArchitectureType | typeof BACK_VALUE;

  if (architecture !== BACK_VALUE) {
    wizard.updateState({ architecture: architecture as ArchitectureType });
  }

  return architecture;
}

async function handleDatasourceStep(wizard: WizardStateManager): Promise<string> {
  const state = wizard.getState();
  if (state.datasource) return state.datasource;

  const choices = addBackOption(
    DATASOURCES.map(d => ({
      value: d.value,
      name: d.name,
      description: d.description
    })),
    wizard.canGoBack()
  );

  const datasource = await select({
    message: 'Data storage?',
    choices,
    default: 'sql'
  }) as DatasourceType | typeof BACK_VALUE;

  if (datasource !== BACK_VALUE) {
    wizard.updateState({ datasource: datasource as DatasourceType });
  }

  return datasource;
}

async function handleLevelStep(wizard: WizardStateManager, options: InitOptions): Promise<string> {
  const state = wizard.getState();

  if (options.level) {
    wizard.updateState({ level: options.level as InstructionLevel });
    return options.level;
  }

  const levelsWithMetrics = await getLevelsWithMetrics(
    state.language!,
    state.architecture!,
    state.datasource
  );

  const choices = addBackOption(
    levelsWithMetrics.map(l => ({
      value: l.value,
      name: l.name,
      description: l.description
    })),
    wizard.canGoBack()
  );

  const level = await select({
    message: 'Instruction detail level?',
    choices,
    default: 'standard'
  }) as InstructionLevel | typeof BACK_VALUE;

  if (level !== BACK_VALUE) {
    wizard.updateState({ level: level as InstructionLevel });
  }

  return level;
}

async function handleGuidelinesStep(wizard: WizardStateManager): Promise<string> {
  const state = wizard.getState();

  const selectedIds = await selectGuidelines(
    state.language!,
    state.level!,
    state.architecture!,
    wizard.canGoBack(),
    state.datasource
  );

  if (selectedIds === BACK_VALUE) {
    return BACK_VALUE;
  }

  wizard.updateState({ selectedGuidelineIds: selectedIds as string[] });
  return 'OK';
}

async function handleSummaryStep(wizard: WizardStateManager): Promise<boolean | string> {
  const state = wizard.getState();
  const loader = await GuidelineLoader.create();

  const guidelineIds = state.selectedGuidelineIds || loader.getGuidelinesForProfile(
    state.language!,
    state.level!,
    state.architecture!,
    state.datasource
  );

  const metrics = loader.getMetrics(guidelineIds);

  console.log('\n' + createSummaryBox('📋 Configuration Summary', [
    { label: 'Assistant', value: state.assistant! },
    { label: 'Language', value: state.language! },
    { label: 'Project Type', value: state.projectType! },
    { label: 'Architecture', value: state.architecture! },
    { label: 'Data Storage', value: state.datasource! },
    { label: 'Level', value: state.level! },
    { label: 'Setup Type', value: state.setupType || 'standard' }
  ]));

  console.log('\n' + createMetricsBox([
    { label: 'guidelines', value: metrics.guidelineCount },
    { label: 'hooks', value: metrics.hooksCount },
    { label: 'sub-agents', value: metrics.subAgentsCount },
    { label: 'estimated size', value: metrics.estimatedSize }
  ]));

  // Show selected guidelines if in custom mode
  if (state.setupType === 'custom' && state.selectedGuidelineIds && state.selectedGuidelineIds.length > 0) {
    console.log(chalk.cyan('\n📚 Selected Guidelines:'));
    const guidelineNames = state.selectedGuidelineIds.map(id => {
      const mapping = loader.getMapping(id);
      return mapping ? `   • ${mapping.category || 'General'}: ${id}` : `   • ${id}`;
    });
    console.log(guidelineNames.slice(0, 10).join('\n'));
    if (guidelineNames.length > 10) {
      console.log(chalk.gray(`   ... and ${guidelineNames.length - 10} more`));
    }
  }

  console.log('');

  const shouldGenerate = await select({
    message: 'Proceed with generation?',
    choices: [
      { value: 'yes', name: 'Yes, generate configuration', description: 'Create config files' },
      ...(wizard.canGoBack() ? [{ value: BACK_VALUE, name: '← Back', description: 'Modify settings' }] : []),
      { value: 'no', name: 'Cancel', description: 'Exit without generating' }
    ]
  });

  if (shouldGenerate === 'yes') {
    return true;
  } else if (shouldGenerate === BACK_VALUE) {
    return BACK_VALUE;
  } else {
    return false;
  }
}

async function getLevelsWithMetrics(language: Language, architecture: ArchitectureType, datasource?: DatasourceType): Promise<{ value: InstructionLevel; name: string; description: string }[]> {
  const loader = await GuidelineLoader.create();
  const levels: InstructionLevel[] = ['basic', 'standard', 'expert', 'full'];

  return levels.map(level => {
    const guidelineIds = loader.getGuidelinesForProfile(language, level, architecture, datasource);
    const metrics = loader.getMetrics(guidelineIds);

    const descriptions: Record<InstructionLevel, string> = {
      basic: 'Essential guidelines for quick projects',
      standard: 'Production-ready practices',
      expert: 'Advanced patterns for scaling',
      full: 'Everything - all guidelines'
    };

    return {
      value: level,
      name: `${level.charAt(0).toUpperCase() + level.slice(1)}`,
      description: `${descriptions[level]} (${metrics.guidelineCount} guidelines, ${metrics.hooksCount} hooks, ${metrics.subAgentsCount} agents, ${metrics.estimatedSize})`
    };
  });
}

function printNextSteps(assistant: AIAssistant) {
  switch (assistant) {
    case 'claude-code':
      console.log(chalk.gray('   1. Review .claude/CLAUDE.md'));
      console.log(chalk.gray('   2. Check .claude/settings.json for hooks'));
      console.log(chalk.gray('   3. Review sub-agents in .claude/agents/'));
      console.log(chalk.gray('   4. Open project in Claude Code'));
      break;
    case 'copilot':
      console.log(chalk.gray('   1. Review .github/copilot-instructions.md'));
      console.log(chalk.gray('   2. Check .github/instructions/ for details'));
      console.log(chalk.gray('   3. Open project in VS Code'));
      break;
    case 'gemini':
      console.log(chalk.gray('   1. Review .gemini/instructions.md'));
      console.log(chalk.gray('   2. Configure Gemini integration'));
      break;
    case 'antigravity':
      console.log(chalk.gray('   1. Review .agent/rules/instructions.md'));
      console.log(chalk.gray('   2. Open project in Antigravity'));
      break;
    case 'codex':
      console.log(chalk.gray('   1. Review .codex/instructions.md'));
      console.log(chalk.gray('   2. Configure Codex integration'));
      break;
  }
  console.log(chalk.gray('   \n   Also check AGENTS.md for universal instructions'));
}

async function checkForUpdatesInBackground() {
  try {
    const loader = await GuidelineLoader.create();
    const currentVersion = loader.getVersion();

    if (currentVersion === 'embedded' || currentVersion === 'unknown') {
      return;
    }

    const response = await fetch(GITHUB_RELEASES_URL, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'User-Agent': CONFIG.USER_AGENT
      }
    });

    if (!response.ok) return;

    const data = await response.json() as { tag_name: string };
    const latestVersion = data.tag_name.replace(/^v/, '');

    const currentParts = currentVersion.split('.').map(Number);
    const latestParts = latestVersion.split('.').map(Number);

    let needsUpdate = false;
    for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
      const curr = currentParts[i] || 0;
      const lat = latestParts[i] || 0;

      if (lat > curr) {
        needsUpdate = true;
        break;
      }
      if (lat < curr) break;
    }

    if (needsUpdate) {
      console.log(chalk.yellow(`\n   📦 New guidelines available: v${latestVersion}`));
      console.log(chalk.gray(`   Run ${chalk.white('aicgen update')} to download\n`));
    }
  } catch {
    // Silently fail if can't check for updates
  }
}


