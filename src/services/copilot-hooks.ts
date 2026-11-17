import type { GeneratedFile } from './workflow-injector.js';

/**
 * Copilot guard hook (.github/hooks/aicgen-guard.json).
 *
 * The documented preToolUse payload gives toolName and toolArgs, but the keys inside
 * toolArgs are not specified, so the command scans the whole payload instead of a
 * specific field. It denies (exit code 2) any file or shell tool call that mentions a
 * secret file (.env, .env.local, secrets/), and allows .env.example/.sample/.template.
 * It never runs tests, makes network calls, or modifies files.
 */
export const COPILOT_GUARD_COMMAND = [
  "input=$(cat | sed -E 's/\\.env\\.(example|sample|template)//g')",
  "if printf '%s' \"$input\" | grep -Eq '(^|[^A-Za-z0-9_])\\.env([^A-Za-z0-9_]|$)|\\.env\\.[A-Za-z0-9_.-]+|(^|[^A-Za-z0-9_])secrets/'",
  "then echo 'Blocked: access to secret files is not allowed' >&2; exit 2; fi",
].join('; ');

export function buildCopilotGuardHook(): GeneratedFile {
  const hook = {
    version: 1,
    hooks: {
      preToolUse: [
        {
          type: 'command',
          matcher: 'view|edit|create|bash',
          bash: COPILOT_GUARD_COMMAND,
          timeoutSec: 10,
        },
      ],
    },
  };

  return {
    path: '.github/hooks/aicgen-guard.json',
    content: JSON.stringify(hook, null, 2) + '\n',
    type: 'config',
  };
}
