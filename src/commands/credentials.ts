import { confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { CredentialService } from '../services/credential-service';

interface CredentialsOptions {
  action: 'list' | 'flush';
}

export async function credentialsCommand(options: CredentialsOptions) {
  const credService = new CredentialService();

  if (options.action === 'list') {
    await listCredentials(credService);
  } else if (options.action === 'flush') {
    await flushCredentials(credService);
  }
}

async function listCredentials(credService: CredentialService) {
  const hasStored = await credService.hasStoredCredentials();

  if (!hasStored) {
    console.log(chalk.yellow('No stored credentials found.'));
    console.log(chalk.gray('\nCredentials are stored in: ~/.aicgen/credentials.json'));
    return;
  }

  const providers = await credService.getStoredProviders();

  console.log(chalk.cyan('\n🔑 Stored API Keys:\n'));
  providers.forEach(provider => {
    console.log(chalk.green(`  ✓ ${provider}`));
  });

  console.log(chalk.gray('\nLocation: ~/.aicgen/credentials.json'));
  console.log(chalk.gray('To remove: aicgen credentials flush'));
}

async function flushCredentials(credService: CredentialService) {
  const hasStored = await credService.hasStoredCredentials();

  if (!hasStored) {
    console.log(chalk.yellow('No stored credentials found.'));
    return;
  }

  const providers = await credService.getStoredProviders();

  console.log(chalk.yellow('\n⚠️  This will remove the following stored API keys:\n'));
  providers.forEach(provider => {
    console.log(chalk.gray(`  • ${provider}`));
  });

  const confirmed = await confirm({
    message: 'Are you sure you want to flush all stored credentials?',
    default: false
  });

  if (!confirmed) {
    console.log(chalk.gray('Cancelled.'));
    return;
  }

  try {
    await credService.flushAll();
    console.log(chalk.green('\n✓ All stored credentials have been removed.'));
  } catch (error) {
    console.error(chalk.red('\n✗ Failed to flush credentials:'), (error as Error).message);
    process.exit(1);
  }
}
