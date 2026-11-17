import { localizeGuideline } from './guideline-localizer.js';
import { AIAssistant } from '../models/project.js';
import { formatApplyTo, getLanguageProfile } from './language-profile.js';
import { SKILL_NAME_MAX, splitMarkdown } from './context-budget.js';
import type { GeneratedFile } from './workflow-injector.js';

/**
 * Guideline delivery: how guideline bodies reach each assistant without
 * inflating always-on context.
 *
 * - `source` guidelines (language, code style, error handling) load when files
 *   matching the language's source globs are touched.
 * - `test` guidelines load when test files are touched.
 * - everything else is `on-demand`: a skill (or model-decided rule) whose short
 *   description is always visible and whose body loads only when relevant.
 *
 * One file per guideline keeps each unit small and individually budgeted.
 */

export type DeliveryKind = 'source' | 'test' | 'on-demand';

export interface GuidelineUnit {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  body: string;
  kind: DeliveryKind;
  globs: string[];
}

export interface GuidelineSource {
  getMapping(id: string): { path: string; category?: string; description?: string; languages?: string[]; tags?: string[] } | undefined;
  loadGuideline(id: string): string;
}

const SOURCE_CATEGORIES = new Set(['Language', 'Code Style', 'Error Handling']);
const MAX_DESCRIPTION = 300;

function humanize(id: string): string {
  return id.replace(/[-_/]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function slugify(id: string): string {
  return id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function classify(category: string, tags: string[]): DeliveryKind {
  if (tags.includes('testing') || category === 'Testing') return 'test';
  if (SOURCE_CATEGORIES.has(category)) return 'source';
  return 'on-demand';
}

function clip(text: string, max = MAX_DESCRIPTION): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

export function buildGuidelineUnits(
  ids: string[],
  source: GuidelineSource,
  language: string
): GuidelineUnit[] {
  const profile = getLanguageProfile(language);
  const units: GuidelineUnit[] = [];

  for (const id of ids) {
    const mapping = source.getMapping(id);
    if (!mapping) continue;

    const raw = source.loadGuideline(id).replace(/\r\n/g, '\n').trim();
    if (!raw) continue;
    // Language-agnostic guidelines may carry examples in other languages; keep only matching ones.
    const body = mapping.languages?.length ? raw : localizeGuideline(raw, language).trim();

    const category = mapping.category || 'General';
    const tags = mapping.tags ?? [];
    const kind = classify(category, tags);
    const title = body.match(/^#\s+(.+)$/m)?.[1]?.trim() || humanize(id);
    const globs = kind === 'source' ? profile.sourceGlobs : kind === 'test' ? profile.testGlobs : [];
    const topics = tags.filter(tag => tag !== language).slice(0, 5).join(', ');

    // A curated "what + use when" description is what lets the model decide
    // whether to load a guideline; the generated text is only a fallback for
    // custom mappings that do not provide one.
    const fallback = kind === 'on-demand'
      ? `${title}. Use when the task involves ${topics || category.toLowerCase()}.`
      : `${title}. Use when editing ${kind === 'test' ? 'test' : 'source'} files (${formatApplyTo(globs)}).`;
    const description = clip(mapping.description?.trim() || fallback);

    units.push({ id, slug: slugify(id), title, description, category, tags, body, kind, globs });
  }

  return units;
}

function skillName(unit: GuidelineUnit): string {
  return `aicgen-${unit.slug}`.slice(0, SKILL_NAME_MAX).replace(/-+$/, '');
}

function skillFile(dir: string, unit: GuidelineUnit): GeneratedFile {
  const name = skillName(unit);
  return {
    path: `${dir}/${name}/SKILL.md`,
    content: `---\nname: ${name}\ndescription: ${JSON.stringify(unit.description)}\n---\n\n${unit.body}\n`,
    type: 'skill',
  };
}

const ANTIGRAVITY_RULE_MAX_BYTES = 24_000;
// Frontmatter plus a part heading fits comfortably in this margin.
const ANTIGRAVITY_BODY_BUDGET = ANTIGRAVITY_RULE_MAX_BYTES - 1_000;

function antigravityRules(unit: GuidelineUnit): GeneratedFile[] {
  const frontmatter = unit.kind === 'on-demand'
    ? `trigger: model_decision\ndescription: ${JSON.stringify(unit.description)}`
    : `trigger: glob\nglobs: ${JSON.stringify(formatApplyTo(unit.globs))}\ndescription: ${JSON.stringify(unit.description)}`;

  // A rule without valid frontmatter is silently discarded, so every part gets its own.
  return splitMarkdown(unit.body, ANTIGRAVITY_BODY_BUDGET, unit.title).map((part, index) => ({
    path: `.agents/rules/aicgen-${unit.slug}${index === 0 ? '' : `-part-${index + 1}`}.md`,
    content: `---\n${frontmatter}\n---\n\n${part}\n`,
    type: 'guideline' as const,
  }));
}

/** Files that deliver the guideline bodies for one assistant. */
export function renderGuidelineFiles(assistant: AIAssistant, units: GuidelineUnit[]): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  for (const unit of units) {
    switch (assistant) {
      case 'claude-code':
        if (unit.kind === 'on-demand') {
          files.push(skillFile('.claude/skills', unit));
        } else {
          const paths = unit.globs.map(glob => `  - ${JSON.stringify(glob)}`).join('\n');
          files.push({
            path: `.claude/rules/${unit.slug}.md`,
            content: `---\npaths:\n${paths}\n---\n\n${unit.body}\n`,
            type: 'guideline',
          });
        }
        break;

      case 'copilot':
        if (unit.kind === 'on-demand') {
          files.push(skillFile('.github/skills', unit));
        } else {
          files.push({
            path: `.github/instructions/${unit.slug}.instructions.md`,
            content: `---\napplyTo: ${JSON.stringify(formatApplyTo(unit.globs))}\ndescription: ${JSON.stringify(unit.description)}\n---\n\n${unit.body}\n`,
            type: 'guideline',
          });
        }
        break;

      case 'antigravity':
        files.push(...antigravityRules(unit));
        break;

      case 'codex':
        // Codex has no path-scoped rules; skills are its progressive-disclosure surface.
        files.push(skillFile('.agents/skills', unit));
        break;
    }
  }

  return files;
}

const DELIVERY_LABEL: Record<AIAssistant, Record<DeliveryKind, string>> = {
  'claude-code': {
    source: 'Loaded automatically when you edit matching source files (`.claude/rules/`)',
    test: 'Loaded automatically when you edit tests (`.claude/rules/`)',
    'on-demand': 'Skills, loaded when the task matches (`.claude/skills/`)',
  },
  copilot: {
    source: 'Applied automatically to matching source files (`.github/instructions/`)',
    test: 'Applied automatically to test files (`.github/instructions/`)',
    'on-demand': 'Skills, loaded when the task matches (`.github/skills/`)',
  },
  antigravity: {
    source: 'Rules activated by file glob (`.agents/rules/aicgen-*`)',
    test: 'Rules activated by file glob (`.agents/rules/aicgen-*`)',
    'on-demand': 'Rules the agent reads when relevant (`.agents/rules/`, model decision)',
  },
  codex: {
    source: 'Skills for source files (`.agents/skills/`)',
    test: 'Skills for tests (`.agents/skills/`)',
    'on-demand': 'Skills, loaded when the task matches (`.agents/skills/`)',
  },
};

const COMPACT_THRESHOLD = 24;

/** The name an assistant (and the user) sees for a delivered guideline. */
export function deliveredName(assistant: AIAssistant, unit: GuidelineUnit): string {
  const prefixed = assistant === 'codex' || assistant === 'antigravity' || unit.kind === 'on-demand';
  return prefixed ? skillName(unit) : unit.slug;
}

/**
 * Compact markdown index of delivered guidelines for always-on files.
 * Lists names only (never bodies) and collapses to one line per category when
 * there are many guidelines.
 */
export function buildGuidelineIndex(assistant: AIAssistant, units: GuidelineUnit[]): string {
  if (units.length === 0) {
    return '## Guidelines\n\nNo guidelines selected.\n';
  }

  const compact = units.length > COMPACT_THRESHOLD;
  const lines = [
    '## Guidelines',
    '',
    'Detailed guidelines are not inlined here, to keep context small. They load only when relevant:',
    '',
  ];

  for (const kind of ['source', 'test', 'on-demand'] as DeliveryKind[]) {
    const group = units.filter(unit => unit.kind === kind);
    if (group.length === 0) continue;

    lines.push(`**${DELIVERY_LABEL[assistant][kind]}**`);
    if (compact) {
      const byCategory = new Map<string, string[]>();
      for (const unit of group) {
        byCategory.set(unit.category, [...(byCategory.get(unit.category) ?? []), deliveredName(assistant, unit)]);
      }
      for (const [category, slugs] of byCategory) {
        lines.push(`- ${category}: ${slugs.join(', ')}`);
      }
    } else {
      for (const unit of group) {
        lines.push(`- \`${deliveredName(assistant, unit)}\` — ${unit.title}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}
