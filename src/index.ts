#!/usr/bin/env node
import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { statsCommand } from './commands/stats.js';
import { updateCommand } from './commands/update.js';
import { addGuidelineCommand } from './commands/add-guideline.js';
import { removeGuidelineCommand } from './commands/remove-guideline.js';
import { quickAddCommand } from './commands/quick-add.js';
import { clearCommand } from './commands/clear.js';
import { analyzeCommand } from './commands/analyze.js';
import { showBanner } from './utils/banner.js';
import { CONFIG } from './config.js';

const program = new Command();

// Show banner before help or when no command given
if (process.argv.length === 2 || process.argv.includes('-h') || process.argv.includes('--help')) {
  showBanner();
}

program
  .name(CONFIG.APP_NAME)
  .description('Generate tailored coding guidelines for AI assistants')
  .version(CONFIG.APP_VERSION);

program
  .command('init')
  .description('Initialize AI configuration in current project')
  .option('-a, --assistant <name>', 'AI assistant (claude-code|copilot|antigravity)')
  .option('-l, --level <level>', 'Instruction level (basic|standard|expert|full)')
  .option('--architecture <type>', 'Architecture (modular-monolith|microservices|refactor|layered)')
  .option('-f, --force', 'Overwrite existing configuration')
  .option('--dry-run', 'Preview files without writing')
  .option('--skip-ai-analysis', 'Skip AI-powered project analysis')
  .action(initCommand);

program
  .command('stats')
  .description('Show statistics about available guidelines')
  .action(statsCommand);

program
  .command('update')
  .description('Update guidelines from GitHub')
  .option('-f, --force', 'Force update even if already up to date')
  .action(updateCommand);

program
  .command('add-guideline')
  .description('Add a custom guideline interactively')
  .action(addGuidelineCommand);

program
  .command('remove-guideline')
  .description('Remove custom guidelines')
  .action(removeGuidelineCommand);

program
  .command('quick-add')
  .description('Quickly add guidelines to existing configuration')
  .action(quickAddCommand);

program
  .command('clear')
  .description('Remove all AI configurations from the project')
  .option('-f, --force', 'Skip confirmation prompt')
  .action(clearCommand);

program
  .command('analyze')
  .description('Run AI-powered codebase analysis')
  .option('-p, --provider <name>', 'AI provider (claude|openai|gemini)')
  .option('-s, --strategy <type>', 'Sampling strategy (minimal|balanced|comprehensive)')
  .option('--no-cache', 'Disable caching')
  .option('--static-only', 'Run static analysis only (no AI)')
  .action(analyzeCommand);

program.parse();
