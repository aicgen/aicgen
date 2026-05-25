import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { AIProviderLike, normalizeAIProvider } from '../models/ai-provider.js';

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
  async getKey(provider: AIProviderLike): Promise<string | null> {
    // Priority 1: Environment variable
    const envKey = this.getFromEnv(provider);
    if (envKey) return envKey;

    // Priority 2: Stored credentials
    const storedKey = await this.getStoredKey(provider);
    if (storedKey) return storedKey;

    // Priority 3: CLI config (e.g., Claude CLI)
    if (normalizeAIProvider(provider) === 'anthropic') {
      return this.getFromClaudeCLI();
    }

    return null;
  }

  getEnvKey(provider: AIProviderLike): string | null {
    return this.getFromEnv(provider);
  }

  async getCLIKey(provider: AIProviderLike): Promise<string | null> {
    if (normalizeAIProvider(provider) === 'anthropic') {
      return this.getFromClaudeCLI();
    }
    return null;
  }

  /**
   * Get stored API key for provider
   */
  async getStoredKey(provider: AIProviderLike): Promise<string | null> {
    try {
      const credentials = await this.loadCredentials();
      switch (normalizeAIProvider(provider)) {
        case 'anthropic':
          return credentials.anthropic || null;
        case 'google':
          return credentials.gemini || null;
        case 'openai':
          return credentials.openai || null;
      }
    } catch {
      return null;
    }
  }

  /**
   * Save API key for provider
   */
  async saveKey(provider: AIProviderLike, apiKey: string): Promise<void> {
    await this.ensureConfigDir();

    const credentials = await this.loadCredentials();

    switch (normalizeAIProvider(provider)) {
      case 'anthropic':
        credentials.anthropic = apiKey;
        break;
      case 'google':
        credentials.gemini = apiKey;
        break;
      case 'openai':
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

  private getFromEnv(provider: AIProviderLike): string | null {
    switch (normalizeAIProvider(provider)) {
      case 'anthropic':
        return process.env.ANTHROPIC_API_KEY || null;
      case 'google':
        return process.env.GEMINI_API_KEY || null;
      case 'openai':
        return process.env.OPENAI_API_KEY || null;
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
