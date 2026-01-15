import { select, confirm, input } from '@inquirer/prompts';
import ora from 'ora';
import chalk from 'chalk';
import { ConfigGenerator } from '../services/config-generator';
import { ProjectAnalyzer } from '../services/project-analyzer';
import { AIAnalysisService } from '../services/ai-analysis/ai-analysis.service';
import { CredentialService } from '../services/credential-service';
import { AIAssistant, Language, ProjectType } from '../models/project';
import { ProfileSelection, InstructionLevel, ArchitectureType, DatasourceType } from '../models/profile';
import { showBanner } from '../utils/banner';
import { createSummaryBox } from '../utils/formatting';
import { LANGUAGES, PROJECT_TYPES, ASSISTANTS, ARCHITECTURES, DATASOURCES } from '../constants';
import { TimeoutError, InvalidCredentialsError, ValidationErrors } from '../services/shared/errors/index';

interface ConfigureOptions {
  analyze?: boolean;
  force?: boolean;
}

export async function configureCommand(options: ConfigureOptions) {
  showBanner();
  const projectPath = process.cwd();
  const spinner = ora('Analyzing project structure...').start();
  
  const analyzer = new ProjectAnalyzer(projectPath);
  const generator = await ConfigGenerator.create();
  const credService = new CredentialService();
  const aiService = new AIAnalysisService({
    timeoutMs: 30000,
    maxRetries: 3,
    initialRetryDelayMs: 1000
  });

  // Tier 1 Analysis
  const analysisContext = await analyzer.analyze();
  spinner.succeed('Project detected');

  let finalSelection: Partial<ProfileSelection> = {
      // Don't set assistant here - will be asked later
      language: analysisContext.metadata.language,
      projectType: 'other',
      architecture: 'other',
      datasource: 'none',
      projectName: 'my-project',
      level: 'standard'
  };

  // AI Analysis Flow
  if (options.analyze || await confirm({ message: 'Use AI to analyze architecture and suggest config?', default: true })) {
      
      // select Provider for analysis
      const provider = await select({
          message: 'Select AI Provider for Analysis:',
          choices: [
              { value: 'claude-code', name: 'Claude (Anthropic)' },
              { value: 'gemini', name: 'Gemini (Google)' },
              { value: 'codex', name: 'OpenAI' }
          ]
      }) as AIAssistant;

      // Don't set assistant here - will be asked separately
      
      // Credential Selection
      const envKey = credService.getEnvKey(provider);
      const storedKey = await credService.getStoredKey(provider);
      const cliKey = await credService.getCLIKey(provider);

      const choices = [];
      if (envKey) choices.push({ value: envKey, name: `Environment Variable (${maskKey(envKey)})` });
      if (storedKey) choices.push({ value: storedKey, name: `Stored Credential (${maskKey(storedKey)})` });
      if (cliKey) choices.push({ value: cliKey, name: `CLI Configuration (${maskKey(cliKey)})` });
      choices.push({ value: 'manual', name: 'Enter Manually' });

      let apiKey: string;
      let shouldSaveKey = false;

      if (choices.length > 1) {
          const choice = await select({
              message: 'Select Credential Source:',
              choices
          });
          if (choice === 'manual') {
              apiKey = await input({ message: 'Enter API Key:' });
              shouldSaveKey = true;
          } else {
              apiKey = choice;
          }
      } else if (choices.length === 1 && choices[0].value !== 'manual') {
          apiKey = choices[0].value;
          console.log(chalk.gray(`Using ${choices[0].name}`));
      } else {
          apiKey = await input({ message: 'Enter API Key:' });
          shouldSaveKey = true;
      }

      // Save manually entered key
      if (shouldSaveKey) {
          try {
              await credService.saveKey(provider, apiKey);
              console.log(chalk.gray('✓ API key saved for future use'));
          } catch (error) {
              console.log(chalk.yellow('⚠ Failed to save API key'));
          }
      }

      // Select analysis tier (how much data to pass to AI)
      const analysisTier = await select({
          message: 'Select analysis depth:',
          choices: [
              { value: 'basic', name: 'Tier 1 - Basic', description: 'File structure and package.json only' },
              { value: 'standard', name: 'Tier 2 - Standard', description: 'File structure + key files analysis' },
              { value: 'deep', name: 'Tier 3 - Deep', description: 'Full code analysis with dependencies' }
          ]
      });

      const tierLabels = {
          basic: 'Tier 1',
          standard: 'Tier 2',
          deep: 'Tier 3'
      };

      spinner.start(`Consulting AI Architect (${tierLabels[analysisTier]} Analysis)...`);
      try {
          const suggestions = await aiService.analyzeProject(analysisContext, provider, apiKey);
          spinner.succeed('AI Analysis Complete');

          console.log('\n' + createSummaryBox('🤖 AI Suggestions', [
                { label: 'Language', value: suggestions.language },
                { label: 'Architecture', value: `${suggestions.architecture.pattern} (${Math.round(suggestions.architecture.confidence * 100)}%)` },
                { label: 'Project Type', value: suggestions.projectType },
                { label: 'Datasource', value: suggestions.datasource },
                { label: 'Instruction Level', value: suggestions.level },
                { label: 'Testing Maturity', value: suggestions.testingMaturity },
          ]));

          if (await confirm({ message: 'Apply AI suggestions?', default: true })) {
              finalSelection = {
                  ...finalSelection,
                  language: suggestions.language,
                  projectType: suggestions.projectType,
                  architecture: suggestions.architecture.pattern,
                  datasource: suggestions.datasource,
                  level: suggestions.level
              };
          } else {
              // User rejected AI suggestions - run manual wizard
              console.log(chalk.yellow('\n📝 Manual Configuration'));
              finalSelection = await runManualWizard(analysisContext.metadata.language);
          }
      } catch (e) {
          spinner.fail('AI Analysis Failed');
          if (e instanceof InvalidCredentialsError) {
              console.error(chalk.red('Invalid API key. Please check your credentials.'));
          } else if (e instanceof TimeoutError) {
              console.error(chalk.red('Analysis timed out. Please try again.'));
          } else if (e instanceof ValidationErrors) {
              console.error(chalk.red('AI returned invalid response:'));
              e.errors.forEach(err => console.error(chalk.gray(`  - ${err}`)));
          } else {
              console.error(chalk.red((e as Error).message));
          }

          // Offer manual wizard or exit
          const continueWithManual = await confirm({
              message: 'Would you like to configure manually instead?',
              default: true
          });

          if (!continueWithManual) {
              console.log(chalk.gray('Configuration cancelled.'));
              return;
          }

          console.log(chalk.yellow('\n📝 Manual Configuration'));
          finalSelection = await runManualWizard(analysisContext.metadata.language);
      }
  } else {
      // Manual Fallback (Wizard)
      console.log(chalk.yellow('\n📝 Manual Configuration'));
      finalSelection = await runManualWizard(analysisContext.metadata.language);
  }

  // Ask for target coding assistant if not already set
  if (!finalSelection.assistant) {
      finalSelection.assistant = await select({
          message: 'Which coding assistant will use these guidelines?',
          choices: [
              { value: 'claude-code', name: 'Claude Code', description: 'Anthropic Claude CLI tool' },
              { value: 'antigravity', name: 'Antigravity', description: 'Anthropic Claude in editor' },
              { value: 'copilot', name: 'GitHub Copilot', description: 'GitHub AI assistant' },
              { value: 'codex', name: 'OpenAI Codex', description: 'OpenAI code model' },
              { value: 'gemini', name: 'Gemini', description: 'Google AI assistant' }
          ]
      }) as AIAssistant;
  }

  // Ensure all required fields are set
  if (!finalSelection.assistant) {
      console.error(chalk.red('\n❌ Error: Assistant not selected'));
      process.exit(1);
  }

  // Check if config for THIS assistant already exists
  if (!options.force) {
    const { exists } = await import('../utils/file.js');
    const { join } = await import('path');

    let configPath: string | null = null;
    let assistantName = finalSelection.assistant;

    // Map assistant to config path
    if (finalSelection.assistant === 'claude-code') {
      configPath = join(projectPath, '.claude');
      assistantName = 'Claude Code';
    } else if (finalSelection.assistant === 'antigravity') {
      configPath = join(projectPath, '.agent');
      assistantName = 'Antigravity';
    } else if (finalSelection.assistant === 'copilot') {
      configPath = join(projectPath, '.github', 'copilot-instructions.md');
      assistantName = 'GitHub Copilot';
    } else if (finalSelection.assistant === 'gemini') {
      configPath = join(projectPath, '.gemini');
      assistantName = 'Gemini';
    } else if (finalSelection.assistant === 'codex') {
      configPath = join(projectPath, '.codex');
      assistantName = 'Codex';
    }

    if (configPath && await exists(configPath)) {
      console.log(chalk.yellow(`\n⚠️  Existing ${assistantName} configuration detected`));

      const action = await select({
        message: 'How would you like to proceed?',
        choices: [
          { value: 'overwrite', name: `Overwrite ${assistantName} config`, description: 'Replace existing config for this assistant only' },
          { value: 'clear', name: 'Clear ALL AI configs first', description: 'Remove all AI configs, then generate new' },
          { value: 'cancel', name: 'Cancel', description: 'Exit without making changes' }
        ]
      });

      if (action === 'cancel') {
        console.log(chalk.gray('\nCancelled.'));
        return;
      }

      if (action === 'clear') {
        const { clearCommand } = await import('./clear.js');
        await clearCommand({ force: true });
        console.log(''); // Add spacing
      }
      // If 'overwrite', just continue - generation will overwrite files
    }
  }

  // Generation
  spinner.start('Generating configuration...');
  await generator.generate({
      projectPath,
      selection: finalSelection as ProfileSelection,
      dryRun: false
  });
  spinner.succeed('Configuration Generated!');
}

async function runManualWizard(detectedLanguage?: Language): Promise<ProfileSelection> {
  // Language
  let language: Language;
  if (detectedLanguage && detectedLanguage !== 'unknown') {
      const useDetected = await confirm({
          message: `Detected ${detectedLanguage}. Use this?`,
          default: true
      });
      language = useDetected ? detectedLanguage : await selectLanguage();
  } else {
      language = await selectLanguage();
  }

  // Project Type
  const projectType = await select({
      message: 'Select project type:',
      choices: PROJECT_TYPES.map(pt => ({
          value: pt.value,
          name: pt.label,
          description: pt.description
      }))
  }) as ProjectType;

  // Architecture
  const architecture = await select({
      message: 'Select architecture pattern:',
      choices: ARCHITECTURES.map(arch => ({
          value: arch.value,
          name: arch.label,
          description: arch.description
      }))
  }) as ArchitectureType;

  // Datasource
  const datasource = await select({
      message: 'Select datasource type:',
      choices: DATASOURCES.map(ds => ({
          value: ds.value,
          name: ds.label,
          description: ds.description
      }))
  }) as DatasourceType;

  // Instruction Level
  const level = await select({
      message: 'Select instruction level:',
      choices: [
          { value: 'basic', name: 'Basic', description: 'Essential guidelines only' },
          { value: 'standard', name: 'Standard', description: 'Common patterns and best practices' },
          { value: 'expert', name: 'Expert', description: 'Advanced patterns and optimizations' },
          { value: 'full', name: 'Full', description: 'Complete coverage including edge cases' }
      ]
  }) as InstructionLevel;

  // Target Coding Assistant
  const assistant = await select({
      message: 'Which coding assistant will use these guidelines?',
      choices: [
          { value: 'claude-code', name: 'Claude Code', description: 'Anthropic Claude CLI tool' },
          { value: 'antigravity', name: 'Antigravity', description: 'Anthropic Claude in editor' },
          { value: 'copilot', name: 'GitHub Copilot', description: 'GitHub AI assistant' },
          { value: 'codex', name: 'OpenAI Codex', description: 'OpenAI code model' },
          { value: 'gemini', name: 'Gemini', description: 'Google AI assistant' }
      ]
  }) as AIAssistant;

  return {
      assistant,
      language,
      projectType,
      architecture,
      datasource,
      projectName: 'my-project',
      level
  };
}

async function selectLanguage(): Promise<Language> {
  return await select({
      message: 'Select programming language:',
      choices: LANGUAGES.map(lang => ({
          value: lang.value,
          name: lang.label
      }))
  }) as Language;
}

function maskKey(key: string): string {
    return key.substring(0, 4) + '...' + key.substring(key.length - 4);
}
