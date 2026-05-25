import { readFile, rm } from 'fs/promises';
import { join } from 'path';
import { GeneratedFile, WorkflowCommand } from './workflow-injector.js';
import { writeFile } from '../utils/file.js';
import { InstructionLevel } from '../models/profile.js';
import { isProfileAtLeast } from './agentic-capabilities.js';

export const CODEX_SDLC_PLUGIN_NAME = 'aicgen-sdlc';
export const CODEX_SDLC_PLUGIN_ROOT = `plugins/${CODEX_SDLC_PLUGIN_NAME}`;
export const CODEX_MARKETPLACE_PATH = '.agents/plugins/marketplace.json';
export const CODEX_PLUGIN_CONFIG_PATHS = [
  '.codex',
  CODEX_SDLC_PLUGIN_ROOT,
  CODEX_MARKETPLACE_PATH,
];

interface MarketplaceJson {
  name?: string;
  interface?: {
    displayName?: string;
    [key: string]: unknown;
  };
  plugins?: unknown[];
  [key: string]: unknown;
}

export class CodexPluginGenerator {
  constructor(
    private readonly commands: WorkflowCommand[],
    private readonly version: string = process.env.APP_VERSION || process.env.npm_package_version || '0.1.0',
    private readonly level: InstructionLevel = 'standard'
  ) {}

  async generateFiles(projectPath: string): Promise<GeneratedFile[]> {
    return [
      {
        path: `${CODEX_SDLC_PLUGIN_ROOT}/.codex-plugin/plugin.json`,
        content: this.buildPluginManifest(),
        type: 'plugin',
      },
      ...this.commands.map(cmd => ({
        path: `${CODEX_SDLC_PLUGIN_ROOT}/skills/${this.skillName(cmd)}/SKILL.md`,
        content: this.buildSkill(cmd),
        type: 'plugin' as const,
      })),
      ...this.buildReviewSkills(),
      {
        path: CODEX_MARKETPLACE_PATH,
        content: await this.buildMarketplace(projectPath),
        type: 'plugin',
      },
    ];
  }

  private buildPluginManifest(): string {
    return JSON.stringify({
      name: CODEX_SDLC_PLUGIN_NAME,
      version: this.version,
      description: 'Project-local Codex plugin for aicgen SDLC lifecycle commands.',
      author: {
        name: 'aicgen',
        url: 'https://github.com/aicgen',
      },
      homepage: 'https://github.com/aicgen/aicgen',
      repository: 'https://github.com/aicgen/aicgen',
      license: 'MIT',
      keywords: [
        'aicgen',
        'codex',
        'sdlc',
        'workflow',
        'slash-commands',
      ],
      skills: './skills/',
      interface: {
        displayName: 'aicgen SDLC',
        shortDescription: 'SDLC lifecycle commands for Codex',
        longDescription: 'Adds project-local aicgen SDLC skills for specification, research, planning, phased builds, checks, and shipping.',
        developerName: 'aicgen',
        category: 'Productivity',
        capabilities: [
          'Interactive',
          'Read',
          'Write',
        ],
        websiteURL: 'https://github.com/aicgen/aicgen',
        privacyPolicyURL: 'https://github.com/aicgen/aicgen',
        termsOfServiceURL: 'https://github.com/aicgen/aicgen',
        defaultPrompt: [
          'Run /aicgen-spec for this feature',
          'Run /aicgen-plan from my spec',
          'Run /aicgen-check before shipping',
        ],
        brandColor: '#0EA5E9',
        screenshots: [],
      },
    }, null, 2) + '\n';
  }

  private buildSkill(cmd: WorkflowCommand): string {
    const skillName = this.skillName(cmd);
    const legacyCommand = `/${cmd.name}`;
    const codexCommand = `/${skillName}`;
    const description = `Use this for the aicgen ${legacyCommand} lifecycle step in Codex. Invoke as ${codexCommand}; also respond when the user asks for ${legacyCommand}.`;

    return `---
name: ${skillName}
description: ${JSON.stringify(description)}
---

# ${codexCommand}

Use this skill when the user asks for \`${codexCommand}\` or the legacy aicgen \`${legacyCommand}\` lifecycle step.

Follow the workflow definition below. Keep artifacts in the user's project, preserve existing user changes, and apply the command's preconditions before doing work.

## Workflow Definition

# ${legacyCommand}

${cmd.description}

${cmd.content}
`;
  }

  private buildReviewSkills(): GeneratedFile[] {
    if (!isProfileAtLeast(this.level, 'expert')) {
      return [];
    }

    const skills = [
      {
        name: 'aicgen-guideline-review',
        description: 'Use this to review changes against generated AICGEN guidelines and AGENTS.md.',
        body: [
          'Review changed files against AGENTS.md, .codex/instructions.md, and any generated tool-specific guideline files.',
          'Report correctness, maintainability, testing, and consistency issues before style-only feedback.',
          'Use file paths and actionable remediation steps.',
        ],
      },
      {
        name: 'aicgen-security-audit',
        description: 'Use this to audit code for security risks before shipping.',
        body: [
          'Focus on secrets handling, injection risks, authentication, authorization, unsafe shell usage, and sensitive data exposure.',
          'Prioritize findings by actual exploitability and impact.',
          'Do not suggest adding external security scanners unless the project already has them configured.',
        ],
      },
      {
        name: 'aicgen-architecture-review',
        description: 'Use this to check whether changes fit the selected architecture and module boundaries.',
        body: [
          'Check dependency direction, ownership boundaries, public interfaces, coupling, and testability.',
          'Prefer recommendations that match the existing repository patterns.',
          'Call out technical debt only when it affects near-term maintainability or delivery risk.',
        ],
      },
    ];

    return skills.map(skill => ({
      path: `${CODEX_SDLC_PLUGIN_ROOT}/skills/${skill.name}/SKILL.md`,
      content: `---
name: ${skill.name}
description: ${JSON.stringify(skill.description)}
---

# ${skill.name}

${skill.description}

${skill.body.map(item => `- ${item}`).join('\n')}
`,
      type: 'plugin' as const,
    }));
  }

  private async buildMarketplace(projectPath: string): Promise<string> {
    const marketplacePath = join(projectPath, CODEX_MARKETPLACE_PATH);
    const marketplace = await this.readMarketplace(marketplacePath);
    marketplace.name = typeof marketplace.name === 'string' && marketplace.name.trim()
      ? marketplace.name
      : 'aicgen-project';
    marketplace.interface = typeof marketplace.interface === 'object' && marketplace.interface !== null
      ? marketplace.interface
      : {};
    marketplace.interface.displayName = marketplace.interface.displayName || 'aicgen Project Plugins';

    const plugins = Array.isArray(marketplace.plugins) ? marketplace.plugins : [];
    const entry = this.buildMarketplaceEntry();
    const existingIndex = plugins.findIndex(plugin =>
      typeof plugin === 'object' &&
      plugin !== null &&
      (plugin as { name?: unknown }).name === CODEX_SDLC_PLUGIN_NAME
    );

    if (existingIndex >= 0) {
      plugins[existingIndex] = entry;
    } else {
      plugins.push(entry);
    }

    marketplace.plugins = plugins;
    return JSON.stringify(marketplace, null, 2) + '\n';
  }

  private async readMarketplace(path: string): Promise<MarketplaceJson> {
    try {
      const content = await readFile(path, 'utf-8');
      const parsed = JSON.parse(content);
      return typeof parsed === 'object' && parsed !== null ? parsed as MarketplaceJson : {};
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {};
      }
      throw new Error(`Existing Codex marketplace JSON is invalid at ${path}: ${(error as Error).message}`);
    }
  }

  private buildMarketplaceEntry() {
    return {
      name: CODEX_SDLC_PLUGIN_NAME,
      source: {
        source: 'local',
        path: `./plugins/${CODEX_SDLC_PLUGIN_NAME}`,
      },
      policy: {
        installation: 'INSTALLED_BY_DEFAULT',
        authentication: 'ON_INSTALL',
      },
      category: 'Productivity',
    };
  }

  private skillName(cmd: WorkflowCommand): string {
    return `aicgen-${cmd.name}`;
  }
}

export async function removeCodexMarketplaceEntry(projectPath: string): Promise<'removed-file' | 'removed-entry' | 'preserved' | 'missing'> {
  const marketplacePath = join(projectPath, CODEX_MARKETPLACE_PATH);

  let parsed: MarketplaceJson;
  try {
    const content = await readFile(marketplacePath, 'utf-8');
    parsed = JSON.parse(content) as MarketplaceJson;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return 'missing';
    }
    throw new Error(`Cannot update Codex marketplace at ${marketplacePath}: ${(error as Error).message}`);
  }

  const plugins = Array.isArray(parsed.plugins) ? parsed.plugins : [];
  const nextPlugins = plugins.filter(plugin =>
    !(
      typeof plugin === 'object' &&
      plugin !== null &&
      (plugin as { name?: unknown }).name === CODEX_SDLC_PLUGIN_NAME
    )
  );

  if (nextPlugins.length === plugins.length) {
    return 'preserved';
  }

  if (nextPlugins.length === 0) {
    await rm(marketplacePath, { force: true });
    return 'removed-file';
  }

  parsed.plugins = nextPlugins;
  await writeFile(marketplacePath, JSON.stringify(parsed, null, 2) + '\n');
  return 'removed-entry';
}
