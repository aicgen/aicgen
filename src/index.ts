#!/usr/bin/env node
import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { statsCommand } from './commands/stats.js';

const program = new Command();

program
  .name('aicgen')
  .description('Generate tailored coding guidelines for AI assistants')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize AI configuration in current project')
  .option('-a, --assistant <name>', 'AI assistant (claude-code|copilot|antigravity)')
  .option('-l, --level <level>', 'Instruction level (basic|standard|expert|full)')
  .option('--architecture <type>', 'Architecture (modular-monolith|microservices|refactor|layered)')
  .option('-f, --force', 'Overwrite existing configuration')
  .option('--dry-run', 'Preview files without writing')
  .action(initCommand);

program
  .command('stats')
  .description('Show statistics about available guidelines')
  .action(statsCommand);

program.parse();
