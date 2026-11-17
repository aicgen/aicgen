import { existsSync } from 'fs';
import { spawnSync } from 'child_process';
import { join } from 'path';

/**
 * Generated hook commands use POSIX shell syntax (`echo ... >&2; exit 2`, `sed`, `grep`), which is
 * what assistants run them with (Claude Code on Windows uses Git Bash). Tests therefore run them
 * under bash on every platform instead of the default `cmd.exe`.
 */
function findBash(): string | undefined {
  const candidates: string[] = [];
  if (process.platform === 'win32') {
    for (const root of [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA]) {
      if (root) candidates.push(join(root, 'Git', 'bin', 'bash.exe'));
    }
  }
  candidates.push('bash');

  return candidates.find(candidate => {
    if (candidate !== 'bash' && !existsSync(candidate)) return false;
    return spawnSync(candidate, ['-c', 'exit 0'], { encoding: 'utf-8' }).status === 0;
  });
}

const BASH = findBash();

export const hasBash = BASH !== undefined;

export function runBash(command: string, input?: string) {
  if (!BASH) throw new Error('bash is not available');
  return spawnSync(BASH, ['-c', command], { input, encoding: 'utf-8' });
}
