import { readFile, writeFile, mkdir, access } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import YAML from 'yaml';
import { CONFIG } from '../config.js';

export interface UserConfig {
  initialized?: boolean;
  lastUpdate?: string;
  dataVersion?: string;
  github?: {
    owner?: string;
    repo?: string;
  };
}

export class ConfigManager {
  private configPath: string;
  private config: UserConfig = {};

  constructor() {
    this.configPath = join(homedir(), CONFIG.CACHE_DIR_NAME, 'config.yml');
  }

  async load(): Promise<UserConfig> {
    try {
      await access(this.configPath);
      const content = await readFile(this.configPath, 'utf-8');
      this.config = YAML.parse(content) || {};
    } catch {
      // Config doesn't exist yet, use defaults
      this.config = {
        initialized: false
      };
    }
    return this.config;
  }

  async save(): Promise<void> {
    const dir = join(homedir(), CONFIG.CACHE_DIR_NAME);
    await mkdir(dir, { recursive: true });
    await writeFile(this.configPath, YAML.stringify(this.config), 'utf-8');
  }

  async markInitialized(version: string): Promise<void> {
    this.config.initialized = true;
    this.config.dataVersion = version;
    this.config.lastUpdate = new Date().toISOString();
    await this.save();
  }

  async updateDataVersion(version: string): Promise<void> {
    this.config.dataVersion = version;
    this.config.lastUpdate = new Date().toISOString();
    await this.save();
  }

  isInitialized(): boolean {
    return this.config.initialized === true;
  }

  getDataVersion(): string | undefined {
    return this.config.dataVersion;
  }

  async setGitHubRepo(owner: string, repo: string): Promise<void> {
    this.config.github = { owner, repo };
    await this.save();
  }
}
