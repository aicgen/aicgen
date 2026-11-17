import { readFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';
import { AIAssistant } from '../models/project.js';
import { EMBEDDED_SDLC_CONTENT } from '../embedded-data.js';

export interface GeneratedFile {
  path: string;
  content: string;
  type: 'main' | 'guideline' | 'config' | 'agent' | 'skill' | 'universal' | 'workflow' | 'plugin';
}

export interface WorkflowCommand {
  name: string;
  description: string;
  content: string;
}

export interface WorkflowSourcePaths {
  userDataPath?: string;
  officialCachePath?: string;
  embeddedContent?: string;
}

export class WorkflowInjector {
  private constructor(private readonly commands: WorkflowCommand[]) {}

  static fromContent(sdlcContent: string): WorkflowInjector {
    return new WorkflowInjector(WorkflowInjector.parse(sdlcContent));
  }

  static async create(source?: string | WorkflowSourcePaths): Promise<WorkflowInjector> {
    const fallback = typeof source === 'object' && source?.embeddedContent
      ? source.embeddedContent
      : EMBEDDED_SDLC_CONTENT;
    const paths = typeof source === 'string'
      ? WorkflowInjector.pathsForRepoDataDir(source)
      : WorkflowInjector.pathsForDefaultDataSources(source);

    const content = await WorkflowInjector.readFirst(paths, fallback);
    return WorkflowInjector.fromContent(content);
  }

  private static parse(content: string): WorkflowCommand[] {
    const commands: WorkflowCommand[] = [];
    const blocks = content.split(/\n(?=## \/)/);

    for (const block of blocks) {
      const lines = block.trim().split('\n');
      const heading = lines[0];
      if (!heading.startsWith('## /')) continue;

      const nameMatch = heading.match(/^## \/(\w+)/);
      if (!nameMatch) {
        console.warn(`[WorkflowInjector] Skipping unrecognised command heading: "${heading}"`);
        continue;
      }
      const name = nameMatch[1];

      const hasDescription = lines[1] !== undefined && !lines[1].startsWith('**') && !lines[1].startsWith('#') && lines[1].trim() !== '';
      const description = hasDescription ? lines[1].trim() : '';
      const body = lines
        .slice(hasDescription ? 2 : 1)
        .join('\n')
        .replace(/\n---\s*$/, '')
        .trim();

      commands.push({ name, description, content: body });
    }

    return commands;
  }

  getCommands(): WorkflowCommand[] {
    return this.commands;
  }

  generateWorkflowFiles(assistant: AIAssistant): GeneratedFile[] {
    switch (assistant) {
      case 'claude-code':
        return this.commands.map(cmd => ({
          path: `.claude/commands/${cmd.name}.md`,
          content: this.formatClaudeCommand(cmd),
          type: 'workflow' as const,
        }));

      // Skills are the portable, supported way to ship reusable workflows: Copilot has
      // deprecated prompt files and Antigravity has deprecated workflows in favour of them.
      case 'copilot':
        return this.generateWorkflowSkillFiles('.github/skills');

      case 'antigravity':
        return this.generateWorkflowSkillFiles('.agents/skills');

      case 'codex':
        return [];

      default:
        return [];
    }
  }

  /** `prefix` is 'aicgen-' for skill-based workflows, which are invoked as /aicgen-spec. */
  buildWorkflowSummary(prefix = ''): string {
    const flow = this.commands.map(cmd => `\`/${prefix}${cmd.name}\``).join(' → ');
    const bullets = this.commands
      .map(cmd => `- \`/${prefix}${cmd.name}\` — ${cmd.description}`)
      .join('\n');

    return `## Workflows

Use these slash commands for structured SDLC delivery:

Flow: ${flow}

${bullets}

`;
  }

  buildCodexWorkflowSummary(): string {
    const flow = this.commands.map(cmd => `\`/aicgen-${cmd.name}\``).join(' → ');
    const bullets = this.commands
      .map(cmd => `- \`/aicgen-${cmd.name}\` — ${cmd.description} (legacy aicgen \`/${cmd.name}\`)`)
      .join('\n');

    return `## Workflows

Use the project-local \`aicgen-sdlc\` Codex plugin for structured SDLC delivery:

Flow: ${flow}

${bullets}

`;
  }

  buildWorkflowSection(): string {
    const commandDocs = this.commands
      .map(cmd => `### /${cmd.name}\n${cmd.description}\n\n${cmd.content}`)
      .join('\n\n---\n\n');

    return `## SDLC Workflows

The following slash commands guide you through a structured SDLC. Always start with \`/spec\` and follow the flow: \`/spec\` → \`/research\` → \`/plan\` → \`/build\` → \`/check\` → \`/ship\`.

All spec and plan artifacts are saved to the \`docs/\` directory (created automatically if it does not exist).

${commandDocs}`;
  }

  buildCodexWorkflowSection(): string {
    const flow = this.commands.map(cmd => `\`/aicgen-${cmd.name}\``).join(' → ');
    const commandDocs = this.commands
      .map(cmd => `### /aicgen-${cmd.name} (aicgen /${cmd.name})\n${cmd.description}\n\n${cmd.content}`)
      .join('\n\n---\n\n');

    return `## SDLC Workflows

The project-local \`aicgen-sdlc\` Codex plugin provides these lifecycle skills. Use the namespaced commands in Codex to avoid conflicts with built-in Codex commands such as \`/plan\`.

Flow: ${flow}

Legacy aicgen command names such as \`/spec\`, \`/research\`, and \`/plan\` refer to the same lifecycle steps, but Codex users should invoke the namespaced \`/aicgen-*\` commands.

All spec and plan artifacts are saved to the \`docs/\` directory (created automatically if it does not exist).

${commandDocs}`;
  }

  private formatClaudeCommand(cmd: WorkflowCommand): string {
    return `# /${cmd.name}\n\n${cmd.description}\n\n${cmd.content}\n`;
  }

  /** Workflow skills: one folder per command; invoked explicitly, never auto-selected by the model. */
  generateWorkflowSkillFiles(dir: string): GeneratedFile[] {
    return this.commands.map(cmd => {
      const name = `aicgen-${cmd.name}`;
      const description = `${cmd.description} Runs the aicgen /${cmd.name} SDLC step.`.slice(0, 300);
      return {
        path: `${dir}/${name}/SKILL.md`,
        content: `---\nname: ${name}\ndescription: ${JSON.stringify(description)}\ndisable-model-invocation: true\n---\n\n# /${cmd.name}\n\n${cmd.description}\n\n${cmd.content}\n`,
        type: 'workflow' as const,
      };
    });
  }

  generateCopilotAgentFiles(): GeneratedFile[] {
    return [{
      path: '.github/agents/aicgen-review.agent.md',
      content: `---
name: aicgen-review
description: "Review changes against the generated AICGEN guidelines and SDLC workflow. Use before opening a pull request."
tools: ["read", "search"]
---

# AICGEN Review

Review implementation work against the repository instructions, the scoped guideline files and skills, and the SDLC workflow prompts. Do not edit files; report findings.

Review in this order:

1. Confirm the intended SDLC step and active artifact in docs/.
2. Check changed files against .github/copilot-instructions.md, .github/instructions/*.instructions.md and the relevant skills in .github/skills/.
3. Identify correctness, security, testing, and maintainability issues before style-only feedback.
4. Recommend concrete fixes with file paths and concise rationale.
`,
      type: 'config',
    }];
  }

  private static pathsForRepoDataDir(dataDir: string): string[] {
    return [
      join(dataDir, 'data/workflows/sdlc.md'),
      join(dataDir, 'workflows/sdlc.md'),
      join(dataDir, 'guidelines/workflows/sdlc.md'),
    ];
  }

  private static pathsForDefaultDataSources(source?: WorkflowSourcePaths): string[] {
    const userDataPath = source?.userDataPath ?? join(homedir(), '.aicgen', 'data');
    const officialCachePath = source?.officialCachePath ?? join(homedir(), '.aicgen', 'cache', 'official');

    return [
      join(userDataPath, 'guidelines/workflows/sdlc.md'),
      join(userDataPath, 'workflows/sdlc.md'),
      join(officialCachePath, 'guidelines/workflows/sdlc.md'),
      join(officialCachePath, 'workflows/sdlc.md'),
    ];
  }

  private static async readFirst(paths: string[], fallback: string): Promise<string> {
    for (const path of paths) {
      try {
        return await readFile(path, 'utf-8');
      } catch {
        // Try the next source in priority order.
      }
    }

    return fallback;
  }
}
