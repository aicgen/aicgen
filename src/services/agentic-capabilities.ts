import { AIAssistant } from '../models/project.js';
import { InstructionLevel } from '../models/profile.js';

export type CapabilitySurface =
  | 'main-instructions'
  | 'scoped-instructions'
  | 'workflow-commands'
  | 'prompt-files'
  | 'chat-modes'
  | 'subagents'
  | 'skills'
  | 'plugins'
  | 'hooks'
  | 'mcp-templates';

export type CapabilityStability = 'stable' | 'preview';
export type CapabilityRisk = 'passive' | 'guided' | 'agentic' | 'side-effecting';

export interface AssistantCapability {
  assistant: AIAssistant;
  surface: CapabilitySurface;
  label: string;
  output: string;
  minLevel: InstructionLevel;
  stability: CapabilityStability;
  risk: CapabilityRisk;
  docsUrl: string;
  limit: string;
  enabledByDefault: boolean;
}

const PROFILE_ORDER: Record<InstructionLevel, number> = {
  basic: 0,
  standard: 1,
  expert: 2,
  full: 3,
};

export const AGENTIC_CAPABILITIES: AssistantCapability[] = [
  {
    assistant: 'claude-code',
    surface: 'main-instructions',
    label: 'Project memory',
    output: 'CLAUDE.md',
    minLevel: 'basic',
    stability: 'stable',
    risk: 'passive',
    docsUrl: 'https://docs.claude.com/en/docs/claude-code/memory',
    limit: 'Keep the main file concise and reference detailed project files.',
    enabledByDefault: true,
  },
  {
    assistant: 'claude-code',
    surface: 'workflow-commands',
    label: 'Slash commands',
    output: '.claude/commands/*.md',
    minLevel: 'standard',
    stability: 'stable',
    risk: 'guided',
    docsUrl: 'https://docs.claude.com/en/docs/claude-code/slash-commands',
    limit: 'Commands are prompts, not enforcement. They should describe repeatable SDLC steps.',
    enabledByDefault: true,
  },
  {
    assistant: 'claude-code',
    surface: 'subagents',
    label: 'Project subagents',
    output: '.claude/agents/*.md',
    minLevel: 'expert',
    stability: 'stable',
    risk: 'agentic',
    docsUrl: 'https://docs.claude.com/en/docs/claude-code/sub-agents',
    limit: 'Use focused agents with narrow review jobs to avoid noisy or contradictory reviews.',
    enabledByDefault: true,
  },
  {
    assistant: 'claude-code',
    surface: 'skills',
    label: 'Project skills',
    output: '.claude/skills/*/SKILL.md',
    minLevel: 'expert',
    stability: 'stable',
    risk: 'agentic',
    docsUrl: 'https://docs.claude.com/en/docs/claude-code/skills',
    limit: 'Skills should use progressive disclosure and keep heavy references out of the main prompt.',
    enabledByDefault: true,
  },
  {
    assistant: 'claude-code',
    surface: 'hooks',
    label: 'Lifecycle hooks',
    output: '.claude/settings.json',
    minLevel: 'expert',
    stability: 'stable',
    risk: 'side-effecting',
    docsUrl: 'https://docs.anthropic.com/en/docs/claude-code/hooks',
    limit: 'Hooks execute shell commands automatically. Generate only deterministic local checks.',
    enabledByDefault: true,
  },
  {
    assistant: 'copilot',
    surface: 'main-instructions',
    label: 'Repository instructions',
    output: '.github/copilot-instructions.md',
    minLevel: 'basic',
    stability: 'stable',
    risk: 'passive',
    docsUrl: 'https://docs.github.com/en/copilot/concepts/prompting/response-customization',
    limit: 'Copilot merges matching instructions into context, so keep files small and scoped.',
    enabledByDefault: true,
  },
  {
    assistant: 'copilot',
    surface: 'scoped-instructions',
    label: 'Scoped instructions',
    output: '.github/instructions/*.instructions.md',
    minLevel: 'basic',
    stability: 'stable',
    risk: 'passive',
    docsUrl: 'https://docs.github.com/en/copilot/concepts/prompting/response-customization',
    limit: 'Use applyTo globs to keep instructions relevant to the edited files.',
    enabledByDefault: true,
  },
  {
    assistant: 'copilot',
    surface: 'prompt-files',
    label: 'Prompt files',
    output: '.github/prompts/*.prompt.md',
    minLevel: 'standard',
    stability: 'stable',
    risk: 'guided',
    docsUrl: 'https://code.visualstudio.com/docs/copilot/copilot-customization',
    limit: 'Prompt files are reusable tasks and do not guarantee automatic enforcement.',
    enabledByDefault: true,
  },
  {
    assistant: 'copilot',
    surface: 'workflow-commands',
    label: 'Workflow instructions',
    output: '.github/instructions/workflows.instructions.md',
    minLevel: 'standard',
    stability: 'stable',
    risk: 'guided',
    docsUrl: 'https://docs.github.com/en/copilot/concepts/prompting/response-customization',
    limit: 'Workflow instructions are context for Copilot; users invoke the task through chat or prompt files.',
    enabledByDefault: true,
  },
  {
    assistant: 'copilot',
    surface: 'chat-modes',
    label: 'VS Code chat modes',
    output: '.github/chatmodes/*.chatmode.md',
    minLevel: 'expert',
    stability: 'stable',
    risk: 'agentic',
    docsUrl: 'https://code.visualstudio.com/docs/copilot/customization/custom-chat-modes',
    limit: 'Chat modes are VS Code specific and depend on the tools available in the editor.',
    enabledByDefault: true,
  },
  {
    assistant: 'copilot',
    surface: 'mcp-templates',
    label: 'MCP templates',
    output: '.aicgen/mcp/copilot.md',
    minLevel: 'full',
    stability: 'preview',
    risk: 'side-effecting',
    docsUrl: 'https://docs.github.com/en/copilot/how-tos/provide-context/use-mcp/extend-copilot-chat-with-mcp',
    limit: 'MCP can execute external tools. AICGEN emits documentation templates only.',
    enabledByDefault: true,
  },
  {
    assistant: 'antigravity',
    surface: 'main-instructions',
    label: 'Workspace rules',
    output: '.agent/rules/instructions.md',
    minLevel: 'basic',
    stability: 'stable',
    risk: 'passive',
    docsUrl: 'https://antigravity.google/docs/rules-workflows',
    limit: 'Rules should stay persistent and reusable rather than task-specific.',
    enabledByDefault: true,
  },
  {
    assistant: 'antigravity',
    surface: 'workflow-commands',
    label: 'Workspace workflows',
    output: '.agent/workflows/*.md',
    minLevel: 'standard',
    stability: 'stable',
    risk: 'guided',
    docsUrl: 'https://antigravity.google/docs/rules-workflows',
    limit: 'Workflows are prompt templates; keep them specific to repeatable development tasks.',
    enabledByDefault: true,
  },
  {
    assistant: 'antigravity',
    surface: 'plugins',
    label: 'Plugin-style packaging',
    output: '.agent/plugin templates',
    minLevel: 'full',
    stability: 'preview',
    risk: 'side-effecting',
    docsUrl: 'https://antigravity.google/docs/plugin-management',
    limit: 'Plugin management is intentionally not emitted until AICGEN has an explicit opt-in path.',
    enabledByDefault: false,
  },
  {
    assistant: 'codex',
    surface: 'main-instructions',
    label: 'Universal agent instructions',
    output: 'AGENTS.md',
    minLevel: 'basic',
    stability: 'stable',
    risk: 'passive',
    docsUrl: 'https://developers.openai.com/codex/guides/agents-md',
    limit: 'AGENTS.md should be repo-readable and shared by Codex surfaces.',
    enabledByDefault: true,
  },
  {
    assistant: 'codex',
    surface: 'skills',
    label: 'Codex skills',
    output: 'plugins/aicgen-sdlc/skills/*/SKILL.md',
    minLevel: 'standard',
    stability: 'stable',
    risk: 'agentic',
    docsUrl: 'https://developers.openai.com/codex/skills',
    limit: 'Skills should be narrowly described so Codex chooses them only for matching tasks.',
    enabledByDefault: true,
  },
  {
    assistant: 'codex',
    surface: 'plugins',
    label: 'Project-local plugin',
    output: 'plugins/aicgen-sdlc/.codex-plugin/plugin.json',
    minLevel: 'standard',
    stability: 'stable',
    risk: 'agentic',
    docsUrl: 'https://developers.openai.com/codex/plugins/build',
    limit: 'The plugin is project-local; public store publishing remains out of scope.',
    enabledByDefault: true,
  },
  {
    assistant: 'codex',
    surface: 'hooks',
    label: 'Lifecycle hooks',
    output: '.codex/hooks.json',
    minLevel: 'expert',
    stability: 'stable',
    risk: 'side-effecting',
    docsUrl: 'https://developers.openai.com/codex/hooks',
    limit: 'Hooks run outside the sandbox after trust review. Emit only local reminder hooks.',
    enabledByDefault: true,
  },
  {
    assistant: 'codex',
    surface: 'mcp-templates',
    label: 'MCP templates',
    output: '.aicgen/mcp/codex.md',
    minLevel: 'full',
    stability: 'stable',
    risk: 'side-effecting',
    docsUrl: 'https://developers.openai.com/codex/mcp',
    limit: 'MCP templates are documentation only until the user opts into executable server config.',
    enabledByDefault: true,
  },
];

export function isProfileAtLeast(actual: InstructionLevel, minimum: InstructionLevel): boolean {
  return PROFILE_ORDER[actual] >= PROFILE_ORDER[minimum];
}

export function getAssistantCapabilities(assistant: AIAssistant): AssistantCapability[] {
  return AGENTIC_CAPABILITIES.filter(capability => capability.assistant === assistant);
}

export function getEnabledCapabilities(assistant: AIAssistant, level: InstructionLevel): AssistantCapability[] {
  return getAssistantCapabilities(assistant).filter(capability =>
    capability.enabledByDefault && isProfileAtLeast(level, capability.minLevel)
  );
}

export function hasEnabledCapability(
  assistant: AIAssistant,
  level: InstructionLevel,
  surface: CapabilitySurface
): boolean {
  return getEnabledCapabilities(assistant, level).some(capability => capability.surface === surface);
}

export function buildAgenticProfileSection(assistant: AIAssistant, level: InstructionLevel): string {
  const enabled = getEnabledCapabilities(assistant, level);
  const advanced = getAssistantCapabilities(assistant).filter(capability =>
    !capability.enabledByDefault || !isProfileAtLeast(level, capability.minLevel)
  );

  const enabledLines = enabled.length > 0
    ? enabled.map(capability =>
      `- ${capability.label}: ${capability.output} (${capability.risk}, ${capability.stability})`
    ).join('\n')
    : '- Main instructions only.';

  const advancedLines = advanced.length > 0
    ? advanced.map(capability =>
      `- ${capability.label}: ${capability.minLevel}+; ${capability.limit}`
    ).join('\n')
    : '- No additional gated capabilities for this profile.';

  return `## Agentic Profile

**Profile level:** ${level}

Enabled surfaces:
${enabledLines}

Limits and gated surfaces:
${advancedLines}

Side-effecting features such as hooks, MCP, plugin setup scripts, or executable tool configuration must stay local, deterministic, and explicitly reviewed before use.

`;
}
