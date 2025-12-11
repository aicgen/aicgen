import { readFile } from 'fs/promises';
import { join } from 'path';

export interface HookConfig {
  name: string;
  description: string;
  hooks: Record<string, any>;
}

export class HookGenerator {
  private templatesDir: string;

  constructor() {
    this.templatesDir = join(__dirname, '../../data/templates/hooks');
  }

  async generateHooks(guidelineIds: string[]): Promise<Record<string, any>> {
    const mergedHooks: Record<string, any> = {};

    const hasFormatting = guidelineIds.some(id =>
      id.includes('style') || id.includes('typescript') || id.includes('python')
    );
    const hasSecurity = guidelineIds.some(id => id.includes('security'));
    const hasTesting = guidelineIds.some(id => id.includes('testing'));

    if (hasFormatting) {
      const formattingHooks = await this.loadTemplate('formatting.json');
      this.mergeHooks(mergedHooks, formattingHooks.hooks);
    }

    if (hasSecurity) {
      const securityHooks = await this.loadTemplate('security.json');
      this.mergeHooks(mergedHooks, securityHooks.hooks);
    }

    if (hasTesting) {
      const testingHooks = await this.loadTemplate('testing.json');
      this.mergeHooks(mergedHooks, testingHooks.hooks);
    }

    return mergedHooks;
  }

  private async loadTemplate(filename: string): Promise<HookConfig> {
    const path = join(this.templatesDir, filename);
    const content = await readFile(path, 'utf-8');
    return JSON.parse(content);
  }

  private mergeHooks(target: Record<string, any>, source: Record<string, any>): void {
    for (const [event, hooks] of Object.entries(source)) {
      if (!target[event]) {
        target[event] = [];
      }
      target[event].push(...hooks);
    }
  }

  generateClaudeCodeSettings(hooks: Record<string, any>, projectPath: string): string {
    const settings = {
      alwaysThinkingEnabled: true,
      hooks,
      permissions: {
        allow: [
          'Bash(npm run:*)',
          'Bash(yarn:*)',
          'Bash(pnpm:*)',
          'Bash(bun:*)',
          'Bash(git:*)',
          'Bash(npx:*)',
          'Read(src/**)',
          'Read(package.json)',
          'Read(tsconfig.json)',
          'Read(.claude/**)',
          'Write(src/**)',
          'Write(.claude/**)',
          'WebSearch'
        ],
        deny: [
          'Read(.env*)',
          'Read(secrets/**)',
          'Bash(rm:*)',
          'Bash(sudo:*)'
        ],
        ask: [
          'Write(package.json)',
          'Write(.gitignore)',
          'Write(.env.example)'
        ]
      },
      sandbox: {
        allowInternetAccess: true,
        workingDirectory: projectPath
      }
    };

    return JSON.stringify(settings, null, 2);
  }
}
