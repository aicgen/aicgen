#!/usr/bin/env node
import { Command } from 'commander';
import { configureCommand } from './commands/configure';
import { statsCommand } from './commands/stats';
import { updateCommand } from './commands/update';
import { addGuidelineCommand } from './commands/add-guideline';
import { removeGuidelineCommand } from './commands/remove-guideline';
import { quickAddCommand } from './commands/quick-add';
import { clearCommand } from './commands/clear';
import { showBanner } from './utils/banner';
import { CONFIG } from './config';

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
  .command('configure')
  .alias('init')
  .description('Configure AI assistant settings (auto-detects structure)')
  .option('-a, --assistant <name>', 'AI assistant (claude-code|copilot|antigravity)')
  .option('--analyze', 'Run deep AI analysis')
  .option('-f, --force', 'Overwrite existing configuration')
  .action(configureCommand);

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

program.parse();
