import { AIAssistant } from '../models/project';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

interface StoredCredentials {
  anthropic?: string;
  gemini?: string;
  openai?: string;
}

export class CredentialService {
  private configDir: string;
  private credentialsFile: string;

  constructor() {
    this.configDir = path.join(os.homedir(), '.aicgen');
    this.credentialsFile = path.join(this.configDir, 'credentials.json');
  }

  /**
   * Get API key for provider (checks in order: env, stored, CLI)
   */
  async getKey(provider: AIAssistant): Promise<string | null> {
    // Priority 1: Environment variable
    const envKey = this.getFromEnv(provider);
    if (envKey) return envKey;

    // Priority 2: Stored credentials
    const storedKey = await this.getStoredKey(provider);
    if (storedKey) return storedKey;

    // Priority 3: CLI config (e.g., Claude CLI)
    if (provider === 'claude-code' || provider === 'antigravity') {
      return this.getFromClaudeCLI();
    }

    return null;
  }

  getEnvKey(provider: AIAssistant): string | null {
    return this.getFromEnv(provider);
  }

  async getCLIKey(provider: AIAssistant): Promise<string | null> {
    if (provider === 'claude-code' || provider === 'antigravity') {
      return this.getFromClaudeCLI();
    }
    return null;
  }

  /**
   * Get stored API key for provider
   */
  async getStoredKey(provider: AIAssistant): Promise<string | null> {
    try {
      const credentials = await this.loadCredentials();
      switch (provider) {
        case 'claude-code':
        case 'antigravity':
          return credentials.anthropic || null;
        case 'gemini':
          return credentials.gemini || null;
        case 'codex':
        case 'copilot':
          return credentials.openai || null;
        default:
          return null;
      }
    } catch {
      return null;
    }
  }

  /**
   * Save API key for provider
   */
  async saveKey(provider: AIAssistant, apiKey: string): Promise<void> {
    await this.ensureConfigDir();

    const credentials = await this.loadCredentials();

    switch (provider) {
      case 'claude-code':
      case 'antigravity':
        credentials.anthropic = apiKey;
        break;
      case 'gemini':
        credentials.gemini = apiKey;
        break;
      case 'codex':
      case 'copilot':
        credentials.openai = apiKey;
        break;
    }

    await fs.writeFile(
      this.credentialsFile,
      JSON.stringify(credentials, null, 2),
      { mode: 0o600 } // Read/write for owner only
    );
  }

  /**
   * Flush all stored credentials
   */
  async flushAll(): Promise<void> {
    try {
      await fs.unlink(this.credentialsFile);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Check if any credentials are stored
   */
  async hasStoredCredentials(): Promise<boolean> {
    try {
      const credentials = await this.loadCredentials();
      return !!(credentials.anthropic || credentials.gemini || credentials.openai);
    } catch {
      return false;
    }
  }

  /**
   * Get list of stored providers
   */
  async getStoredProviders(): Promise<string[]> {
    try {
      const credentials = await this.loadCredentials();
      const providers: string[] = [];

      if (credentials.anthropic) providers.push('Claude (Anthropic)');
      if (credentials.gemini) providers.push('Gemini (Google)');
      if (credentials.openai) providers.push('OpenAI');

      return providers;
    } catch {
      return [];
    }
  }

  private getFromEnv(provider: AIAssistant): string | null {
    switch (provider) {
      case 'claude-code':
      case 'antigravity':
        return process.env.ANTHROPIC_API_KEY || null;
      case 'gemini':
        return process.env.GEMINI_API_KEY || null;
      case 'codex':
      case 'copilot':
        return process.env.OPENAI_API_KEY || null;
      default:
        return null;
    }
  }

  private async getFromClaudeCLI(): Promise<string | null> {
    try {
      // Placeholder for Claude CLI integration
      return null;
    } catch {
      return null;
    }
  }

  private async ensureConfigDir(): Promise<void> {
    try {
      await fs.mkdir(this.configDir, { recursive: true, mode: 0o700 });
    } catch (error: any) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  private async loadCredentials(): Promise<StoredCredentials> {
    try {
      const data = await fs.readFile(this.credentialsFile, 'utf-8');
      return JSON.parse(data);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return {};
      }
      throw error;
    }
  }
}
