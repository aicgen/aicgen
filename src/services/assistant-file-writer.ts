import { join } from 'path';
import { AIAssistant } from '../models/project';
import { ProfileSelection } from '../models/profile';
import { GuidelineLoader } from './guideline-loader';
import { HookGenerator } from './hook-generator';
import { SubAgentGenerator } from './subagent-generator';
import { WorkflowInjector, GeneratedFile } from './workflow-injector.js';
import { CodexPluginGenerator } from './codex-plugin-generator.js';
import { writeFiles } from '../utils/file.js';
import {
  buildAgenticProfileSection,
  hasEnabledCapability,
} from './agentic-capabilities.js';

export type { GeneratedFile };

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

    const categoryTree = this.organizeByCategory(guidelineIds);

    switch (assistant) {
      case 'claude-code':
        files.push(...await this.generateClaudeCodeFiles(categoryTree, guidelineIds, selection, projectPath));
        break;
      case 'copilot':
        files.push(...await this.generateCopilotFiles(categoryTree, selection));
        break;
      case 'antigravity':
        files.push(...await this.generateAntigravityFiles(categoryTree, selection));
        break;
      case 'codex':
        files.push(...await this.generateCodexFiles(categoryTree, selection, projectPath));
        break;
      default:
        throw new Error(`Unsupported assistant: ${assistant}`);
    }

    if (hasEnabledCapability(assistant, selection.level, 'workflow-commands')) {
      const workflowFiles = this.workflowInjector.generateWorkflowFiles(assistant);
      files.push(...workflowFiles);
    }

    if (hasEnabledCapability(assistant, selection.level, 'prompt-files')) {
      files.push(...this.workflowInjector.generateCopilotPromptFiles());
    }

    if (hasEnabledCapability(assistant, selection.level, 'chat-modes')) {
      files.push(...this.workflowInjector.generateCopilotChatModeFiles());
    }

    if (hasEnabledCapability(assistant, selection.level, 'mcp-templates')) {
      files.push(this.generateMcpTemplateFile(assistant, selection));
    }

    files.push(this.generateUniversalAgentsFile(categoryTree, selection));

    return files.map(file => ({
      ...file,
      path: join(projectPath, file.path)
    }));
  }

  async writeFiles(files: GeneratedFile[]): Promise<void> {
    await writeFiles(files.map(file => ({ path: file.path, content: file.content })));
  }

  private organizeByCategory(guidelineIds: string[]): Map<string, string[]> {
    const byCategory = new Map<string, string[]>();

    for (const id of guidelineIds) {
      const mapping = this.guidelineLoader.getMapping(id);
      if (mapping) {
        const category = mapping.category || 'General';
        if (!byCategory.has(category)) {
          byCategory.set(category, []);
        }
        byCategory.get(category)!.push(id);
      }
    }

    return byCategory;
  }

  private async generateClaudeCodeFiles(
    categoryTree: Map<string, string[]>,
    guidelineIds: string[],
    selection: ProfileSelection,
    projectPath: string
  ): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    const mainReferences: string[] = [];
    const guidelines: string[] = [];

    for (const [category, ids] of categoryTree) {
      const categoryFile = category.toLowerCase().replace(/\s+/g, '-');
      const categoryContent = ids.map(id => {
        const content = this.guidelineLoader.loadGuideline(id);
        guidelines.push(content);
        return content;
      }).join('\n\n---\n\n');

      files.push({
        path: `.claude/guidelines/${categoryFile}.md`,
        content: `# ${category}\n\n${categoryContent}`,
        type: 'guideline'
      });

      mainReferences.push(`- **${category}**: @.claude/guidelines/${categoryFile}.md`);
    }

    const archDescription = selection.architecture === 'other'
      ? ''
      : ` and ${selection.architecture} architecture`;

    const workflowsSection = hasEnabledCapability('claude-code', selection.level, 'workflow-commands')
      ? this.workflowInjector.buildWorkflowSummary()
      : '';
    const agenticProfileSection = buildAgenticProfileSection('claude-code', selection.level);
    const verificationNotes = [
      '- **Follow the guidelines** referenced above.',
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

## Guidelines

This project follows structured coding guidelines organized by category:

${mainReferences.join('\n')}

## Quick Reference

- Run tests: Check package.json scripts
- Build: Check package.json scripts
- Code style: See Code Style guidelines above
- Architecture: See Architecture guidelines above

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
    const settingsContent = this.hookGenerator.generateClaudeCodeSettings(hooks, projectPath, selection.level);

    files.push({
      path: '.claude/settings.json',
      content: settingsContent,
      type: 'config'
    });

    const subAgents = await this.subAgentGenerator.generateSubAgents(guidelineIds, selection.level);
    for (const agent of subAgents) {
      files.push({
        path: `.claude/agents/${agent.name}.md`,
        content: agent.content,
        type: 'agent'
      });
    }

    const skills = await this.subAgentGenerator.generateSkills(guidelineIds, selection.level);
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
    categoryTree: Map<string, string[]>,
    selection: ProfileSelection
  ): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    const mainReferences: string[] = [];

    for (const [category, ids] of categoryTree) {
      const categoryFile = category.toLowerCase().replace(/\s+/g, '-');
      const categoryContent = ids.map(id =>
        this.guidelineLoader.loadGuideline(id)
      ).join('\n\n---\n\n');

      let applyTo = "**/*";

      // Smart globs for specific categories
      if (category.toLowerCase().includes('testing')) {
        applyTo = "**/*.test.ts, **/*.spec.ts, **/tests/**";
      } else if (category.toLowerCase().includes('language') || category.toLowerCase().includes('style')) {
        applyTo = "**/*.ts, **/*.js, **/*.tsx, **/*.jsx"; // Adjust based on language in future
      }

      const instructionsContent = `---
applyTo: "${applyTo}"
description: "${category} guidelines"
---

# ${category}

${categoryContent}
`;

      files.push({
        path: `.github/instructions/${categoryFile}.instructions.md`,
        content: instructionsContent,
        type: 'guideline'
      });

      mainReferences.push(`- ${category}: @.github/instructions/${categoryFile}.instructions.md`);
    }

    if (hasEnabledCapability('copilot', selection.level, 'workflow-commands')) {
      mainReferences.push(`- Workflows: @.github/instructions/workflows.instructions.md`);
    }

    if (hasEnabledCapability('copilot', selection.level, 'prompt-files')) {
      mainReferences.push(`- Prompt files: @.github/prompts/*.prompt.md`);
    }

    if (hasEnabledCapability('copilot', selection.level, 'chat-modes')) {
      mainReferences.push(`- Review chat mode: @.github/chatmodes/aicgen-review.chatmode.md`);
    }

    const archDescription = selection.architecture === 'other'
      ? ''
      : ` and ${selection.architecture}`;

    const mainContent = `# GitHub Copilot Instructions

**Role:** You are an expert AI pair programmer specialized in ${selection.language}${archDescription}.

## Guidelines

${mainReferences.join('\n')}

## Development

See the instruction files above for detailed guidelines on:
- Code style and naming conventions
- Architecture patterns and best practices
- Testing requirements
- Security considerations

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

  private async generateAntigravityFiles(
    categoryTree: Map<string, string[]>,
    selection: ProfileSelection
  ): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];
    const ruleFiles: string[] = [];

    // Generate separate rule files for each category
    for (const [category, ids] of categoryTree) {
      const guidelines = ids.map(id => {
        const guideline = this.guidelineLoader.loadGuideline(id);
        return guideline;
      }).filter(Boolean).join('\n\n---\n\n');

      if (guidelines) {
        const fileName = category.toLowerCase().replace(/\s+/g, '-');

        const content = `# ${category} Rules

${guidelines}

---
*Generated by aicgen*
`;

        files.push({
          path: `.agent/rules/${fileName}.md`,
          content,
          type: 'guideline'
        });

        ruleFiles.push(`- **${category}**: @.agent/rules/${fileName}.md`);
      }
    }

    // Generate main instruction file (Index/System Prompt)
    const archDescription = selection.architecture === 'other'
      ? ''
      : ` and ${selection.architecture} architecture`;

    const mainContent = `# Google Antigravity Instructions

**Role:** You are an expert software engineer specialized in ${selection.language}${archDescription}.
**Objective:** Assist the user in building high-quality, maintainable software following strict project guidelines.

## Rule Index

This project is governed by the following rule sets:

${ruleFiles.join('\n')}

## Core Principles
1. **Act as an Agent**: Don't just answer; perform actions, verify results, and course-correct.
2. **Follow Guidelines**: Strictly adhere to the rules linked above.
3. **Think Step-by-Step**: Break down complex tasks into smaller, verifiable steps.

${buildAgenticProfileSection('antigravity', selection.level)}

---
*Generated by aicgen*
`;

    files.push({
      path: '.agent/rules/instructions.md',
      content: mainContent,
      type: 'main'
    });

    // Generate workflows based on instruction level
    if (hasEnabledCapability('antigravity', selection.level, 'workflow-commands')) {
      const workflows = this.getWorkflowsForLevel(selection.level);
      for (const workflow of workflows) {
        files.push({
          path: `.agent/workflows/${workflow.name}.md`,
          content: workflow.content,
          type: 'config'
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
    categoryTree: Map<string, string[]>,
    selection: ProfileSelection,
    projectPath: string
  ): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    let allGuidelines = '';
    for (const [category, ids] of categoryTree) {
      const categoryContent = ids.map(id =>
        this.guidelineLoader.loadGuideline(id)
      ).join('\n\n');

      allGuidelines += `\n\n## ${category}\n\n${categoryContent}\n\n---\n`;
    }

    const workflowSection = hasEnabledCapability('codex', selection.level, 'skills')
      ? this.workflowInjector.buildCodexWorkflowSection()
      : '';

    const content = `# Codex Development Guide

**Role:** You are an expert software engineer specialized in ${selection.language}.
**Objective:** Assist the user in writing high-quality code.

**Language:** ${selection.language}
**Type:** ${selection.projectType}

${allGuidelines}

${workflowSection}

${buildAgenticProfileSection('codex', selection.level)}

---
*Generated by aicgen*
`;

    files.push({
      path: '.codex/instructions.md',
      content,
      type: 'main'
    });

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
    "AICGEN profile ${selection.level}: read AGENTS.md and .codex/instructions.md before editing. "
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
    categoryTree: Map<string, string[]>,
    selection: ProfileSelection
  ): GeneratedFile {
    const categories: string[] = [];

    for (const [category, ids] of categoryTree) {
      const examples = ids.slice(0, 3).map(id => {
        const mapping = this.guidelineLoader.getMapping(id);
        const fileName = mapping?.path.split('/').pop()?.replace('.md', '') || id;
        return `- ${fileName}`;
      }).join('\n  ');

      categories.push(`### ${category}\n\n  ${examples}\n`);
    }

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
        : this.workflowInjector.buildWorkflowSummary()
      : '';

    const content = `# AGENTS.md

## Project Overview

**Language:** ${selection.language}
**Type:** ${selection.projectType}
**Instruction Level:** ${selection.level}
${archLine}
## Development Guidelines

This project follows structured coding guidelines across multiple categories:

${categories.join('\n')}

## Commands

**Install dependencies:**
\`\`\`bash
# Check package.json for package manager
npm install
# or yarn install
# or pnpm install
# or bun install
\`\`\`

**Run tests:**
\`\`\`bash
# Check package.json scripts section
npm test
\`\`\`

**Build:**
\`\`\`bash
# Check package.json scripts section
npm run build
\`\`\`

## Code Style

See tool-specific instruction files for detailed code style guidelines:
- Claude Code: \`CLAUDE.md\`
- GitHub Copilot: \`.github/copilot-instructions.md\`
- Antigravity: \`.agent/rules/instructions.md\`
- OpenAI Codex: \`.codex/instructions.md\`

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
