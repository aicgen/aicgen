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

      case 'copilot':
        return [{
          path: '.github/instructions/workflows.instructions.md',
          content: this.formatCopilotInstructions(),
          type: 'workflow' as const,
        }];

      case 'antigravity':
        return this.commands.map(cmd => ({
          path: `.agent/workflows/${cmd.name}.md`,
          content: this.formatAntigravityWorkflow(cmd),
          type: 'workflow' as const,
        }));

      case 'codex':
        return [];

      default:
        return [];
    }
  }

  buildWorkflowSummary(): string {
    const flow = this.commands.map(cmd => `\`/${cmd.name}\``).join(' → ');
    const bullets = this.commands
      .map(cmd => `- \`/${cmd.name}\` — ${cmd.description}`)
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

  private formatCopilotInstructions(): string {
    const commandDocs = this.commands
      .map(cmd => `### /${cmd.name}\n${cmd.description}\n\n${cmd.content}`)
      .join('\n\n---\n\n');

    return `---\napplyTo: "**/*"\ndescription: "SDLC workflow slash commands"\n---\n\n# SDLC Workflows\n\nFollow this structured workflow for every feature. Start with \`/spec\` and proceed in order.\n\nFlow: \`/spec\` → \`/research\` → \`/plan\` → \`/build\` → \`/check\` → \`/ship\`\n\nAll spec and plan artifacts are saved to the \`docs/\` directory.\n\n${commandDocs}\n\n---\n*Generated by aicgen*\n`;
  }

  generateCopilotPromptFiles(): GeneratedFile[] {
    return this.commands.map(cmd => ({
      path: `.github/prompts/${cmd.name}.prompt.md`,
      content: this.formatCopilotPrompt(cmd),
      type: 'workflow' as const,
    }));
  }

  generateCopilotChatModeFiles(): GeneratedFile[] {
    return [{
      path: '.github/chatmodes/aicgen-review.chatmode.md',
      content: `---
description: "Review changes against the generated AICGEN guidelines and SDLC workflow"
tools: ["codebase", "changes", "problems", "testFailure"]
---

# AICGEN Review

Use this mode for focused review of implementation work against the repository instructions, scoped guideline files, and SDLC workflow prompts.

Review in this order:

1. Confirm the intended SDLC step and active artifact in docs/.
2. Check changed files against .github/copilot-instructions.md and .github/instructions/*.instructions.md.
3. Identify correctness, security, testing, and maintainability issues before style-only feedback.
4. Recommend concrete fixes with file paths and concise rationale.
`,
      type: 'config',
    }];
  }

  private formatAntigravityWorkflow(cmd: WorkflowCommand): string {
    return `---\ndescription: "${cmd.description}"\n---\n\n${cmd.content}\n`;
  }

  private formatCopilotPrompt(cmd: WorkflowCommand): string {
    return `---
description: "${cmd.description}"
mode: agent
---

# /${cmd.name}

${cmd.description}

Follow the generated repository instructions and scoped instruction files while running this SDLC step.

${cmd.content}
`;
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
