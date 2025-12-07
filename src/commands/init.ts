import { select, confirm } from '@inquirer/prompts';
import ora from 'ora';
import chalk from 'chalk';
import { ConfigGenerator } from '../services/config-generator.js';
import { ProfileSelection, InstructionLevel, ArchitectureType } from '../models/profile.js';
import { AIAssistant, Language, ProjectType } from '../models/project.js';

interface InitOptions {
  assistant?: string;
  level?: string;
  architecture?: string;
  force?: boolean;
  dryRun?: boolean;
}

const LANGUAGES: { value: Language; name: string }[] = [
  { value: 'typescript', name: 'TypeScript' },
  { value: 'javascript', name: 'JavaScript' },
  { value: 'python', name: 'Python' },
  { value: 'go', name: 'Go' },
  { value: 'rust', name: 'Rust' },
  { value: 'java', name: 'Java' },
  { value: 'csharp', name: 'C#' },
  { value: 'ruby', name: 'Ruby' }
];

const PROJECT_TYPES: { value: ProjectType; name: string; description: string }[] = [
  { value: 'web', name: 'Web Application', description: 'Frontend or full-stack web app' },
  { value: 'api', name: 'API / Backend', description: 'REST API, GraphQL, or backend service' },
  { value: 'cli', name: 'CLI Tool', description: 'Command-line application' },
  { value: 'library', name: 'Library / Package', description: 'Reusable library or npm/pip package' },
  { value: 'desktop', name: 'Desktop Application', description: 'Electron, Tauri, or native desktop app' },
  { value: 'mobile', name: 'Mobile Application', description: 'React Native, Flutter, or native mobile' },
  { value: 'other', name: 'Other', description: 'Something else' }
];

const ASSISTANTS: { value: AIAssistant; name: string; description: string }[] = [
  { value: 'claude-code', name: 'Claude Code', description: 'Anthropic\'s Claude for coding' },
  { value: 'copilot', name: 'GitHub Copilot', description: 'GitHub\'s AI pair programmer' },
  { value: 'gemini', name: 'Google Gemini', description: 'Google\'s AI model' },
  { value: 'antigravity', name: 'Google Antigravity', description: 'Google\'s agentic platform' },
  { value: 'codex', name: 'OpenAI Codex', description: 'OpenAI\'s code model' }
];

const LEVELS: { value: InstructionLevel; name: string; description: string }[] = [
  { value: 'basic', name: 'Basic', description: 'Essential guidelines for quick projects (~200 lines)' },
  { value: 'standard', name: 'Standard', description: 'Production-ready practices (~500 lines)' },
  { value: 'expert', name: 'Expert', description: 'Advanced patterns for scaling (~1000 lines)' },
  { value: 'full', name: 'Full', description: 'Everything - all guidelines (~2000+ lines)' }
];

const ARCHITECTURES: { value: ArchitectureType; name: string; description: string }[] = [
  { value: 'layered', name: 'Layered', description: 'Simple layers: UI → Business → Data' },
  { value: 'modular-monolith', name: 'Modular Monolith', description: 'Single deploy with clear module boundaries' },
  { value: 'microservices', name: 'Microservices', description: 'Independent services with separate deploys' },
  { value: 'event-driven', name: 'Event-Driven', description: 'Event sourcing, CQRS, message queues' },
  { value: 'hexagonal', name: 'Hexagonal (Ports & Adapters)', description: 'Business logic isolated from infrastructure' },
  { value: 'refactor', name: 'Refactor / Legacy', description: 'Improving existing codebase gradually' }
];

export async function initCommand(options: InitOptions) {
  console.log(chalk.blue.bold('\n🤖 aicgen\n'));

  const generator = new ConfigGenerator();
  const projectPath = process.cwd();

  const spinner = ora('Detecting project...').start();

  try {
    // Quick detection - just language
    const detected = await generator.detectProject(projectPath);
    spinner.succeed('Project detected');

    // Show what we detected
    console.log(chalk.cyan('\n📁 Detected:'));
    console.log(`   ${chalk.white(detected.name)}`);
    if (detected.language !== 'unknown') {
      console.log(`   Language: ${chalk.white(detected.language)}`);
    }

    // Check for existing config
    if (detected.hasExistingConfig && !options.force) {
      console.log(chalk.yellow(`\n⚠️  Existing AI config detected`));
      const shouldContinue = await confirm({
        message: 'Overwrite existing configuration?',
        default: false
      });
      if (!shouldContinue) {
        console.log(chalk.gray('\nCancelled.'));
        return;
      }
    }

    // 1. Confirm or select language
    let language: Language;
    if (detected.language !== 'unknown') {
      const useDetected = await confirm({
        message: `Use detected language: ${detected.language}?`,
        default: true
      });
      if (useDetected) {
        language = detected.language;
      } else {
        language = await selectLanguage();
      }
    } else {
      language = await selectLanguage();
    }

    // 2. Ask setup type
    const setupType = await select({
      message: 'Setup type?',
      choices: [
        { value: 'quick', name: 'Quick Setup', description: 'Recommended settings for common use cases' },
        { value: 'custom', name: 'Custom', description: 'Full control over all options' }
      ]
    }) as 'quick' | 'custom';

    // 3. Ask project type
    const projectType = await select({
      message: 'What type of project is this?',
      choices: PROJECT_TYPES.map(pt => ({
        value: pt.value,
        name: pt.name,
        description: pt.description
      }))
    }) as ProjectType;

    // 4. Select AI assistant
    let assistant: AIAssistant;
    if (options.assistant) {
      assistant = options.assistant as AIAssistant;
    } else {
      assistant = await select({
        message: 'Which AI assistant?',
        choices: ASSISTANTS.map(a => ({
          value: a.value,
          name: a.name,
          description: a.description
        }))
      }) as AIAssistant;
    }

    // 5. Select instruction level and architecture based on setup type
    let level: InstructionLevel;
    let architecture: ArchitectureType;

    if (setupType === 'quick') {
      // Quick setup: use smart defaults
      const defaults = getSmartDefaults(projectType);
      level = defaults.level;
      architecture = defaults.architecture;

      console.log(chalk.gray(`\n📝 Using recommended settings:`));
      console.log(chalk.gray(`   Level: ${level}`));
      console.log(chalk.gray(`   Architecture: ${architecture}`));
    } else {
      // Custom setup: ask everything
      if (options.level) {
        level = options.level as InstructionLevel;
      } else {
        level = await select({
          message: 'Instruction detail level?',
          choices: LEVELS.map(l => ({
            value: l.value,
            name: l.name,
            description: l.description
          })),
          default: 'standard'
        }) as InstructionLevel;
      }

      if (options.architecture) {
        architecture = options.architecture as ArchitectureType;
      } else {
        architecture = await select({
          message: 'Architecture pattern?',
          choices: ARCHITECTURES.map(a => ({
            value: a.value,
            name: a.name,
            description: a.description
          })),
          default: 'modular-monolith'
        }) as ArchitectureType;
      }
    }

    // Summary
    const selection: ProfileSelection = {
      assistant,
      language,
      level,
      architecture,
      projectType
    };

    console.log(chalk.cyan('\n📋 Configuration:'));
    console.log(`   Assistant:    ${chalk.white(assistant)}`);
    console.log(`   Language:     ${chalk.white(language)}`);
    console.log(`   Project Type: ${chalk.white(projectType)}`);
    console.log(`   Level:        ${chalk.white(level)}`);
    console.log(`   Architecture: ${chalk.white(architecture)}`);

    // Confirm
    const shouldGenerate = await confirm({
      message: 'Generate configuration?',
      default: true
    });

    if (!shouldGenerate) {
      console.log(chalk.gray('\nCancelled.'));
      return;
    }

    // Generate
    spinner.start('Generating configuration...');

    const result = await generator.generate({
      projectPath,
      selection,
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
      printNextSteps(assistant);
    }

  } catch (error) {
    spinner.fail('Error');
    console.error(chalk.red(`\n❌ ${(error as Error).message}`));
    process.exit(1);
  }
}

async function selectLanguage(): Promise<Language> {
  return await select({
    message: 'Select language:',
    choices: LANGUAGES.map(l => ({
      value: l.value,
      name: l.name
    }))
  }) as Language;
}

function getSmartDefaults(projectType: ProjectType): { level: InstructionLevel; architecture: ArchitectureType } {
  switch (projectType) {
    case 'cli':
    case 'library':
      return { level: 'standard', architecture: 'modular-monolith' };
    case 'web':
      return { level: 'standard', architecture: 'layered' };
    case 'api':
      return { level: 'expert', architecture: 'modular-monolith' };
    case 'desktop':
    case 'mobile':
      return { level: 'standard', architecture: 'layered' };
    case 'other':
    default:
      return { level: 'standard', architecture: 'modular-monolith' };
  }
}

function printNextSteps(assistant: AIAssistant) {
  switch (assistant) {
    case 'claude-code':
      console.log(chalk.gray('   1. Review claude.md'));
      console.log(chalk.gray('   2. Open project in Claude Code'));
      console.log(chalk.gray('   3. Start coding with AI assistance'));
      break;
    case 'copilot':
      console.log(chalk.gray('   1. Review .github/copilot-instructions.md'));
      console.log(chalk.gray('   2. Open project in VS Code'));
      console.log(chalk.gray('   3. Copilot will use these instructions'));
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
}
