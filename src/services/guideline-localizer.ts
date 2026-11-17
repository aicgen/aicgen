/**
 * Language-aware guideline localization.
 *
 * Many language-agnostic guidelines (testing, API design, architecture...) carry code
 * examples in one language, usually TypeScript. Delivering those examples to a Rust, Go
 * or Python project wastes context and can teach the assistant the wrong idioms. This
 * module removes fenced examples and sections that belong to a *different* programming
 * language than the project's, and prunes any heading left without content. Prose, rules
 * and language-neutral blocks (sql, bash, yaml, json, pseudocode, text...) are kept.
 */

/** Fence tags that identify a programming language, grouped into families. */
const FAMILIES: Record<string, string[]> = {
  js: ['typescript', 'ts', 'tsx', 'javascript', 'js', 'jsx', 'mjs', 'cjs', 'node'],
  python: ['python', 'py'],
  rust: ['rust', 'rs'],
  go: ['go', 'golang'],
  java: ['java'],
  csharp: ['csharp', 'cs', 'c#'],
  ruby: ['ruby', 'rb'],
  kotlin: ['kotlin', 'kt'],
  php: ['php'],
  swift: ['swift'],
  dart: ['dart'],
};

const TAG_TO_FAMILY = new Map<string, string>(
  Object.entries(FAMILIES).flatMap(([family, tags]) => tags.map(tag => [tag, family] as const))
);

const PROJECT_FAMILY: Record<string, string> = {
  typescript: 'js',
  javascript: 'js',
  python: 'python',
  rust: 'rust',
  go: 'go',
  java: 'java',
  csharp: 'csharp',
  ruby: 'ruby',
  kotlin: 'kotlin',
  php: 'php',
  swift: 'swift',
  dart: 'dart',
};

/** Section headings such as "Rust: Injection Prevention" or "Python". */
const LANGUAGE_HEADING =
  /^(rust|golang|go|python|java|javascript|typescript|c#|csharp|ruby|kotlin|php|swift|dart|node(?:\.js)?)\b\s*(?:[:\-–(]|$)/i;

const HEADING_FAMILY: Record<string, string> = {
  rust: 'rust', go: 'go', golang: 'go', python: 'python', java: 'java', javascript: 'js', typescript: 'js',
  'c#': 'csharp', csharp: 'csharp', ruby: 'ruby', kotlin: 'kotlin', php: 'php', swift: 'swift', dart: 'dart',
  node: 'js', 'node.js': 'js',
};

function fenceFamily(infoString: string): string | undefined {
  const tag = infoString.trim().split(/[\s,{]/)[0]?.toLowerCase();
  return tag ? TAG_TO_FAMILY.get(tag) : undefined;
}

function headingLevel(line: string): number {
  const match = line.match(/^(#{1,6})\s+\S/);
  return match ? match[1].length : 0;
}

interface Section {
  level: number;
  heading: string;
  own: string[];
  children: Section[];
}

function parseSections(lines: string[]): Section {
  const root: Section = { level: 0, heading: '', own: [], children: [] };
  const stack: Section[] = [root];
  let inFence = false;

  for (const line of lines) {
    if (/^\s*```/.test(line)) inFence = !inFence;
    const level = inFence ? 0 : headingLevel(line);

    if (level > 0) {
      while (stack[stack.length - 1].level >= level) stack.pop();
      const section: Section = { level, heading: line, own: [], children: [] };
      stack[stack.length - 1].children.push(section);
      stack.push(section);
    } else {
      stack[stack.length - 1].own.push(line);
    }
  }
  return root;
}

function hasContent(section: Section): boolean {
  return section.own.some(line => line.trim() !== '') || section.children.some(hasContent);
}

function render(section: Section, projectFamily: string, out: string[]): void {
  const title = section.heading.replace(/^#+\s+/, '').replace(/[*`]/g, '').trim();
  const headingFamily = section.level >= 2 ? HEADING_FAMILY[(title.match(LANGUAGE_HEADING)?.[1] ?? '').toLowerCase()] : undefined;
  if (headingFamily && headingFamily !== projectFamily) return;
  if (section.level > 0 && !hasContent(section)) return;

  if (section.level > 0) out.push(section.heading);
  out.push(...section.own);
  for (const child of section.children) render(child, projectFamily, out);
}

/** Removes fenced code blocks written in another language (and the "...:" line introducing them). */
function stripForeignFences(lines: string[], projectFamily: string): string[] {
  const out: string[] = [];
  let skipping = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(/^\s*```(.*)$/);

    if (skipping) {
      if (fence) skipping = false;
      continue;
    }

    if (fence) {
      const family = fenceFamily(fence[1]);
      if (family && family !== projectFamily) {
        skipping = true;
        // Drop the lead-in line ("Always use strict mode:" or "**Bad:**") when it only introduced this block.
        let j = out.length - 1;
        while (j >= 0 && out[j].trim() === '') j--;
        if (j >= 0 && out.length - 1 - j <= 1 && /(:|:\*\*|\*\*)\s*$/.test(out[j].trim()) && headingLevel(out[j]) === 0) {
          out.length = j;
        }
        continue;
      }
    }
    out.push(line);
  }
  return out;
}

/** Drops "Good/Bad" labels that no longer introduce anything. */
function dropOrphanLabels(lines: string[]): string[] {
  const label = /^\s*(\*\*(good|bad|before|after|usage|example)[^*]*\*\*:?|[✅❌]\s*(good|bad)[^`]*:?)\s*$/i;
  return lines.filter((line, index) => {
    if (!label.test(line)) return true;
    let next = index + 1;
    while (next < lines.length && lines[next].trim() === '') next++;
    return next < lines.length && !label.test(lines[next]) && headingLevel(lines[next]) === 0;
  });
}

function collapseBlankLines(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    if (line.trim() === '' && out.length > 0 && out[out.length - 1].trim() === '') continue;
    out.push(line);
  }
  while (out.length > 0 && out[out.length - 1].trim() === '') out.pop();
  return out;
}

/**
 * Returns the guideline body with examples for other programming languages removed.
 * Returns the original body for unknown languages or when nothing meaningful would remain.
 */
export function localizeGuideline(body: string, language: string): string {
  const projectFamily = PROJECT_FAMILY[language];
  if (!projectFamily) return body;

  const lines = stripForeignFences(
    body.split('\n').filter(line => projectFamily === 'js' || !/^- Examples below are TypeScript\b/.test(line)),
    projectFamily
  );
  const root = parseSections(dropOrphanLabels(lines));
  const rendered: string[] = [];
  render(root, projectFamily, rendered);

  const result = collapseBlankLines(rendered).join('\n');
  const substantive = result.split('\n').filter(l => l.trim() !== '' && headingLevel(l) === 0).length;
  return substantive >= 3 ? `${result}\n` : body;
}
