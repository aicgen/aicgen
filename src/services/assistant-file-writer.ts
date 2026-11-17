import { join } from 'path';
import { AIAssistant } from '../models/project';
import { ProfileSelection } from '../models/profile';
import { GuidelineLoader } from './guideline-loader';
import { HookGenerator } from './hook-generator';
import { commandsSection, quickReferenceLines } from './language-profile.js';
import { buildGuidelineIndex, buildGuidelineUnits, GuidelineUnit, renderGuidelineFiles } from './guideline-delivery.js';
import { analyzeBudgets, BudgetFinding } from './context-budget.js';
import { readFrontmatterDescription, stripFrontmatter } from '../utils/frontmatter.js';
import { buildCopilotGuardHook } from './copilot-hooks.js';
import { SubAgentGenerator } from './subagent-generator';
import { WorkflowInjector, GeneratedFile } from './workflow-injector.js';
import { CodexPluginGenerator } from './codex-plugin-generator.js';
import { writeFiles } from '../utils/file.js';
import {
  buildAgenticProfileSection,
  hasEnabledCapability,
} from './agentic-capabilities.js';

export type { GeneratedFile };

/** Convert a `---\ndescription: ...\n---\nbody` workflow into a user-invoked skill. */
function workflowAsSkill(name: string, workflow: string): string {
  const description = readFrontmatterDescription(workflow) || `Run the ${name} workflow`;
  const body = stripFrontmatter(workflow).trim();
  return `---\nname: aicgen-${name}\ndescription: ${JSON.stringify(description.slice(0, 300))}\ndisable-model-invocation: true\n---\n\n# ${name}\n\n${body}\n`;
}

export class AssistantFileWriter {
  private guidelineLoader: GuidelineLoader;
  private hookGenerator: HookGenerator;
  private subAgentGenerator: SubAgentGenerator;
  private workflowInjector: WorkflowInjector;
  private pluginVersion: string;

  static async create(workflowInjector?: WorkflowInjector, pluginVersion?: string): Promise<AssistantFileWriter> {
    const guidelineLoader = await GuidelineLoader.create();
    const injector = workflowInjector ?? await WorkflowInjector.create();
    return new AssistantFileWriter(guidelineLoader, injector, pluginVersion);
  }

  private constructor(guidelineLoader: GuidelineLoader, workflowInjector: WorkflowInjector, pluginVersion?: string) {
    this.guidelineLoader = guidelineLoader;
    this.hookGenerator = new HookGenerator();
    this.subAgentGenerator = new SubAgentGenerator();
    this.workflowInjector = workflowInjector;
    this.pluginVersion = pluginVersion || process.env.APP_VERSION || process.env.npm_package_version || '0.1.0';
  }

  async generateFiles(
    assistant: AIAssistant,
    guidelineIds: string[],
    selection: ProfileSelection,
    projectPath: string
  ): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    const units = buildGuidelineUnits(guidelineIds, this.guidelineLoader, selection.language);

    switch (assistant) {
      case 'claude-code':
        files.push(...await this.generateClaudeCodeFiles(units, guidelineIds, selection));
        break;
      case 'copilot':
        files.push(...await this.generateCopilotFiles(units, selection));
        break;
      case 'antigravity':
        files.push(...await this.generateAntigravityFiles(units, selection));
        break;
      case 'codex':
        files.push(...await this.generateCodexFiles(units, selection, projectPath));
        break;
      default:
        throw new Error(`Unsupported assistant: ${assistant}`);
    }

    if (hasEnabledCapability(assistant, selection.level, 'workflow-commands')) {
      const workflowFiles = this.workflowInjector.generateWorkflowFiles(assistant);
      files.push(...workflowFiles);
    }

    if (assistant === 'copilot' && hasEnabledCapability(assistant, selection.level, 'hooks')) {
      files.push(buildCopilotGuardHook());
    }

    if (hasEnabledCapability(assistant, selection.level, 'custom-agents')) {
      files.push(...this.workflowInjector.generateCopilotAgentFiles());
      files.push(...await this.generateCopilotReviewerAgents(guidelineIds, selection));
    }

    if (hasEnabledCapability(assistant, selection.level, 'mcp-templates')) {
      files.push(this.generateMcpTemplateFile(assistant, selection));
    }

    files.push(this.generateUniversalAgentsFile(units, selection));

    return files.map(file => ({
      ...file,
      path: join(projectPath, file.path)
    }));
  }

  /** Check generated files against context budgets (vendor limits and recommendations). */
  analyzeBudget(assistant: AIAssistant, selection: ProfileSelection, files: GeneratedFile[]): BudgetFinding[] {
    return analyzeBudgets(assistant, selection.level, files);
  }

  async writeFiles(files: GeneratedFile[]): Promise<void> {
    await writeFiles(files.map(file => ({ path: file.path, content: file.content })));
  }

  private async generateClaudeCodeFiles(
    units: GuidelineUnit[],
    guidelineIds: string[],
    selection: ProfileSelection
  ): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [...renderGuidelineFiles('claude-code', units)];

    const archDescription = selection.architecture === 'other'
      ? ''
      : ` and ${selection.architecture} architecture`;

    const workflowsSection = hasEnabledCapability('claude-code', selection.level, 'workflow-commands')
      ? this.workflowInjector.buildWorkflowSummary()
      : '';
    const agenticProfileSection = buildAgenticProfileSection('claude-code', selection.level);
    const verificationNotes = [
      '- **Follow the guidelines** listed above; rules and skills load automatically when relevant.',
      hasEnabledCapability('claude-code', selection.level, 'subagents')
        ? '- **Verification**: Use sub-agents in `.claude/agents/` to verify compliance.'
        : '- **Verification**: Review changes against the referenced guideline files before completion.',
      hasEnabledCapability('claude-code', selection.level, 'hooks')
        ? '- **Constraints**: Hooks in `.claude/settings.json` provide deterministic guardrails; review them before extending.'
        : '- **Constraints**: Hooks are not enabled for this profile level.'
    ].join('\n');

    const mainContent = `# ${selection.projectName} - Development Guidelines

**Role:** You are an expert software engineer specialized in ${selection.language}${archDescription}.
**User's Goal:** Build high-quality, maintainable software following strict project guidelines.

${buildGuidelineIndex('claude-code', units)}
## Quick Reference

${quickReferenceLines(selection.language).join('\n')}

${workflowsSection}${agenticProfileSection}## Important Notes

${verificationNotes}

---
*Generated by aicgen*
`;

    files.push({
      path: 'CLAUDE.md',
      content: mainContent,
      type: 'main'
    });

    const hooks = await this.hookGenerator.generateHooks(guidelineIds, selection.level);
    const settingsContent = this.hookGenerator.generateClaudeCodeSettings(hooks, selection.level, selection.language);

    files.push({
      path: '.claude/settings.json',
      content: settingsContent,
      type: 'config'
    });

    const subAgents = await this.subAgentGenerator.generateSubAgents(guidelineIds, selection.level, selection.language);
    for (const agent of subAgents) {
      files.push({
        path: `.claude/agents/${agent.name}.md`,
        content: agent.content,
        type: 'agent'
      });
    }

    const skills = await this.subAgentGenerator.generateSkills(guidelineIds, selection.level, selection.language);
    for (const skill of skills) {
      files.push({
        path: `.claude/skills/${skill.name}/SKILL.md`,
        content: skill.content,
        type: 'skill'
      });
    }

    return files;
  }

  private async generateCopilotFiles(
    units: GuidelineUnit[],
    selection: ProfileSelection
  ): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [...renderGuidelineFiles('copilot', units)];

    const extras: string[] = [];
    if (hasEnabledCapability('copilot', selection.level, 'workflow-commands')) {
      extras.push('- Workflow skills (invoke as `/aicgen-spec`, `/aicgen-plan`, ...): `.github/skills/aicgen-*/`');
    }
    if (hasEnabledCapability('copilot', selection.level, 'hooks')) {
      extras.push('- Guard hook: `.github/hooks/aicgen-guard.json`');
    }
    if (hasEnabledCapability('copilot', selection.level, 'custom-agents')) {
      extras.push('- Custom agents: `.github/agents/*.agent.md` (review, guideline, architecture and security reviewers)');
    }

    const archDescription = selection.architecture === 'other'
      ? ''
      : ` and ${selection.architecture}`;

    const mainContent = `# GitHub Copilot Instructions

**Role:** You are an expert AI pair programmer specialized in ${selection.language}${archDescription}.

${buildGuidelineIndex('copilot', units)}
## Commands

${quickReferenceLines(selection.language).join('\n')}
${extras.length ? `\n## Also available\n\n${extras.join('\n')}\n` : ''}
${buildAgenticProfileSection('copilot', selection.level)}

---
*Generated by aicgen*
`;

    files.push({
      path: '.github/copilot-instructions.md',
      content: mainContent,
      type: 'main'
    });

    return files;
  }

  private async generateCopilotReviewerAgents(
    guidelineIds: string[],
    selection: ProfileSelection
  ): Promise<GeneratedFile[]> {
    const reviewers = await this.subAgentGenerator.generateSubAgents(guidelineIds, selection.level, selection.language);

    // Copilot custom agent profile: description is required; tools use the read/search aliases.
    return reviewers.map(agent => ({
      path: `.github/agents/aicgen-${agent.name}.agent.md`,
      content: `---\nname: aicgen-${agent.name}\ndescription: ${JSON.stringify(readFrontmatterDescription(agent.content))}\ntools: ["read", "search"]\n---\n\n${stripFrontmatter(agent.content)}`,
      type: 'agent' as const,
    }));
  }

  private async generateAntigravityFiles(
    units: GuidelineUnit[],
    selection: ProfileSelection
  ): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [...renderGuidelineFiles('antigravity', units)];

    const archDescription = selection.architecture === 'other'
      ? ''
      : ` and ${selection.architecture} architecture`;

    // Always-on rule. Antigravity also reads AGENTS.md natively, so this file stays
    // short and the guideline index lives in AGENTS.md only.
    const mainContent = `---
trigger: always_on
description: "Project role and operating principles"
---

# Google Antigravity Instructions

**Role:** You are an expert software engineer specialized in ${selection.language}${archDescription}.

See \`AGENTS.md\` for project commands and the guideline index. Detailed rules in this folder activate by file glob or when relevant.

## Core Principles
1. **Act as an Agent**: Don't just answer; perform actions, verify results, and course-correct.
2. **Follow Guidelines**: Apply the rules that activate for the files you touch.
3. **Think Step-by-Step**: Break down complex tasks into smaller, verifiable steps.

${buildAgenticProfileSection('antigravity', selection.level)}

---
*Generated by aicgen*
`;

    files.push({
      path: '.agents/rules/aicgen-instructions.md',
      content: mainContent,
      type: 'main'
    });

    // Generate workflows based on instruction level
    if (hasEnabledCapability('antigravity', selection.level, 'workflow-commands')) {
      const workflows = this.getWorkflowsForLevel(selection.level);
      for (const workflow of workflows) {
        files.push({
          path: `.agents/skills/aicgen-${workflow.name}/SKILL.md`,
          content: workflowAsSkill(workflow.name, workflow.content),
          type: 'workflow'
        });
      }
    }

    return files;
  }

  private getWorkflowsForLevel(level: string): Array<{ name: string; content: string }> {
    const workflows: Array<{ name: string; content: string }> = [];

    // Basic workflows for all levels
    workflows.push({
      name: 'generate-unit-tests',
      content: `---
description: Generate comprehensive unit tests for all functions and methods
---

* Analyze the selected file or directory for testable code
* Generate test files with appropriate naming conventions
* Create test cases covering happy path, edge cases, and error handling
* Mock external dependencies appropriately
* Follow language-specific testing best practices
* Aim for >80% code coverage
* Include setup and teardown methods where needed`
    });

    workflows.push({
      name: 'add-documentation',
      content: `---
description: Add or update comprehensive documentation for code
---

* Analyze the selected code for documentation needs
* Add inline documentation with clear descriptions
* Include parameter types and return value documentation
* Add usage examples for complex functions
* Follow language-specific documentation standards
* Update README.md if adding new features`
    });

    // Standard level and above
    if (level === 'standard' || level === 'full') {
      workflows.push({
        name: 'refactor-extract-module',
        content: `---
description: Extract code into a separate, reusable module
---

* Identify the code section to extract
* Analyze dependencies and determine module interface
* Create a new module file following project conventions
* Maintain original functionality and behavior
* Update imports and exports appropriately
* Ensure no circular dependencies
* Add documentation to the new module
* Verify all tests still pass`
      });

      workflows.push({
        name: 'generate-integration-tests',
        content: `---
description: Generate integration tests for API endpoints and system components
---

* Identify integration points (APIs, databases, services)
* Create integration test files
* Test end-to-end workflows
* Use realistic test data and fixtures
* Include proper setup and teardown
* Ensure tests are idempotent`
      });
    }

    // Full profile workflows
    if (level === 'full') {
      workflows.push({
        name: 'security-audit',
        content: `---
description: Perform comprehensive security audit of the codebase
---

* Scan for common vulnerabilities (SQL injection, XSS, etc.)
* Check authentication and authorization logic
* Review input validation and sanitization
* Examine error handling for information leakage
* Verify secure handling of sensitive data
* Check third-party dependencies
* Suggest remediation steps
* Prioritize findings by severity`
      });

      workflows.push({
        name: 'performance-audit',
        content: `---
description: Analyze code for performance bottlenecks and optimization opportunities
---

* Profile code to identify hotspots
* Check for N+1 queries and inefficient algorithms
* Analyze caching opportunities
* Review resource management
* Suggest specific optimizations
* Estimate performance impact
* Prioritize recommendations`
      });
    }

    return workflows;
  }

  private async generateCodexFiles(
    units: GuidelineUnit[],
    selection: ProfileSelection,
    projectPath: string
  ): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [...renderGuidelineFiles('codex', units)];

    // Codex reads AGENTS.md (32 KiB limit) and skills from .agents/skills. There is no
    // documented .codex/instructions.md, so the guideline index and workflows live in AGENTS.md.
    if (hasEnabledCapability('codex', selection.level, 'plugins')) {
      const pluginGenerator = new CodexPluginGenerator(
        this.workflowInjector.getCommands(),
        this.pluginVersion,
        selection.level
      );
      files.push(...await pluginGenerator.generateFiles(projectPath));
    }

    if (hasEnabledCapability('codex', selection.level, 'hooks')) {
      files.push(...this.generateCodexHookFiles(selection));
    }

    return files;
  }

  private generateCodexHookFiles(selection: ProfileSelection): GeneratedFile[] {
    const hooksJson = {
      hooks: {
        SessionStart: [
          {
            matcher: 'startup|resume',
            hooks: [
              {
                type: 'command',
                command: '/usr/bin/python3 "$(git rev-parse --show-toplevel 2>/dev/null || pwd)/.codex/hooks/aicgen_session_start.py"',
                timeout: 10,
                statusMessage: 'Loading AICGEN profile limits'
              }
            ]
          }
        ]
      },
      aicgen: {
        profileLevel: selection.level,
        safety: [
          'This hook only adds developer context at session start.',
          'Review and trust Codex hooks with /hooks before they run.',
          'Do not add network calls, secrets access, or destructive commands to generated hooks.'
        ]
      }
    };

    const script = `#!/usr/bin/env python3
import json

context = (
    "AICGEN profile ${selection.level}: read AGENTS.md before editing. "
    "Use project-local aicgen skills for SDLC work. Treat hooks, MCP, and plugin setup as advanced surfaces "
    "that require explicit user review before expansion."
)

print(json.dumps({
    "continue": True,
    "hookSpecificOutput": {
        "hookEventName": "SessionStart",
        "additionalContext": context
    }
}))
`;

    return [
      {
        path: '.codex/hooks.json',
        content: JSON.stringify(hooksJson, null, 2) + '\n',
        type: 'config'
      },
      {
        path: '.codex/hooks/aicgen_session_start.py',
        content: script,
        type: 'config'
      }
    ];
  }

  private generateMcpTemplateFile(
    assistant: AIAssistant,
    selection: ProfileSelection
  ): GeneratedFile {
    const assistantName = assistant === 'copilot'
      ? 'GitHub Copilot'
      : assistant === 'codex'
        ? 'OpenAI Codex'
        : assistant;

    const content = `# AICGEN MCP Template - ${assistantName}

**Profile level:** ${selection.level}

This file is documentation only. AICGEN does not generate executable MCP server configuration by default.

## Safe Use

- Add MCP servers only when the project needs external tools or private context.
- Keep commands local and deterministic where possible.
- Never place secrets directly in generated config files.
- Review each server command, environment variable, and permission before enabling it.

## Suggested Server Review Checklist

1. What data can the server read?
2. What commands or network calls can it perform?
3. Does it need credentials, and where are they stored?
4. Can it modify project files or external systems?
5. Is the server scoped to this workspace?

## Placeholder

Add tool-specific MCP config manually after review.
`;

    return {
      path: `.aicgen/mcp/${assistant}.md`,
      content,
      type: 'config'
    };
  }

  private generateUniversalAgentsFile(
    units: GuidelineUnit[],
    selection: ProfileSelection
  ): GeneratedFile {
    const archLine = selection.architecture === 'other'
      ? ''
      : `**Architecture:** ${selection.architecture}\n`;

    const archSection = selection.architecture === 'other'
      ? ''
      : `## Architecture

This project follows **${selection.architecture}** architecture. See architecture guidelines in tool-specific files.

`;

    const hasWorkflows = selection.assistant === 'codex'
      ? hasEnabledCapability('codex', selection.level, 'skills')
      : hasEnabledCapability(selection.assistant, selection.level, 'workflow-commands');
    const workflowsSection = hasWorkflows
      ? selection.assistant === 'codex'
        ? this.workflowInjector.buildCodexWorkflowSummary()
        : this.workflowInjector.buildWorkflowSummary(
          selection.assistant === 'copilot' || selection.assistant === 'antigravity' ? 'aicgen-' : ''
        )
      : '';

    const content = `# AGENTS.md

## Project Overview

**Language:** ${selection.language}
**Type:** ${selection.projectType}
**Instruction Level:** ${selection.level}
${archLine}
${buildGuidelineIndex(selection.assistant, units)}
## Commands

${commandsSection(selection.language)}

## Code Style

See tool-specific instruction files for detailed code style guidelines:
- Claude Code: \`CLAUDE.md\`
- GitHub Copilot: \`.github/copilot-instructions.md\`
- Antigravity: \`.agents/rules/aicgen-instructions.md\`
- OpenAI Codex: \`AGENTS.md\` and \`.agents/skills/\`

${archSection}${buildAgenticProfileSection(selection.assistant, selection.level)}## Testing

Follow testing guidelines in tool-specific instruction files.

## Git Workflow

- Write clear commit messages
- Follow conventional commits if configured
- Run tests before pushing
- Keep PRs focused and reviewable

${workflowsSection}---

*Generated by aicgen - Universal AI agent instructions following the AGENTS.md standard*
`;

    return {
      path: 'AGENTS.md',
      content,
      type: 'universal'
    };
  }
}
