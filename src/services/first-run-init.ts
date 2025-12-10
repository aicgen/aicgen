import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import chalk from 'chalk';
import ora from 'ora';
import { CONFIG, GITHUB_RELEASES_URL } from '../config.js';
import { ConfigManager } from './config-manager.js';
import { EMBEDDED_DATA } from '../embedded-data.js';
import YAML from 'yaml';

export async function ensureDataInitialized(): Promise<void> {
  const configManager = new ConfigManager();
  await configManager.load();

  if (configManager.isInitialized()) {
    return; // Already initialized
  }

  console.log(chalk.cyan('\n🚀 First-time setup - Initializing data cache...\n'));

  const spinner = ora('Downloading latest guidelines from GitHub...').start();

  try {
    // Try to download from GitHub
    await downloadFromGitHub();
    spinner.succeed('Downloaded latest guidelines from GitHub');
    await configManager.markInitialized('latest');
  } catch (error) {
    spinner.warn('Could not reach GitHub, using bundled data');

    // Fallback: Copy embedded data to cache
    const copySpinner = ora('Copying bundled data to cache...').start();
    try {
      await copyEmbeddedDataToCache();
      copySpinner.succeed('Initialized with bundled data');
      await configManager.markInitialized('embedded');
    } catch (copyError) {
      copySpinner.fail('Failed to initialize data');
      throw copyError;
    }
  }

  console.log(chalk.green('✓ Data cache initialized\n'));
  console.log(chalk.gray('  Tip: Run `aicgen update` anytime to sync with latest guidelines\n'));
}

async function downloadFromGitHub(): Promise<void> {
  const response = await fetch(GITHUB_RELEASES_URL, {
    headers: {
      'Accept': 'application/vnd.github+json',
      'User-Agent': CONFIG.USER_AGENT
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub API returned ${response.status}`);
  }

  const data = await response.json() as { tag_name: string; tarball_url: string };
  const version = data.tag_name.replace(/^v/, '');

  // For now, just mark as initialized
  // TODO: Actually download and extract tarball when repo exists
  const cacheDir = join(homedir(), CONFIG.CACHE_DIR_NAME, CONFIG.CACHE_DIR);
  await mkdir(cacheDir, { recursive: true });

  // Write version file
  await writeFile(
    join(cacheDir, 'version.json'),
    JSON.stringify({ version, updatedAt: new Date().toISOString(), source: 'github' }),
    'utf-8'
  );
}

async function copyEmbeddedDataToCache(): Promise<void> {
  const cacheDir = join(homedir(), CONFIG.CACHE_DIR_NAME, CONFIG.CACHE_DIR);
  await mkdir(cacheDir, { recursive: true });

  // Write embedded mappings to cache
  const mappingsPath = join(cacheDir, 'guideline-mappings.yml');
  await writeFile(mappingsPath, YAML.stringify(EMBEDDED_DATA.mappings), 'utf-8');

  // Write embedded guidelines to cache
  const guidelinesDir = join(cacheDir, 'guidelines');
  await mkdir(guidelinesDir, { recursive: true });

  for (const [relativePath, content] of Object.entries(EMBEDDED_DATA.guidelines)) {
    const fullPath = join(guidelinesDir, relativePath);
    const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
    await mkdir(dir, { recursive: true });
    await writeFile(fullPath, content, 'utf-8');
  }

  // Write version file
  await writeFile(
    join(cacheDir, 'version.json'),
    JSON.stringify({ version: 'embedded', updatedAt: new Date().toISOString(), source: 'embedded' }),
    'utf-8'
  );
}

export async function shouldRunFirstTimeSetup(): Promise<boolean> {
  const configManager = new ConfigManager();
  await configManager.load();
  return !configManager.isInitialized();
}
