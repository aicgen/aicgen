import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import YAML from 'yaml';

function getPackageVersion(): string {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const packageJsonPath = join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    return packageJson.version || '1.0.0-beta.1';
  } catch {
    // In compiled binary, package.json is not available
    // Version will be injected at build time via APP_VERSION env var
    return process.env.APP_VERSION || '1.0.0-beta.1';
  }
}

function getPackageName(): string {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const packageJsonPath = join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    return packageJson.name || 'aicgen';
  } catch {
    return 'aicgen';
  }
}

interface UserConfig {
  github?: {
    owner?: string;
    repo?: string;
  };
}

function loadUserConfig(): UserConfig {
  try {
    const configPath = join(homedir(), '.aicgen', 'config.yml');
    if (existsSync(configPath)) {
      const content = readFileSync(configPath, 'utf-8');
      return YAML.parse(content) as UserConfig;
    }
  } catch {
    // Config file doesn't exist or is invalid - use defaults
  }
  return {};
}

const userConfig = loadUserConfig();

export const CONFIG = {
  APP_VERSION: getPackageVersion(),

  APP_NAME: getPackageName(),

  // Priority: ENV > User Config > Default
  GITHUB_REPO_OWNER:
    process.env.AICGEN_GITHUB_OWNER ||
    userConfig.github?.owner ||
    'aicgen',

  GITHUB_REPO_NAME:
    process.env.AICGEN_GITHUB_REPO ||
    userConfig.github?.repo ||
    'aicgen-data',

  GITHUB_API_BASE: 'https://api.github.com',

  USER_AGENT: 'aicgen-cli',

  CACHE_DIR_NAME: '.aicgen',

  DATA_DIR: 'data',

  CACHE_DIR: 'cache/official',
} as const;

export const GITHUB_REPO_URL = `${CONFIG.GITHUB_API_BASE}/repos/${CONFIG.GITHUB_REPO_OWNER}/${CONFIG.GITHUB_REPO_NAME}`;

export const GITHUB_RELEASES_URL = `${GITHUB_REPO_URL}/releases/latest`;
