import { createHash } from 'crypto';
import { cp, mkdir, readdir, readFile, rename, rm, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { homedir } from 'os';
import { CONFIG, GITHUB_RELEASES_URL } from '../config.js';

const DOWNLOAD_TIMEOUT_MS = 30000;
const MAX_TARBALL_SIZE_BYTES = 10 * 1024 * 1024;

export interface GitHubRelease {
  tag_name: string;
  name?: string;
  body?: string;
  zipball_url?: string;
  tarball_url: string;
  published_at?: string;
}

export interface DataPackageVersionInfo {
  version: string;
  downloadUrl: string;
  changes: string[];
  publishedAt: string;
}

export interface DataPackageInstallResult {
  version: string;
  targetDir: string;
  checksum: string;
}

interface InstallFromTarballOptions {
  downloadUrl: string;
  version: string;
  targetDir?: string;
}

export class DataPackageInstaller {
  constructor(
    private readonly releasesUrl: string = GITHUB_RELEASES_URL,
    private readonly repoOwner: string = CONFIG.GITHUB_REPO_OWNER,
    private readonly repoName: string = CONFIG.GITHUB_REPO_NAME,
    private readonly userAgent: string = CONFIG.USER_AGENT
  ) {}

  getDefaultTargetDir(): string {
    return join(homedir(), CONFIG.CACHE_DIR_NAME, CONFIG.CACHE_DIR);
  }

  async fetchLatestVersion(): Promise<DataPackageVersionInfo> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

    try {
      const response = await fetch(this.releasesUrl, {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': this.userAgent,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Guidelines repository not found. The repository may not exist yet.');
        }
        if (response.status === 403) {
          throw new Error('GitHub API rate limit exceeded');
        }
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as GitHubRelease;
      const changes = (data.body || '')
        .split('\n')
        .filter(line => line.trim().startsWith('-') || line.trim().startsWith('*'))
        .map(line => line.replace(/^[-*]\s*/, '').trim())
        .filter(line => line.length > 0);

      return {
        version: data.tag_name.replace(/^v/, ''),
        downloadUrl: data.tarball_url,
        changes,
        publishedAt: data.published_at || '',
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async installLatest(targetDir: string = this.getDefaultTargetDir()): Promise<DataPackageInstallResult> {
    const latest = await this.fetchLatestVersion();
    return this.installFromTarball({
      downloadUrl: latest.downloadUrl,
      version: latest.version,
      targetDir,
    });
  }

  async installFromTarball(options: InstallFromTarballOptions): Promise<DataPackageInstallResult> {
    const targetDir = options.targetDir || this.getDefaultTargetDir();
    const tarballBuffer = await this.downloadTarball(options.downloadUrl);
    const checksum = createHash('sha256').update(tarballBuffer).digest('hex');
    const stagingDir = `${targetDir}.tmp-${Date.now()}`;
    const tempDir = join(stagingDir, '.temp-extract');

    await rm(stagingDir, { recursive: true, force: true });
    await mkdir(tempDir, { recursive: true });

    try {
      const tarballPath = join(tempDir, 'archive.tar.gz');
      await writeFile(tarballPath, tarballBuffer);

      const decompress = (await import('decompress')).default;
      await decompress(tarballPath, tempDir, {
        filter: file => {
          if (!this.isSafeArchivePath(file.path)) {
            throw new Error(`Unsafe path in downloaded guidelines archive: ${file.path}`);
          }
          return true;
        },
      });

      const extractedPath = await this.findExtractedRepository(tempDir);
      await this.copyPackageContents(extractedPath, stagingDir);
      await this.validateInstalledPackage(stagingDir);
      await this.writeVersionFile(stagingDir, options.version, checksum);
      await rm(tempDir, { recursive: true, force: true });
      await this.replaceTargetAtomically(stagingDir, targetDir);

      return { version: options.version, targetDir, checksum };
    } catch (error) {
      await rm(stagingDir, { recursive: true, force: true });
      throw error;
    }
  }

  private async downloadTarball(url: string): Promise<Buffer> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
      }

      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > MAX_TARBALL_SIZE_BYTES) {
        throw new Error(`Tarball too large: ${contentLength} bytes (max ${MAX_TARBALL_SIZE_BYTES})`);
      }

      const tarballBuffer = Buffer.from(await response.arrayBuffer());
      if (tarballBuffer.length > MAX_TARBALL_SIZE_BYTES) {
        throw new Error(`Downloaded tarball too large: ${tarballBuffer.length} bytes`);
      }

      return tarballBuffer;
    } finally {
      clearTimeout(timeout);
    }
  }

  private isSafeArchivePath(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, '/');
    if (!normalized || normalized.startsWith('/') || normalized.includes('\0')) {
      return false;
    }

    return normalized.split('/').every(part => part !== '..');
  }

  private async findExtractedRepository(tempDir: string): Promise<string> {
    const entries = await readdir(tempDir);
    const expectedPrefix = `${this.repoOwner}-${this.repoName}-`;
    const rootDir = entries.find(entry => entry.startsWith(expectedPrefix));

    if (!rootDir) {
      throw new Error(`Could not find extracted repository directory (expected ${expectedPrefix}*)`);
    }

    return join(tempDir, rootDir);
  }

  private async copyPackageContents(extractedPath: string, stagingDir: string): Promise<void> {
    const guidelinesTarget = join(stagingDir, 'guidelines');
    await mkdir(guidelinesTarget, { recursive: true });

    const extractedEntries = await readdir(extractedPath, { withFileTypes: true });
    for (const entry of extractedEntries) {
      const sourcePath = join(extractedPath, entry.name);
      const targetPath = join(guidelinesTarget, entry.name);

      if (entry.name === 'guideline-mappings.yml') {
        await cp(sourcePath, join(stagingDir, entry.name));
      } else if (entry.isDirectory() || entry.name.endsWith('.md')) {
        await cp(sourcePath, targetPath, { recursive: true });
      }
    }
  }

  private async validateInstalledPackage(stagingDir: string): Promise<void> {
    const requiredFiles = [
      join(stagingDir, 'guideline-mappings.yml'),
      join(stagingDir, 'guidelines', 'workflows', 'sdlc.md'),
    ];

    const missing: string[] = [];
    for (const file of requiredFiles) {
      try {
        await readFile(file, 'utf-8');
      } catch {
        missing.push(file);
      }
    }

    if (missing.length > 0) {
      throw new Error(`Downloaded guidelines package is incomplete: ${missing.join(', ')}`);
    }
  }

  private async writeVersionFile(stagingDir: string, version: string, checksum: string): Promise<void> {
    const versionFile = {
      version,
      updatedAt: new Date().toISOString(),
      source: 'github-release',
      repository: `${this.repoOwner}/${this.repoName}`,
      checksum,
    };

    await writeFile(join(stagingDir, 'version.json'), JSON.stringify(versionFile, null, 2) + '\n', 'utf-8');
  }

  private async replaceTargetAtomically(stagingDir: string, targetDir: string): Promise<void> {
    await mkdir(dirname(targetDir), { recursive: true });

    const backupDir = `${targetDir}.previous-${Date.now()}`;
    let backupCreated = false;

    try {
      await rename(targetDir, backupDir);
      backupCreated = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    try {
      await rename(stagingDir, targetDir);
      if (backupCreated) {
        await rm(backupDir, { recursive: true, force: true });
      }
    } catch (error) {
      if (backupCreated) {
        await rename(backupDir, targetDir);
      }
      throw error;
    }
  }
}
