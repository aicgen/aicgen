import { buildProviderConfig, DEFAULT_MODELS } from '../ai-providers.config.js';

describe('buildProviderConfig', () => {
  it('uses defaults and leaves temperature unset', () => {
    const config = buildProviderConfig({}, {});

    expect(config.claude.model).toBe(DEFAULT_MODELS.claude);
    expect(config.claude.temperature).toBeUndefined();
    expect(config.openai.temperature).toBeUndefined();
    expect(config.subAgents.securityAuditor.model).toBe('opus');
  });

  it('respects an explicit temperature of 0 from user config and env', () => {
    expect(buildProviderConfig({}, { ai: { claude: { temperature: 0 } } }).claude.temperature).toBe(0);
    expect(buildProviderConfig({ AICGEN_OPENAI_TEMPERATURE: '0' }, {}).openai.temperature).toBe(0);
  });

  it('prefers env over user config over defaults', () => {
    const user = { ai: { claude: { model: 'from-user', timeout: 111 } } };

    expect(buildProviderConfig({}, user).claude.model).toBe('from-user');
    expect(buildProviderConfig({ AICGEN_CLAUDE_MODEL: 'from-env' }, user).claude.model).toBe('from-env');
    expect(buildProviderConfig({ AICGEN_CLAUDE_TIMEOUT: 'abc' }, user).claude.timeout).toBe(111);
  });

  it('does not carry legacy sub-agent temperature settings', () => {
    const user = { ai: { subAgents: { guidelineChecker: { model: 'haiku', temperature: 0.1 } } } };
    const config = buildProviderConfig({}, user as never);

    expect(config.subAgents.guidelineChecker).toEqual({ model: 'haiku' });
  });
});
