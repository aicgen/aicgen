import { spawnSync } from 'child_process';
import { FORMAT_ON_WRITE_COMMAND, HookEntry, HookGenerator } from '../hook-generator.js';

const SECURITY_IDS = ['security/secrets', 'testing/basics', 'style/naming'];

function handlers(groups: HookEntry[] | undefined): HookEntry[] {
  return (groups ?? []).flatMap(group => group.hooks ?? []);
}

describe('HookGenerator', () => {
  it('does not generate hooks below full level', async () => {
    const generator = new HookGenerator();

    await expect(generator.generateHooks(['security/secrets', 'testing/basics'], 'basic')).resolves.toEqual({});
    await expect(generator.generateHooks(['security/secrets', 'testing/basics'], 'standard')).resolves.toEqual({});
  });

  it('generates only enabled safe hook groups for full profiles', async () => {
    const generator = new HookGenerator();
    const hooks = await generator.generateHooks(SECURITY_IDS, 'full');

    expect(hooks.PreToolUse).toHaveLength(3);
    expect(hooks.Stop).toBeUndefined();
    expect(hooks.PostToolUse).toBeUndefined();
  });

  describe('security hooks', () => {
    it('match tool names only and filter paths with handler-level `if` rules', async () => {
      const hooks = await new HookGenerator().generateHooks(SECURITY_IDS, 'full');

      for (const group of hooks.PreToolUse) {
        // A matcher containing "(" would be treated as a regex by Claude Code.
        expect(group.matcher).toMatch(/^[A-Za-z|]+$/);
        for (const handler of group.hooks ?? []) {
          expect(handler.if).toMatch(new RegExp(`^(${group.matcher})\\(.+\\)$`));
        }
      }

      expect(handlers(hooks.PreToolUse).map(h => h.if)).toEqual([
        'Read(.env*)',
        'Read(secrets/**)',
        'Write(.env*)',
        'Edit(.env*)'
      ]);
    });

    it('block with exit code 2 and report on stderr', async () => {
      const hooks = await new HookGenerator().generateHooks(SECURITY_IDS, 'full');

      for (const handler of handlers(hooks.PreToolUse)) {
        const result = spawnSync(handler.command!, { shell: true, encoding: 'utf-8' });
        expect(result.status).toBe(2);
        expect(result.stderr).toContain('Blocked:');
        expect(result.stdout).toBe('');
      }
    });
  });

  describe('format-on-write command', () => {
    const run = (stdin: string) =>
      spawnSync(FORMAT_ON_WRITE_COMMAND, { shell: true, input: stdin, encoding: 'utf-8' });

    it('reads the file path from stdin JSON and never fails the tool call', () => {
      expect(run(JSON.stringify({ tool_input: { file_path: 'README.md' } })).status).toBe(0);
      expect(run(JSON.stringify({ tool_input: {} })).status).toBe(0);
      expect(run('not json').status).toBe(0);
    });

    it('does not rely on undocumented environment variables', () => {
      expect(FORMAT_ON_WRITE_COMMAND).not.toContain('CLAUDE_FILE');
    });
  });

  describe('generateClaudeCodeSettings', () => {
    const generate = (level: 'basic' | 'standard' | 'full', language?: string) =>
      JSON.parse(new HookGenerator().generateClaudeCodeSettings({}, level, language));

    it('does not emit unsupported sandbox keys or machine-specific paths', () => {
      const settings = generate('full');

      expect(settings.sandbox).toBeUndefined();
      expect(JSON.stringify(settings)).not.toContain(process.cwd());
    });

    it('emits only documented top-level keys and the published JSON schema', () => {
      const settings = generate('full');

      expect(settings.$schema).toBe('https://json.schemastore.org/claude-code-settings.json');
      expect(Object.keys(settings).sort()).toEqual(['$schema', 'alwaysThinkingEnabled', 'hooks', 'permissions']);
    });

    it('uses the current Bash wildcard syntax', () => {
      const { permissions } = generate('standard');
      const bashRules = [...permissions.allow, ...permissions.deny].filter((r: string) => r.startsWith('Bash('));

      expect(bashRules.length).toBeGreaterThan(0);
      for (const rule of bashRules) {
        expect(rule).not.toContain(':*');
      }
      expect(permissions.deny).toEqual(expect.arrayContaining(['Bash(rm *)', 'Bash(sudo *)']));
    });

    it('only allows WebSearch for the full profile', () => {
      expect(generate('standard').permissions.allow).not.toContain('WebSearch');
      expect(generate('full').permissions.allow).toContain('WebSearch');
    });

    it('adds cargo permissions only for Rust projects', () => {
      const rust = generate('standard', 'rust').permissions;
      const other = generate('standard', 'typescript').permissions;

      expect(rust.allow).toEqual(expect.arrayContaining(['Bash(cargo check *)', 'Bash(cargo clippy *)', 'Bash(cargo test *)']));
      expect(rust.ask).toEqual(expect.arrayContaining(['Bash(cargo publish *)', 'Bash(cargo install *)']));
      expect(rust.deny).toContain('Bash(cargo login *)');
      expect(JSON.stringify(other)).not.toContain('cargo');
    });
  });
});
