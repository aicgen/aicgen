import { select, confirm, input } from '@inquirer/prompts';
import ora from 'ora';
import chalk from 'chalk';
import { ConfigGenerator } from '../services/config-generator.js';
import { ProjectAnalyzer } from '../services/project-analyzer.js';
import { AIAnalysisService } from '../services/ai-analysis-service.js';
import { CredentialService } from '../services/credential-service.js';
import { AIAssistant, Language, ProjectType } from '../models/project.js';
import { ProfileSelection, InstructionLevel, ArchitectureType, DatasourceType } from '../models/profile.js';
import { showBanner } from '../utils/banner.js';
import { createSummaryBox } from '../utils/formatting.js';
import { LANGUAGES, PROJECT_TYPES, ASSISTANTS, ARCHITECTURES, DATASOURCES } from '../constants.js';

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
  const aiService = new AIAnalysisService();

  // Tier 1 Analysis
  const analysisContext = await analyzer.analyze();
  spinner.succeed('Project detected');

  // Check existing
  if (analysisContext.metadata.files.some(f => f.includes('.claude') || f.includes('.aicgen'))) {
      const mode = await select({
          message: 'Existing configuration found. What would you like to do?',
          choices: [
              { value: 'update', name: 'Update / Merge', description: 'Add new guidelines, keep existing' },
              { value: 'overwrite', name: 'Overwrite', description: 'Replace entirely' },
              { value: 'cancel', name: 'Cancel' }
          ]
      });
      if (mode === 'cancel') return;
      if (mode === 'overwrite') options.force = true;
  }

  let finalSelection: ProfileSelection = {
      assistant: 'claude-code',
      language: analysisContext.metadata.language,
      projectType: 'other',
      architecture: 'other',
      datasource: 'none',
      projectName: 'my-project',
      level: 'standard'
  };

  // AI Analysis Flow
  if (options.analyze || await confirm({ message: 'Use AI to analyze architecture and suggest config?', default: true })) {
      
      // select Provider
      const provider = await select({
          message: 'Select AI Provider:',
          choices: [
              { value: 'claude-code', name: 'Claude (Anthropic)' },
              { value: 'gemini', name: 'Gemini (Google)' },
              { value: 'codex', name: 'OpenAI' }
          ]
      }) as AIAssistant;
      
      finalSelection.assistant = provider;
      
      // Credential Selection
      const envKey = credService.getEnvKey(provider);
      const cliKey = await credService.getCLIKey(provider);
      
      const choices = [];
      if (envKey) choices.push({ value: envKey, name: `Environment Variable (${maskKey(envKey)})` });
      if (cliKey) choices.push({ value: cliKey, name: `CLI Configuration (${maskKey(cliKey)})` });
      choices.push({ value: 'manual', name: 'Enter Manually' });

      let apiKey: string;
      if (choices.length > 1) {
          const choice = await select({
              message: 'Select Credential Source:',
              choices
          });
          if (choice === 'manual') apiKey = await input({ message: 'Enter API Key:' });
          else apiKey = choice;
      } else if (choices.length === 1 && choices[0].value !== 'manual') {
          apiKey = choices[0].value;
          console.log(chalk.gray(`Using ${choices[0].name}`));
      } else {
          apiKey = await input({ message: 'Enter API Key:' });
      }

      spinner.start('Consulting AI Architect (Tier 3 Analysis)...');
      try {
          const suggestions = await aiService.analyzeProject(analysisContext, provider, apiKey);
          spinner.succeed('AI Analysis Complete');
          
          console.log('\n' + createSummaryBox('🤖 AI Suggestions', [
                { label: 'Architecture', value: `${suggestions.architecture.pattern} (${Math.round(suggestions.architecture.confidence * 100)}%)` },
                { label: 'Project Type', value: suggestions.projectType },
                { label: 'Level', value: suggestions.level },
                { label: 'Testing', value: suggestions.testingMaturity },
          ]));
          
          if (await confirm({ message: 'Apply suggestions?', default: true })) {
              finalSelection = {
                  ...finalSelection,
                  language: suggestions.language,
                  projectType: suggestions.projectType,
                  architecture: suggestions.architecture.pattern,
                  datasource: suggestions.datasource,
                  level: suggestions.level
              };
          }
      } catch (e) {
          spinner.fail('AI Analysis Failed');
          console.error((e as Error).message);
      }
  } else {
      // Manual Fallback (Wizard)
      // For brevity, we assume standard wizard logic or simply use defaults if manual skipped
      console.log(chalk.gray('Skipping AI analysis. Using detected defaults.'));
  }

  // Generation
  spinner.start('Generating configuration...');
  await generator.generate({
      projectPath,
      selection: finalSelection,
      dryRun: false
  });
  spinner.succeed('Configuration Generated!');
}

function maskKey(key: string): string {
    return key.substring(0, 4) + '...' + key.substring(key.length - 4);
}
