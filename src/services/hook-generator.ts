import { InstructionLevel } from '../models/profile.js';
import { isProfileAtLeast } from './agentic-capabilities.js';

export interface HookEntry {
  matcher?: string;
  hooks?: HookEntry[];
  type?: string;
  command?: string;
  prompt?: string;
  timeout?: number;
}

export type HookEventMap = Record<string, HookEntry[]>;

export interface HookConfig {
  name: string;
  description: string;
  tags: string[];
  minLevel: InstructionLevel;
  enabledByDefault: boolean;
  hooks: HookEventMap;
}

const EMBEDDED_HOOKS: Record<string, HookConfig> = {
  formatting: {
    name: 'Auto-format on file write',
    description: 'Automatically format code files after writing',
    tags: ['style', 'typescript', 'javascript', 'python'],
    minLevel: 'full',
    enabledByDefault: false,
    hooks: {
      PostToolUse: [
        {
          matcher: 'Write(src/**/*.ts)',
          hooks: [
            {
              type: 'command',
              command: 'npx prettier --write "${CLAUDE_FILE}" 2>/dev/null || true'
            }
          ]
        },
        {
          matcher: 'Write(src/**/*.tsx)',
          hooks: [
            {
              type: 'command',
              command: 'npx prettier --write "${CLAUDE_FILE}" 2>/dev/null || true'
            }
          ]
        }
      ]
    }
  },
  security: {
    name: 'Block sensitive file access',
    description: 'Prevent reading or modifying sensitive files',
    tags: ['security', 'secrets'],
    minLevel: 'expert',
    enabledByDefault: true,
    hooks: {
      PreToolUse: [
        {
          matcher: 'Read(.env*)',
          hooks: [
            {
              type: 'command',
              command: "echo 'Blocked: Sensitive file access not allowed' && exit 2"
            }
          ]
        },
        {
          matcher: 'Read(secrets/**)',
          hooks: [
            {
              type: 'command',
              command: "echo 'Blocked: Secrets directory is protected' && exit 2"
            }
          ]
        },
        {
          matcher: 'Write(.env*)',
          hooks: [
            {
              type: 'command',
              command: "echo 'Blocked: Cannot modify environment files' && exit 2"
            }
          ]
        }
      ]
    }
  },
  testing: {
    name: 'Verify tests before completion',
    description: 'Ensure tests pass before task completion',
    tags: ['testing', 'quality'],
    minLevel: 'expert',
    enabledByDefault: true,
    hooks: {
      Stop: [
        {
          hooks: [
            {
              type: 'prompt',
              prompt:
                'Before completing this task, verify that:\n1. All tests pass\n2. No new failing tests were introduced\n3. Test coverage meets requirements\n\nIs the task truly complete with passing tests?',
              timeout: 15
            }
          ]
        }
      ]
    }
  }
};

export class HookGenerator {
  async generateHooks(
    guidelineIds: string[],
    level: InstructionLevel = 'standard'
  ): Promise<HookEventMap> {
    const mergedHooks: HookEventMap = {};

    for (const hook of Object.values(EMBEDDED_HOOKS)) {
      if (!hook.enabledByDefault || !isProfileAtLeast(level, hook.minLevel)) {
        continue;
      }

      const matchesGuidelines = hook.tags.some(tag =>
        guidelineIds.some(id => id.includes(tag))
      );

      if (matchesGuidelines) {
        this.mergeHooks(mergedHooks, hook.hooks);
      }
    }

    return mergedHooks;
  }

  private mergeHooks(target: HookEventMap, source: HookEventMap): void {
    for (const [event, hooks] of Object.entries(source)) {
      if (!target[event]) {
        target[event] = [];
      }
      target[event].push(...hooks);
    }
  }

  generateClaudeCodeSettings(
    hooks: HookEventMap,
    projectPath: string,
    level: 'basic' | 'standard' | 'expert' | 'full' = 'standard'
  ): string {
    // Base permissions for all levels
    const baseAllow = [
      'Bash(npm run:*)',
      'Bash(yarn:*)',
      'Bash(pnpm:*)',
      'Bash(bun:*)',
      'Bash(git:*)',
      'Bash(npx:*)',
      'Read(src/**)',
      'Read(package.json)',
      'Read(tsconfig.json)',
      'Read(CLAUDE.md)',
      'Read(.claude/**)',
      'Write(src/**)',
      'Write(.claude/**)'
    ];

    // Network permissions only for expert/full levels (least-privilege)
    const allowInternet = level === 'expert' || level === 'full';
    const allowWebSearch = level === 'expert' || level === 'full';

    const allow = allowWebSearch ? [...baseAllow, 'WebSearch'] : baseAllow;

    const settings = {
      alwaysThinkingEnabled: true,
      hooks,
      aicgen: {
        profileLevel: level,
        safety: [
          'Generated hooks are limited to local deterministic checks.',
          'Review hook commands before enabling additional side-effecting automation.',
          'MCP and plugin setup scripts are not generated without explicit opt-in.'
        ]
      },
      permissions: {
        allow,
        deny: ['Read(.env*)', 'Read(secrets/**)', 'Bash(rm:*)', 'Bash(sudo:*)'],
        ask: ['Write(package.json)', 'Write(.gitignore)', 'Write(.env.example)']
      },
      sandbox: {
        allowInternetAccess: allowInternet,
        workingDirectory: projectPath
      }
    };

    return JSON.stringify(settings, null, 2);
  }
}
