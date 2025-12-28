import { AIAssistant } from '../models/project.js';

export class CredentialService {
  
  getEnvKey(provider: AIAssistant): string | null {
    return this.getFromEnv(provider);
  }

  async getCLIKey(provider: AIAssistant): Promise<string | null> {
    if (provider === 'claude-code' || provider === 'antigravity') {
      return this.getFromClaudeCLI(); // Placeholder
    }
    return null;
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
      // Attempt to read config from claude CLI if it exposes such a command
      // Note: "claude doctor" often prints debug info, but might not print cleartext keys for security.
      // This is a placeholder for the actual integration command.
      // If direct command isn't available, we might read the config file from OS specific paths.
      // For now, let's assume a hypothetical `claude config get api_key` or similar exists/will exist.
      // Fallback: Check standard config location
      
      // Since we can't be sure of the CLI command in this environment, this is a best-effort "stub"
      // that we would refine with actual CLI documentation.
      return null; 
    } catch {
      return null;
    }
  }
}
