import {
  AGENTIC_CAPABILITIES,
  getAssistantCapabilities,
  getEnabledCapabilities,
  hasEnabledCapability,
} from '../agentic-capabilities.js';

describe('agentic-capabilities', () => {
  it('defines capability rows for the supported assistant targets only', () => {
    const assistants = new Set(AGENTIC_CAPABILITIES.map(capability => capability.assistant));

    expect([...assistants].sort()).toEqual(['antigravity', 'claude-code', 'codex', 'copilot']);
    expect([...assistants]).not.toContain('gemini');
  });

  it('keeps basic profiles instruction-focused', () => {
    const claudeBasic = getEnabledCapabilities('claude-code', 'basic');
    const codexBasic = getEnabledCapabilities('codex', 'basic');

    expect(claudeBasic.map(capability => capability.surface)).toEqual(['main-instructions']);
    expect(codexBasic.map(capability => capability.surface)).toEqual(['main-instructions']);
    expect(hasEnabledCapability('claude-code', 'basic', 'hooks')).toBe(false);
    expect(hasEnabledCapability('codex', 'basic', 'plugins')).toBe(false);
  });

  it('progressively enables guided and agentic surfaces by profile level', () => {
    expect(hasEnabledCapability('antigravity', 'standard', 'workflow-commands')).toBe(true);
    expect(hasEnabledCapability('copilot', 'standard', 'prompt-files')).toBe(true);
    expect(hasEnabledCapability('claude-code', 'expert', 'subagents')).toBe(true);
    expect(hasEnabledCapability('codex', 'expert', 'hooks')).toBe(true);
    expect(hasEnabledCapability('codex', 'full', 'mcp-templates')).toBe(true);
  });

  it('records docs and limits for every capability', () => {
    for (const capability of AGENTIC_CAPABILITIES) {
      expect(capability.docsUrl).toMatch(/^https:\/\//);
      expect(capability.limit.length).toBeGreaterThan(10);
    }
  });

  it('keeps Antigravity as the Google-side assistant target', () => {
    const antigravity = getAssistantCapabilities('antigravity');

    expect(antigravity.length).toBeGreaterThan(0);
    expect(antigravity.some(capability => capability.output.includes('.agent'))).toBe(true);
  });
});
