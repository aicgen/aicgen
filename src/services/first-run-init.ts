import { mkdir, writeFile, readdir, cp, rm } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import chalk from 'chalk';
import ora from 'ora';
import { CONFIG, GITHUB_RELEASES_URL } from '../config.js';
import { ConfigManager } from './config-manager.js';

const DOWNLOAD_TIMEOUT_MS = 30000; // 30 seconds
const MAX_TARBALL_SIZE_BYTES = 10 * 1024 * 1024; // 10MB max

export async function ensureDataInitialized(): Promise<void> {
  const configManager = new ConfigManager();
  await configManager.load();

  if (configManager.isInitialized()) {
    return; // Already initialized
  }

  console.log(chalk.cyan('\n🚀 First-time setup...\n'));

  const spinner = ora('Downloading latest guidelines from GitHub...').start();

  try {
    await downloadFromGitHub();
    spinner.succeed('Downloaded latest guidelines from GitHub');
    await configManager.markInitialized('latest');
    console.log(chalk.green('✓ Using latest guidelines from GitHub\n'));
  } catch {
    spinner.info('Could not reach GitHub, using bundled guidelines');
    await configManager.markInitialized('embedded');
    console.log(chalk.green('✓ Using bundled guidelines\n'));
  }

  console.log(chalk.gray('  Tip: Run `aicgen update` anytime to sync with latest guidelines\n'));
}

async function downloadFromGitHub(): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

  try {
    const response = await fetch(GITHUB_RELEASES_URL, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'User-Agent': CONFIG.USER_AGENT
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`GitHub API returned ${response.status}`);
    }

    const data = await response.json() as { tag_name: string; tarball_url: string };
    const version = data.tag_name.replace(/^v/, '');

    const cacheDir = join(homedir(), CONFIG.CACHE_DIR_NAME, CONFIG.CACHE_DIR);
    await mkdir(cacheDir, { recursive: true });

    // Download tarball with timeout and size limit
    const tarballController = new AbortController();
    const tarballTimeout = setTimeout(() => tarballController.abort(), DOWNLOAD_TIMEOUT_MS);

    try {
      const tarballResponse = await fetch(data.tarball_url, {
        signal: tarballController.signal
      });

      if (!tarballResponse.ok) {
        throw new Error(`Failed to download tarball: ${tarballResponse.status}`);
      }

      // Check content-length if available
      const contentLength = tarballResponse.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > MAX_TARBALL_SIZE_BYTES) {
        throw new Error(`Tarball too large: ${contentLength} bytes (max ${MAX_TARBALL_SIZE_BYTES})`);
      }

      const tarballBuffer = Buffer.from(await tarballResponse.arrayBuffer());

      // Verify size after download
      if (tarballBuffer.length > MAX_TARBALL_SIZE_BYTES) {
        throw new Error(`Downloaded tarball too large: ${tarballBuffer.length} bytes`);
      }

      const tempDir = join(cacheDir, '.temp-extract');
      await mkdir(tempDir, { recursive: true });

      try {
        // Write tarball to temp file
        const tarballPath = join(tempDir, 'archive.tar.gz');
        await writeFile(tarballPath, tarballBuffer);

        // Extract tarball using decompress (Windows-compatible)
        const decompress = (await import('decompress')).default;
        await decompress(tarballPath, tempDir);

        // Find extracted directory
        const entries = await readdir(tempDir);
        const rootDir = entries.find(entry => entry.startsWith('lpsandaruwan-aicgen-docs-'));

        if (!rootDir) {
          throw new Error('Could not find extracted repository directory');
        }

        const extractedPath = join(tempDir, rootDir);

        // Copy contents to cache directory with proper structure
        const guidelinesTarget = join(cacheDir, 'guidelines');
        await mkdir(guidelinesTarget, { recursive: true });

        // Copy extracted contents with correct structure
        const extractedEntries = await readdir(extractedPath, { withFileTypes: true });
        for (const entry of extractedEntries) {
          const sourcePath = join(extractedPath, entry.name);
          const targetPath = join(guidelinesTarget, entry.name);

          if (entry.name === 'guideline-mappings.yml') {
            await cp(sourcePath, join(cacheDir, entry.name));
          } else if (entry.isDirectory() || entry.name.endsWith('.md')) {
            await cp(sourcePath, targetPath, { recursive: true });
          }
        }

        // Write version file
        await writeFile(
          join(cacheDir, 'version.json'),
          JSON.stringify({ version, updatedAt: new Date().toISOString(), source: 'github' }),
          'utf-8'
        );
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    } finally {
      clearTimeout(tarballTimeout);
    }
  } finally {
    clearTimeout(timeout);
  }
}

export async function shouldRunFirstTimeSetup(): Promise<boolean> {
  const configManager = new ConfigManager();
  await configManager.load();
  return !configManager.isInitialized();
}
