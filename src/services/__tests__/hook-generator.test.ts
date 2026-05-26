import { HookGenerator } from '../hook-generator.js';

describe('HookGenerator', () => {
  it('does not generate hooks below full level', async () => {
    const generator = new HookGenerator();

    await expect(generator.generateHooks(['security/secrets', 'testing/basics'], 'basic')).resolves.toEqual({});
    await expect(generator.generateHooks(['security/secrets', 'testing/basics'], 'standard')).resolves.toEqual({});
  });

  it('generates only enabled safe hook groups for full profiles', async () => {
    const generator = new HookGenerator();
    const hooks = await generator.generateHooks(['security/secrets', 'testing/basics', 'style/naming'], 'full');

    expect(hooks.PreToolUse).toHaveLength(3);
    expect(hooks.Stop).toBeUndefined();
    expect(hooks.PostToolUse).toBeUndefined();
  });
});
