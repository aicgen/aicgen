import { InstructionLevel } from '../models/profile.js';
import { isProfileAtLeast } from './agentic-capabilities.js';

export interface HookEntry {
  /**
   * Tool-name matcher (e.g. "Read", "Edit|Write"). For tool events Claude Code
   * only tests this against the tool name, never against paths or arguments.
   */
  matcher?: string;
  hooks?: HookEntry[];
  type?: string;
  /**
   * Handler-level filter in permission-rule syntax, e.g. "Read(.env*)".
   * This is where path/argument filtering belongs; one rule per handler.
   */
  if?: string;
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

/**
 * Blocking hooks receive the tool call as JSON on stdin. Exit code 2 blocks the
 * call and feeds stderr back to the model, so the message goes to stderr.
 */
function blockCommand(message: string): string {
  return `echo '${message}' >&2; exit 2`;
}

function blockHandler(rule: string, message: string): HookEntry {
  return { type: 'command', if: rule, command: blockCommand(message) };
}

/**
 * Format-on-write command. Claude Code passes the tool call as JSON on stdin
 * (there is no file-path environment variable), so a tiny node script reads
 * `tool_input.file_path` and runs the right formatter for the extension.
 * It never fails the tool call: any error is swallowed and the exit code is 0.
 * The script avoids backslashes, double quotes and shell metacharacters so it
 * is safe inside a double-quoted shell string on every platform.
 */
export const FORMAT_ON_WRITE_COMMAND = [
  'node -e "',
  "let d='';",
  "process.stdin.on('data',c=>d+=c).on('end',()=>{",
  'try{',
  "const f=JSON.parse(d).tool_input.file_path||'';",
  "const e=f.split('.').pop();",
  "const c=['ts','tsx','js','jsx'].includes(e)?'npx --no-install prettier --write '+JSON.stringify(f):e==='rs'?'cargo fmt':'';",
  'if(c){',
  "require('child_process').spawnSync(c,{shell:true,stdio:'ignore'})",
  '}',
  '}catch(x){}',
  '});',
  '"',
].join('');

const EMBEDDED_HOOKS: Record<string, HookConfig> = {
  formatting: {
    name: 'Auto-format on file write',
    description: 'Format TypeScript/JavaScript (prettier) and Rust (cargo fmt) files after Claude edits them',
    tags: ['style', 'typescript', 'javascript', 'rust'],
    minLevel: 'full',
    enabledByDefault: false,
    hooks: {
      PostToolUse: [
        {
          matcher: 'Write|Edit',
          hooks: [
            {
              type: 'command',
              command: FORMAT_ON_WRITE_COMMAND
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
    minLevel: 'full',
    enabledByDefault: true,
    hooks: {
      PreToolUse: [
        {
          matcher: 'Read',
          hooks: [
            blockHandler('Read(.env*)', 'Blocked: Sensitive file access not allowed'),
            blockHandler('Read(secrets/**)', 'Blocked: Secrets directory is protected')
          ]
        },
        {
          matcher: 'Write',
          hooks: [blockHandler('Write(.env*)', 'Blocked: Cannot modify environment files')]
        },
        {
          matcher: 'Edit',
          hooks: [blockHandler('Edit(.env*)', 'Blocked: Cannot modify environment files')]
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
    level: InstructionLevel = 'standard',
    language?: string
  ): string {
    // Base permissions for all levels. Bash rules use the current
    // "Bash(cmd *)" wildcard form (the older "cmd:*" suffix is deprecated).
    const baseAllow = [
      'Bash(npm run *)',
      'Bash(yarn *)',
      'Bash(pnpm *)',
      'Bash(bun *)',
      'Bash(git *)',
      'Bash(npx *)',
      'Read(src/**)',
      'Read(package.json)',
      'Read(tsconfig.json)',
      'Read(CLAUDE.md)',
      'Read(.claude/**)',
      'Write(src/**)',
      'Write(.claude/**)'
    ];

    const ask = ['Write(package.json)', 'Write(.gitignore)', 'Write(.env.example)'];
    const deny = ['Read(.env*)', 'Read(secrets/**)', 'Bash(rm *)', 'Bash(sudo *)'];

    if (language === 'rust') {
      baseAllow.push(
        'Bash(cargo check *)',
        'Bash(cargo build *)',
        'Bash(cargo test *)',
        'Bash(cargo nextest *)',
        'Bash(cargo clippy *)',
        'Bash(cargo fmt *)',
        'Bash(cargo doc *)',
        'Read(Cargo.toml)',
        'Read(Cargo.lock)',
        'Read(rust-toolchain.toml)',
        'Read(tests/**)',
        'Read(benches/**)'
      );
      ask.push('Write(Cargo.toml)', 'Bash(cargo add *)', 'Bash(cargo install *)', 'Bash(cargo publish *)');
      deny.push('Bash(cargo login *)', 'Bash(cargo owner *)', 'Bash(cargo yank *)');
    }

    // Web search only for the full profile (least privilege).
    const allow = level === 'full' ? [...baseAllow, 'WebSearch'] : baseAllow;

    // Only documented settings keys are emitted. $schema enables editor validation;
    // profile metadata and safety notes live in the instruction files instead.
    const settings = {
      $schema: 'https://json.schemastore.org/claude-code-settings.json',
      alwaysThinkingEnabled: true,
      hooks,
      permissions: { allow, deny, ask }
    };

    return JSON.stringify(settings, null, 2);
  }
}
