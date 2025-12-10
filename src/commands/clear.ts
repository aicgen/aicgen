import { confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { rm } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function clearCommand(options: { force?: boolean } = {}) {
  const projectPath = process.cwd();

  // Define all possible config directories
  const configDirs = [
    { path: '.claude', name: 'Claude Code' },
    { path: '.github/copilot-instructions.md', name: 'GitHub Copilot', isFile: true },
    { path: '.gemini', name: 'Google Gemini' },
    { path: '.agent', name: 'Google Antigravity' },
    { path: '.codex', name: 'Codex' },
    { path: 'AGENTS.md', name: 'Universal AGENTS.md', isFile: true }
  ];

  // Find which configs exist
  const existingConfigs = configDirs.filter(dir =>
    existsSync(join(projectPath, dir.path))
  );

  if (existingConfigs.length === 0) {
    console.log(chalk.gray('\nNo AI configurations found in this project.'));
    return;
  }

  console.log(chalk.cyan('\n📂 Found AI Configurations:'));
  existingConfigs.forEach(config => {
    console.log(`   • ${config.name} (${config.path})`);
  });

  if (!options.force) {
    const shouldDelete = await confirm({
      message: chalk.yellow('\n⚠️  Delete all AI configurations?'),
      default: false
    });

    if (!shouldDelete) {
      console.log(chalk.gray('\nCancelled.'));
      return;
    }
  }

  // Delete configs
  let deletedCount = 0;
  for (const config of existingConfigs) {
    try {
      const fullPath = join(projectPath, config.path);
      await rm(fullPath, { recursive: true, force: true });
      console.log(chalk.green(`✓ Removed ${config.name}`));
      deletedCount++;
    } catch (error) {
      console.log(chalk.red(`✗ Failed to remove ${config.name}: ${error}`));
    }
  }

  console.log(chalk.green(`\n✅ Cleared ${deletedCount} configuration(s)`));
}
