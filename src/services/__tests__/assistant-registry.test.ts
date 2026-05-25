import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  detectAssistant,
  getAssistantConfigPaths,
  getAssistantDefinition,
  listAssistantDefinitions,
} from '../assistant-registry.js';

describe('assistant-registry', () => {
  it('should expose definitions for all supported coding assistants', () => {
    const ids = listAssistantDefinitions().map(definition => definition.id);

    expect(ids).toEqual(['claude-code', 'copilot', 'antigravity', 'codex']);
    expect(getAssistantDefinition('codex').configPaths).toContain('plugins/aicgen-sdlc');
    expect(getAssistantDefinition('codex').configPaths).toContain('.agents/plugins/marketplace.json');
  });

  it('should return absolute config paths for an assistant', () => {
    const paths = getAssistantConfigPaths('codex', '/tmp/project');

    expect(paths).toContain('/tmp/project/.codex');
    expect(paths).toContain('/tmp/project/plugins/aicgen-sdlc');
    expect(paths).toContain('/tmp/project/.agents/plugins/marketplace.json');
  });

  it('should detect Codex from its project-local plugin artifacts', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'aicgen-assistant-registry-'));

    try {
      await mkdir(join(tempDir, 'plugins', 'aicgen-sdlc'), { recursive: true });

      await expect(detectAssistant(tempDir)).resolves.toBe('codex');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should detect Claude Code from root CLAUDE.md', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'aicgen-assistant-registry-'));

    try {
      await writeFile(join(tempDir, 'CLAUDE.md'), '# Claude', 'utf-8');

      await expect(detectAssistant(tempDir)).resolves.toBe('claude-code');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
