import { AIAssistant } from '../models/project.js';
import { InstructionLevel } from '../models/profile.js';

/**
 * Context budget rules.
 *
 * Instruction files are loaded into the model's context window, where every
 * token competes with the actual task. aicgen therefore keeps the always-on
 * files small (an index plus commands), and delivers detailed guidelines only
 * when they are relevant: path-scoped rules for source files, skills or
 * model-decided rules for everything else.
 *
 * Hard limits come from vendor docs (content beyond them is truncated or
 * dropped). Soft limits are published recommendations. Both are checked.
 */

export type BudgetKind =
  | 'always-on'      // loaded every session (CLAUDE.md, AGENTS.md, copilot-instructions.md)
  | 'scoped-rule'    // loaded when matching files are touched
  | 'skill'          // loaded on demand (SKILL.md body)
  | 'workflow';      // slash command / workflow body

export interface BudgetLimit {
  /** Content past this size is truncated or ignored by the tool. */
  hardBytes?: number;
  /** Recommended maximum, in estimated tokens. */
  softTokens?: number;
  /** Recommended maximum, in lines. */
  softLines?: number;
  note: string;
}

/** Approximate tokens (English prose and code average about 4 characters per token). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function countLines(text: string): number {
  return text === '' ? 0 : text.split('\n').length;
}

/** Always-on token budget by profile level (index + commands, not guideline bodies). */
export const ALWAYS_ON_TOKEN_BUDGET: Record<InstructionLevel, number> = {
  basic: 1500,
  standard: 2500,
  full: 4000,
};

export const SKILL_NAME_MAX = 64;

export function getBudgetLimit(
  assistant: AIAssistant,
  kind: BudgetKind,
  level: InstructionLevel = 'standard'
): BudgetLimit {
  switch (kind) {
    case 'always-on':
      if (assistant === 'claude-code') {
        return { softLines: 200, softTokens: ALWAYS_ON_TOKEN_BUDGET[level], note: 'Claude Code recommends CLAUDE.md under 200 lines; imports still load in full.' };
      }
      if (assistant === 'codex') {
        return { hardBytes: 32 * 1024, softTokens: ALWAYS_ON_TOKEN_BUDGET[level], note: 'Codex stops reading AGENTS.md at project_doc_max_bytes (32 KiB by default).' };
      }
      return { softTokens: ALWAYS_ON_TOKEN_BUDGET[level], note: 'Keep always-on instructions short; they load for every request.' };
    case 'scoped-rule':
      if (assistant === 'antigravity') {
        return { hardBytes: 24_000, softTokens: 5000, note: 'Antigravity truncates rule files at 24,000 bytes.' };
      }
      return { softTokens: 5000, note: 'Keep each scoped rule focused; split large guidelines.' };
    case 'skill':
      return { softTokens: 5000, softLines: 500, note: 'Agent Skills spec: SKILL.md body under 5,000 tokens and 500 lines.' };
    case 'workflow':
      if (assistant === 'antigravity') {
        return { hardBytes: 12_000, note: 'Antigravity workflow files are limited to 12,000 characters.' };
      }
      return { softTokens: 3000, note: 'Keep workflow prompts short and step-based.' };
  }
}

export interface BudgetFinding {
  path: string;
  kind: BudgetKind;
  bytes: number;
  tokens: number;
  lines: number;
  severity: 'ok' | 'warning' | 'error';
  message?: string;
}

export function checkBudget(
  assistant: AIAssistant,
  kind: BudgetKind,
  path: string,
  content: string,
  level: InstructionLevel = 'standard'
): BudgetFinding {
  const limit = getBudgetLimit(assistant, kind, level);
  const bytes = Buffer.byteLength(content, 'utf-8');
  const tokens = estimateTokens(content);
  const lines = countLines(content);
  const finding: BudgetFinding = { path, kind, bytes, tokens, lines, severity: 'ok' };

  if (limit.hardBytes !== undefined && bytes > limit.hardBytes) {
    finding.severity = 'error';
    finding.message = `${bytes} bytes exceeds the ${limit.hardBytes}-byte limit. ${limit.note}`;
  } else if (limit.softTokens !== undefined && tokens > limit.softTokens) {
    finding.severity = 'warning';
    finding.message = `~${tokens} tokens exceeds the ${limit.softTokens}-token budget. ${limit.note}`;
  } else if (limit.softLines !== undefined && lines > limit.softLines) {
    finding.severity = 'warning';
    finding.message = `${lines} lines exceeds the ${limit.softLines}-line recommendation. ${limit.note}`;
  }

  return finding;
}

/**
 * Split markdown into parts no larger than `maxBytes`, breaking at level-2
 * headings first, then at blank lines. Every part keeps a heading so it stays
 * readable on its own.
 */
export function splitMarkdown(content: string, maxBytes: number, title = 'Part'): string[] {
  if (Buffer.byteLength(content, 'utf-8') <= maxBytes) {
    return [content];
  }

  const sections = content.split(/\n(?=## )/);
  const parts: string[] = [];
  let current = '';

  const push = () => {
    if (current.trim()) parts.push(current.trimEnd());
    current = '';
  };

  for (const section of sections) {
    for (const piece of splitOversizedSection(section, maxBytes)) {
      const candidate = current ? `${current}\n${piece}` : piece;
      if (Buffer.byteLength(candidate, 'utf-8') > maxBytes) {
        push();
        current = piece;
      } else {
        current = candidate;
      }
    }
  }
  push();

  return parts.map((part, index) =>
    index === 0 || part.trimStart().startsWith('#') ? part : `# ${title} (continued)\n\n${part}`
  );
}

function splitOversizedSection(section: string, maxBytes: number): string[] {
  if (Buffer.byteLength(section, 'utf-8') <= maxBytes) return [section];

  const blocks = section.split(/\n{2,}/);
  const pieces: string[] = [];
  let current = '';
  for (const block of blocks) {
    const candidate = current ? `${current}\n\n${block}` : block;
    if (current && Buffer.byteLength(candidate, 'utf-8') > maxBytes) {
      pieces.push(current);
      current = block;
    } else {
      current = candidate;
    }
  }
  if (current) pieces.push(current);
  return pieces;
}

export function summarizeFindings(findings: BudgetFinding[]): {
  totalTokens: number;
  alwaysOnTokens: number;
  warnings: BudgetFinding[];
  errors: BudgetFinding[];
} {
  return {
    totalTokens: findings.reduce((sum, f) => sum + f.tokens, 0),
    alwaysOnTokens: findings.filter(f => f.kind === 'always-on').reduce((sum, f) => sum + f.tokens, 0),
    warnings: findings.filter(f => f.severity === 'warning'),
    errors: findings.filter(f => f.severity === 'error'),
  };
}

const ALWAYS_ON_FILES = [
  /(^|\/)CLAUDE\.md$/,
  /(^|\/)AGENTS\.md$/,
  /\.github\/copilot-instructions\.md$/,
  /\.agents?\/rules\/(aicgen-)?instructions\.md$/,
  /\.codex\/instructions\.md$/,
];

/** Which budget applies to a generated file, or null when it is not instruction content. */
export function classifyBudgetKind(filePath: string): BudgetKind | null {
  const path = filePath.replace(/\\/g, '/');
  if (ALWAYS_ON_FILES.some(pattern => pattern.test(path))) return 'always-on';
  if (/\/SKILL\.md$/.test(path)) return 'skill';
  if (/\.claude\/rules\/.+\.md$/.test(path)) return 'scoped-rule';
  if (/\.github\/instructions\/.+\.instructions\.md$/.test(path)) return 'scoped-rule';
  if (/\.agents?\/rules\/.+\.md$/.test(path)) return 'scoped-rule';
  if (/\.claude\/commands\/.+\.md$/.test(path)) return 'workflow';
  if (/\.agents?\/workflows\/.+\.md$/.test(path)) return 'workflow';
  return null;
}

export function analyzeBudgets(
  assistant: AIAssistant,
  level: InstructionLevel,
  files: Array<{ path: string; content: string }>
): BudgetFinding[] {
  const findings: BudgetFinding[] = [];
  for (const file of files) {
    const kind = classifyBudgetKind(file.path);
    if (kind) findings.push(checkBudget(assistant, kind, file.path, file.content, level));
  }
  return findings;
}
