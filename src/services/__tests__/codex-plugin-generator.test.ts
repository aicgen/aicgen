import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  CODEX_MARKETPLACE_PATH,
  CODEX_SDLC_PLUGIN_NAME,
  CODEX_SDLC_PLUGIN_ROOT,
  CodexPluginGenerator,
  removeCodexMarketplaceEntry,
} from '../codex-plugin-generator.js';
import { WorkflowCommand } from '../workflow-injector.js';

const COMMANDS: WorkflowCommand[] = [
  {
    name: 'spec',
    description: 'Capture the full specification for a feature or task.',
    content: '**Steps:**\n1. Ask for a feature name',
  },
  {
    name: 'research',
    description: 'Analyze the active spec.',
    content: '**Steps:**\n1. Read the spec',
  },
  {
    name: 'plan',
    description: 'Produce a phased implementation plan.',
    content: '**Steps:**\n1. Read the spec',
  },
  {
    name: 'build',
    description: 'Execute the next phase.',
    content: '**Steps:**\n1. Read the plan',
  },
  {
    name: 'check',
    description: 'Verify implementation.',
    content: '**Steps:**\n1. Run tests',
  },
  {
    name: 'ship',
    description: 'Pre-flight wrap-up.',
    content: '**Steps:**\n1. Run tests',
  },
];

describe('CodexPluginGenerator', () => {
  it('should generate a validation-ready Codex plugin with six namespaced skills', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'aicgen-codex-plugin-'));

    try {
      const files = await new CodexPluginGenerator(COMMANDS, '1.2.3').generateFiles(tempDir);
      const skillFiles = files.filter(file => file.path.includes('/skills/'));
      const manifest = files.find(file => file.path === `${CODEX_SDLC_PLUGIN_ROOT}/.codex-plugin/plugin.json`);

      expect(manifest).toBeDefined();
      expect(JSON.parse(manifest!.content).name).toBe(CODEX_SDLC_PLUGIN_NAME);
      expect(skillFiles).toHaveLength(6);
      expect(skillFiles.some(file => file.path.endsWith('skills/aicgen-plan/SKILL.md'))).toBe(true);
      expect(skillFiles.find(file => file.path.endsWith('skills/aicgen-plan/SKILL.md'))?.content).toContain('/aicgen-plan');
      expect(skillFiles.find(file => file.path.endsWith('skills/aicgen-plan/SKILL.md'))?.content).toContain('legacy aicgen `/plan`');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should preserve unrelated marketplace entries and upsert aicgen-sdlc as installed by default', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'aicgen-codex-marketplace-'));

    try {
      const marketplacePath = join(tempDir, CODEX_MARKETPLACE_PATH);
      await mkdir(join(tempDir, '.agents', 'plugins'), { recursive: true });
      await writeFile(marketplacePath, JSON.stringify({
        name: 'project',
        interface: {
          displayName: 'Project Plugins',
        },
        plugins: [
          {
            name: 'other-plugin',
            source: {
              source: 'local',
              path: './plugins/other-plugin',
            },
            policy: {
              installation: 'AVAILABLE',
              authentication: 'ON_INSTALL',
            },
            category: 'Productivity',
          },
        ],
      }, null, 2), 'utf-8');

      const files = await new CodexPluginGenerator(COMMANDS, '1.2.3').generateFiles(tempDir);
      const marketplaceFile = files.find(file => file.path === CODEX_MARKETPLACE_PATH);
      const marketplace = JSON.parse(marketplaceFile!.content);

      expect(marketplace.plugins).toHaveLength(2);
      expect(marketplace.plugins.some((plugin: { name: string }) => plugin.name === 'other-plugin')).toBe(true);
      expect(marketplace.plugins.find((plugin: { name: string }) => plugin.name === CODEX_SDLC_PLUGIN_NAME)).toEqual({
        name: CODEX_SDLC_PLUGIN_NAME,
        source: {
          source: 'local',
          path: './plugins/aicgen-sdlc',
        },
        policy: {
          installation: 'INSTALLED_BY_DEFAULT',
          authentication: 'ON_INSTALL',
        },
        category: 'Productivity',
      });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should remove only the aicgen-sdlc marketplace entry when other plugins exist', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'aicgen-codex-marketplace-clear-'));

    try {
      const marketplacePath = join(tempDir, CODEX_MARKETPLACE_PATH);
      await mkdir(join(tempDir, '.agents', 'plugins'), { recursive: true });
      await writeFile(marketplacePath, JSON.stringify({
        plugins: [
          { name: 'other-plugin' },
          { name: CODEX_SDLC_PLUGIN_NAME },
        ],
      }, null, 2), 'utf-8');

      await expect(removeCodexMarketplaceEntry(tempDir)).resolves.toBe('removed-entry');

      const marketplace = JSON.parse(await readFile(marketplacePath, 'utf-8'));
      expect(marketplace.plugins).toEqual([{ name: 'other-plugin' }]);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should delete marketplace.json when only the aicgen-sdlc entry remains', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'aicgen-codex-marketplace-clear-'));

    try {
      const marketplacePath = join(tempDir, CODEX_MARKETPLACE_PATH);
      await mkdir(join(tempDir, '.agents', 'plugins'), { recursive: true });
      await writeFile(marketplacePath, JSON.stringify({
        plugins: [
          { name: CODEX_SDLC_PLUGIN_NAME },
        ],
      }, null, 2), 'utf-8');

      await expect(removeCodexMarketplaceEntry(tempDir)).resolves.toBe('removed-file');
      await expect(access(marketplacePath)).rejects.toBeDefined();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
