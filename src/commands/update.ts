import ora from 'ora';
import chalk from 'chalk';
import { GuidelineLoader } from '../services/guideline-loader';
import { createSummaryBox } from '../utils/formatting';
import { DataPackageInstaller, DataPackageVersionInfo } from '../services/data-package-installer.js';

export async function updateCommand(options: { force?: boolean } = {}) {
  const spinner = ora('Checking for updates...').start();

  try {
    const loader = await GuidelineLoader.create();
    const currentVersion = loader.getVersion();
    const installer = new DataPackageInstaller();
    const latestVersion = await installer.fetchLatestVersion();

    spinner.stop();

    console.log('\n' + createSummaryBox('📦 Update Check', [
      { label: 'Current', value: currentVersion },
      { label: 'Latest', value: latestVersion.version },
    ]));

    if (!options.force && !needsUpdate(currentVersion, latestVersion.version)) {
      console.log(chalk.green('\n✓ Already up to date!'));
      return;
    }

    printUpdateSummary(options.force, latestVersion);

    spinner.start('Downloading guidelines...');
    const result = await installer.installFromTarball({
      downloadUrl: latestVersion.downloadUrl,
      version: latestVersion.version,
    });

    spinner.succeed(`Updated to v${result.version}`);

    console.log(chalk.green('\n✅ Guidelines updated successfully!'));
    console.log(chalk.gray(`   Location: ${result.targetDir}`));
    console.log(chalk.gray(`   Checksum: ${result.checksum}`));
    console.log(chalk.cyan('\n   ℹ️  Your custom guidelines are safe (stored separately in ~/.aicgen/data/)'));
    console.log(chalk.gray(`\n   Run ${chalk.white('aicgen init')} to use the latest guidelines`));
  } catch (error) {
    spinner.fail('Update failed');
    printUpdateError(error as Error);
    process.exit(1);
  }
}

function printUpdateSummary(force: boolean | undefined, latestVersion: DataPackageVersionInfo): void {
  if (force) {
    console.log(chalk.yellow('\n⚠️  Force update requested'));
    return;
  }

  console.log(chalk.cyan('\n📋 What\'s new:'));
  latestVersion.changes.slice(0, 10).forEach(change => {
    console.log(`   ${chalk.gray('•')} ${change}`);
  });
  if (latestVersion.changes.length > 10) {
    console.log(chalk.gray(`   ... and ${latestVersion.changes.length - 10} more changes`));
  }
}

function printUpdateError(error: Error): void {
  if (error.message.includes('rate limit')) {
    console.error(chalk.red('\n❌ GitHub API rate limit exceeded'));
    console.log(chalk.yellow('   Try again later or authenticate with GitHub'));
  } else if (error.message.includes('ENOTFOUND') || error.message.includes('fetch')) {
    console.error(chalk.red('\n❌ Network error - check your internet connection'));
  } else {
    console.error(chalk.red(`\n❌ ${error.message}`));
  }
}

function needsUpdate(current: string, latest: string): boolean {
  if (current === 'embedded' || current === 'unknown' || current === 'custom') {
    return true;
  }

  const currentParts = current.split('.').map(Number);
  const latestParts = latest.split('.').map(Number);

  for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
    const curr = currentParts[i] || 0;
    const lat = latestParts[i] || 0;

    if (lat > curr) return true;
    if (lat < curr) return false;
  }

  return false;
}
