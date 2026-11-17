import { AIAssistant } from '../models/project.js';
import { InstructionLevel } from '../models/profile.js';

export type CapabilitySurface =
  | 'main-instructions'
  | 'scoped-instructions'
  | 'workflow-commands'
  | 'custom-agents'
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
  full: 2,
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
    minLevel: 'full',
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
    minLevel: 'full',
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
    minLevel: 'full',
    stability: 'stable',
    risk: 'side-effecting',
    docsUrl: 'https://docs.anthropic.com/en/docs/claude-code/hooks',
    limit: 'Hooks execute shell commands automatically. Do not generate full test-suite hooks; use /check for validation.',
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
    surface: 'workflow-commands',
    label: 'Workflow skills',
    output: '.github/skills/aicgen-*/SKILL.md',
    minLevel: 'standard',
    stability: 'stable',
    risk: 'guided',
    docsUrl: 'https://code.visualstudio.com/docs/copilot/customization/agent-skills',
    limit: 'Skills replace prompt files, which VS Code documents as deprecated. Workflow skills are user-invoked (disable-model-invocation) and are not enforcement.',
    enabledByDefault: true,
  },
  {
    assistant: 'copilot',
    surface: 'custom-agents',
    label: 'Custom agents',
    output: '.github/agents/*.agent.md',
    minLevel: 'full',
    stability: 'stable',
    risk: 'agentic',
    docsUrl: 'https://docs.github.com/en/copilot/reference/custom-agents-configuration',
    limit: 'Agent profiles need a description; the prompt is limited to 30,000 characters. Chat modes (.chatmode.md) were renamed to custom agents (.agent.md).',
    enabledByDefault: true,
  },
  {
    assistant: 'copilot',
    surface: 'hooks',
    label: 'Guard hook',
    output: '.github/hooks/aicgen-guard.json',
    minLevel: 'full',
    stability: 'preview',
    risk: 'side-effecting',
    docsUrl: 'https://docs.github.com/en/copilot/reference/hooks-reference',
    limit: 'Hooks are in preview. The guard only blocks tool calls that reference secret files (exit code 2) and never runs tests or network calls; it needs a Unix shell (bash).',
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
    output: '.agents/rules/aicgen-instructions.md',
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
    label: 'Workflow skills',
    output: '.agents/skills/aicgen-*/SKILL.md',
    minLevel: 'standard',
    stability: 'stable',
    risk: 'guided',
    docsUrl: 'https://antigravity.google/docs/skills',
    limit: 'Antigravity deprecates workflows in favour of skills; each skill is also a slash command in the CLI.',
    enabledByDefault: true,
  },
  {
    assistant: 'antigravity',
    surface: 'plugins',
    label: 'Plugin-style packaging',
    output: '.agents/plugin templates',
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
    minLevel: 'full',
    stability: 'stable',
    risk: 'side-effecting',
    docsUrl: 'https://developers.openai.com/codex/hooks',
    limit: 'Hooks run outside the sandbox after trust review. Emit only local reminder hooks; use /aicgen-check for validation.',
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
