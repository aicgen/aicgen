import { join } from 'path';
import { AIAssistant } from '../models/project.js';
import {
  CODEX_MARKETPLACE_PATH,
  CODEX_PLUGIN_CONFIG_PATHS,
  CODEX_SDLC_PLUGIN_ROOT,
} from './codex-plugin-generator.js';
import { exists } from '../utils/file.js';

export interface AssistantClearTarget {
  path: string;
  name: string;
  isFile?: boolean;
  cleanup?: 'codex-marketplace-entry' | 'aicgen-children';
}

export interface AssistantDefinition {
  id: AIAssistant;
  displayName: string;
  description: string;
  configPaths: string[];
  clearTargets: AssistantClearTarget[];
  rendererId: AIAssistant;
  supportsWorkflowFiles: boolean;
  supportsAppend: boolean;
  nextSteps: string[];
}

const ASSISTANT_DEFINITIONS: AssistantDefinition[] = [
  {
    id: 'claude-code',
    displayName: 'Claude Code',
    description: 'Anthropic Claude CLI tool',
    configPaths: ['CLAUDE.md', '.claude'],
    clearTargets: [
      { path: '.claude', name: 'Claude Code' },
      { path: 'CLAUDE.md', name: 'Claude Code instructions', isFile: true },
    ],
    rendererId: 'claude-code',
    supportsWorkflowFiles: true,
    supportsAppend: true,
    nextSteps: [
      'Review CLAUDE.md',
      'Check .claude/settings.json for hooks',
      'Review sub-agents in .claude/agents/',
      'Open project in Claude Code',
    ],
  },
  {
    id: 'copilot',
    displayName: 'GitHub Copilot',
    description: 'GitHub AI assistant',
    configPaths: ['.github/copilot-instructions.md', '.github/instructions'],
    clearTargets: [
      { path: '.github/copilot-instructions.md', name: 'GitHub Copilot', isFile: true },
      { path: '.github/instructions', name: 'GitHub Copilot instruction files' },
      { path: '.github/skills', name: 'GitHub Copilot aicgen skills', cleanup: 'aicgen-children' },
      { path: '.github/agents', name: 'GitHub Copilot aicgen custom agents', cleanup: 'aicgen-children' },
      { path: '.github/hooks', name: 'GitHub Copilot aicgen hooks', cleanup: 'aicgen-children' },
    ],
    rendererId: 'copilot',
    supportsWorkflowFiles: true,
    supportsAppend: true,
    nextSteps: [
      'Review .github/copilot-instructions.md',
      'Check .github/instructions/ for details',
      'Open project in VS Code',
    ],
  },
  {
    id: 'antigravity',
    displayName: 'Antigravity',
    description: 'Google agentic coding platform',
    // `.agents/` is the current workspace folder; `.agent/` is the legacy form that
    // Antigravity still reads. Only `.agents/rules` is used for detection because
    // `.agents/` is shared with Codex (`.agents/plugins`, `.agents/skills`).
    configPaths: ['.agents/rules', '.agent'],
    clearTargets: [
      { path: '.agents/rules', name: 'Google Antigravity rules', cleanup: 'aicgen-children' },
      { path: '.agents/skills', name: 'Google Antigravity aicgen skills', cleanup: 'aicgen-children' },
      { path: '.agents/workflows', name: 'Google Antigravity workflows' },
      { path: '.agent', name: 'Google Antigravity (legacy .agent folder)' },
    ],
    rendererId: 'antigravity',
    supportsWorkflowFiles: true,
    supportsAppend: true,
    nextSteps: [
      'Review .agents/rules/aicgen-instructions.md and AGENTS.md',
      'Review .agents/rules/ (glob and model-decision rules)',
      'Review .agents/skills/aicgen-* (workflow skills)',
      'Open project in Antigravity',
    ],
  },
  {
    id: 'codex',
    displayName: 'OpenAI Codex',
    description: 'OpenAI code model',
    configPaths: CODEX_PLUGIN_CONFIG_PATHS,
    clearTargets: [
      { path: '.codex', name: 'Codex' },
      { path: '.agents/skills', name: 'Codex aicgen guideline skills', cleanup: 'aicgen-children' },
      { path: CODEX_SDLC_PLUGIN_ROOT, name: 'Codex aicgen SDLC plugin' },
      {
        path: CODEX_MARKETPLACE_PATH,
        name: 'Codex aicgen SDLC marketplace entry',
        isFile: true,
        cleanup: 'codex-marketplace-entry',
      },
    ],
    rendererId: 'codex',
    supportsWorkflowFiles: false,
    supportsAppend: true,
    nextSteps: [
      'Review AGENTS.md and the guideline skills in .agents/skills/',
      'Review plugins/aicgen-sdlc/ and .agents/plugins/marketplace.json',
      'Restart Codex from this repository root so the project marketplace is loaded',
      'Use the aicgen-sdlc plugin skills with /aicgen-spec, /aicgen-plan, and /aicgen-check',
    ],
  },
];

export function listAssistantDefinitions(): AssistantDefinition[] {
  return ASSISTANT_DEFINITIONS.map(definition => ({
    ...definition,
    configPaths: [...definition.configPaths],
    clearTargets: definition.clearTargets.map(target => ({ ...target })),
    nextSteps: [...definition.nextSteps],
  }));
}

export function getAssistantDefinition(id: AIAssistant): AssistantDefinition {
  const definition = ASSISTANT_DEFINITIONS.find(candidate => candidate.id === id);
  if (!definition) {
    throw new Error(`Unsupported assistant: ${id}`);
  }

  return {
    ...definition,
    configPaths: [...definition.configPaths],
    clearTargets: definition.clearTargets.map(target => ({ ...target })),
    nextSteps: [...definition.nextSteps],
  };
}

export function getAssistantConfigPaths(id: AIAssistant, projectPath: string): string[] {
  return getAssistantDefinition(id).configPaths.map(configPath => join(projectPath, configPath));
}

export async function detectAssistant(projectPath: string): Promise<AIAssistant | null> {
  for (const definition of ASSISTANT_DEFINITIONS) {
    const hasConfig = (await Promise.all(
      definition.configPaths.map(configPath => exists(join(projectPath, configPath)))
    )).some(Boolean);

    if (hasConfig) {
      return definition.id;
    }
  }

  return null;
}

export function getAllClearTargets(): AssistantClearTarget[] {
  return [
    ...ASSISTANT_DEFINITIONS.flatMap(definition => definition.clearTargets),
    { path: '.gemini', name: 'Legacy Gemini CLI config' },
    { path: 'AGENTS.md', name: 'Universal AGENTS.md', isFile: true },
    { path: '.aicgen', name: 'aicgen metadata (generation manifest, MCP templates)' },
  ];
}
