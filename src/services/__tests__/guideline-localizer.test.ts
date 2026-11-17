import { localizeGuideline } from '../guideline-localizer.js';
import { buildGuidelineUnits, GuidelineSource } from '../guideline-delivery.js';

const BODY = `# Error Handling

## Rules

- Never swallow errors.
- Examples below are TypeScript; apply the same principles idiomatically in the project language.
- Add context when rethrowing.

## Custom Errors

Use typed errors with a stable code:

\`\`\`typescript
class AppError extends Error {}
\`\`\`

## Notes

Keep messages actionable.

\`\`\`sql
SELECT 1;
\`\`\`

## Rust: Error Types

\`\`\`rust
enum E {}
\`\`\`

- Use thiserror in libraries.

### Python

\`\`\`python
raise ValueError("x")
\`\`\`
`;

describe('localizeGuideline', () => {
  it('removes examples written in another language and the line that introduced them', () => {
    const out = localizeGuideline(BODY, 'go');
    expect(out).not.toContain('AppError');
    expect(out).not.toContain('Use typed errors with a stable code:');
    expect(out).not.toContain('ValueError');
  });

  it('prunes headings that are left without content', () => {
    const out = localizeGuideline(BODY, 'go');
    expect(out).not.toContain('## Custom Errors');
    expect(out).not.toContain('### Python');
    expect(out).toContain('## Rules');
    expect(out).toContain('## Notes');
  });

  it('keeps language-neutral blocks such as sql', () => {
    expect(localizeGuideline(BODY, 'go')).toContain('SELECT 1;');
  });

  it('drops sections named after another language but keeps the project language section', () => {
    expect(localizeGuideline(BODY, 'go')).not.toContain('Rust: Error Types');
    const rust = localizeGuideline(BODY, 'rust');
    expect(rust).toContain('## Rust: Error Types');
    expect(rust).toContain('enum E {}');
    expect(rust).toContain('thiserror');
  });

  it('treats TypeScript and JavaScript as one family', () => {
    const ts = localizeGuideline(BODY, 'javascript');
    expect(ts).toContain('class AppError extends Error {}');
    expect(ts).toContain('Examples below are TypeScript');
    expect(ts).not.toContain('enum E {}');
  });

  it('removes the "Examples below are TypeScript" note when no TypeScript remains', () => {
    expect(localizeGuideline(BODY, 'python')).not.toContain('Examples below are TypeScript');
  });

  it('returns the original text for unknown languages and for bodies that would be left empty', () => {
    expect(localizeGuideline(BODY, 'cobol')).toBe(BODY);
    const onlyCode = '# T\n\n## A\n\n```typescript\nconst a = 1;\n```\n';
    expect(localizeGuideline(onlyCode, 'rust')).toBe(onlyCode);
  });

  it('is idempotent', () => {
    const once = localizeGuideline(BODY, 'go');
    expect(localizeGuideline(once, 'go')).toBe(once);
  });
});

describe('buildGuidelineUnits localization', () => {
  const source = (languages?: string[]): GuidelineSource => ({
    getMapping: () => ({ path: 'x.md', category: 'Testing', tags: ['testing'], languages }),
    loadGuideline: () => BODY,
  });

  it('localizes language-agnostic guidelines to the project language', () => {
    const [unit] = buildGuidelineUnits(['g'], source(undefined), 'go');
    expect(unit.body).not.toContain('AppError');
  });

  it('leaves language-specific guidelines untouched', () => {
    const [unit] = buildGuidelineUnits(['g'], source(['typescript']), 'typescript');
    expect(unit.body).toContain('AppError');
    const [kept] = buildGuidelineUnits(['g'], source(['go']), 'go');
    expect(kept.body).toContain('AppError');
  });
});
