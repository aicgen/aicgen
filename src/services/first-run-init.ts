import chalk from 'chalk';
import ora from 'ora';
import { ConfigManager } from './config-manager';
import { DataPackageInstaller } from './data-package-installer.js';

export async function ensureDataInitialized(): Promise<void> {
  const configManager = new ConfigManager();
  await configManager.load();

  if (configManager.isInitialized()) {
    return;
  }

  console.log(chalk.cyan('\n🚀 First-time setup...\n'));

  const spinner = ora('Downloading latest guidelines from GitHub...').start();

  try {
    const installer = new DataPackageInstaller();
    const result = await installer.installLatest();
    spinner.succeed('Downloaded latest guidelines from GitHub');
    await configManager.markInitialized(result.version);
    console.log(chalk.green('✓ Using latest guidelines from GitHub\n'));
  } catch {
    spinner.info('Could not reach GitHub, using bundled guidelines');
    await configManager.markInitialized('embedded');
    console.log(chalk.green('✓ Using bundled guidelines\n'));
  }

  console.log(chalk.gray('  Tip: Run `aicgen update` anytime to sync with latest guidelines\n'));
}

export async function shouldRunFirstTimeSetup(): Promise<boolean> {
  const configManager = new ConfigManager();
  await configManager.load();
  return !configManager.isInitialized();
}
