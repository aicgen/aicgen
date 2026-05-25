import { confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { rm } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { getAllClearTargets } from '../services/assistant-registry.js';
import { removeCodexMarketplaceEntry } from '../services/codex-plugin-generator.js';

export async function clearCommand(options: { force?: boolean } = {}) {
  const projectPath = process.cwd();
  const configTargets = getAllClearTargets();

  const existingConfigs = configTargets.filter(target =>
    existsSync(join(projectPath, target.path))
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

  let deletedCount = 0;
  for (const config of existingConfigs) {
    try {
      if (config.cleanup === 'codex-marketplace-entry') {
        const result = await removeCodexMarketplaceEntry(projectPath);
        if (result === 'removed-entry') {
          console.log(chalk.green(`✓ Removed ${config.name}`));
          deletedCount++;
        } else if (result === 'removed-file') {
          console.log(chalk.green(`✓ Removed ${config.name} file`));
          deletedCount++;
        } else if (result === 'preserved') {
          console.log(chalk.gray(`- Preserved ${config.name} (no aicgen entry found)`));
        }
        continue;
      }

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
