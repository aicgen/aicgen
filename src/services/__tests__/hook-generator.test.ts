import { HookGenerator } from '../hook-generator.js';

describe('HookGenerator', () => {
  it('does not generate hooks below expert level', async () => {
    const generator = new HookGenerator();

    await expect(generator.generateHooks(['security/secrets', 'testing/basics'], 'basic')).resolves.toEqual({});
    await expect(generator.generateHooks(['security/secrets', 'testing/basics'], 'standard')).resolves.toEqual({});
  });

  it('generates only enabled safe hook groups for expert profiles', async () => {
    const generator = new HookGenerator();
    const hooks = await generator.generateHooks(['security/secrets', 'testing/basics', 'style/naming'], 'expert');

    expect(hooks.PreToolUse).toHaveLength(3);
    expect(hooks.Stop).toHaveLength(1);
    expect(hooks.PostToolUse).toBeUndefined();
  });
});
