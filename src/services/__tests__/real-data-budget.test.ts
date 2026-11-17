import { AssistantFileWriter } from '../assistant-file-writer.js';
import { WorkflowInjector } from '../workflow-injector.js';
import { EMBEDDED_DATA, EMBEDDED_SDLC_CONTENT } from '../../embedded-data.js';
import type { AIAssistant, Language } from '../../models/project.js';
import type { InstructionLevel } from '../../models/profile.js';

function selectIds(language: Language, level: InstructionLevel, architecture: string): string[] {
  return Object.entries(EMBEDDED_DATA.mappings)
    .filter(([, m]) => !m.languages || m.languages.includes(language))
    .filter(([, m]) => !m.levels || m.levels.includes(level))
    .filter(([, m]) => !m.architectures || m.architectures.includes(architecture))
    .filter(([, m]) => !m.datasources || m.datasources.length === 0)
    .map(([id]) => id);
}

const ASSISTANTS: AIAssistant[] = ['claude-code', 'copilot', 'antigravity', 'codex'];
const LEVELS: InstructionLevel[] = ['basic', 'standard', 'full'];

describe('context budgets with the embedded guideline data', () => {
  const writer = AssistantFileWriter.create(WorkflowInjector.fromContent(EMBEDDED_SDLC_CONTENT));

  for (const assistant of ASSISTANTS) {
    for (const level of LEVELS) {
      it(`${assistant} / rust / ${level}: no hard-limit violations, small always-on files`, async () => {
        const language: Language = 'rust';
        const ids = selectIds(language, level, 'layered');
        const selection = { assistant, language, level, architecture: 'layered' as const, projectType: 'cli' as const, projectName: 'demo', datasource: 'none' as const };

        const files = await (await writer).generateFiles(assistant, ids, selection, '/tmp/demo');
        const findings = (await writer).analyzeBudget(assistant, selection, files);

        expect(findings.filter(f => f.severity === 'error')).toEqual([]);

        const alwaysOn = findings.filter(f => f.kind === 'always-on');
        expect(alwaysOn.length).toBeGreaterThan(0);
        // Guideline bodies must never be inlined into always-on files.
        expect(Math.max(...alwaysOn.map(f => f.tokens))).toBeLessThan(4500);
        // Every scoped rule and skill is individually small enough to load on demand.
        const oversized = findings.filter(f => f.kind !== 'always-on' && f.severity !== 'ok');
        expect(oversized.map(f => `${f.path}: ${f.message}`)).toEqual([]);
      });
    }
  }
});

describe('guideline descriptions in the embedded data', () => {
  const entries = Object.entries(EMBEDDED_DATA.mappings);

  it('every guideline has a curated "what + Use when" description', () => {
    const bad = entries
      .filter(([, m]) => !m.description || !/\bUse when\b/.test(m.description) || m.description.length < 40 || m.description.length > 280)
      .map(([id]) => id);
    expect(bad).toEqual([]);
  });

  it('descriptions are distinct so skills are not ambiguous', () => {
    const seen = new Map<string, string>();
    const duplicates: string[] = [];
    for (const [id, m] of entries) {
      const key = m.description!.toLowerCase();
      if (seen.has(key)) duplicates.push(`${id} = ${seen.get(key)}`);
      seen.set(key, id);
    }
    expect(duplicates).toEqual([]);
  });

  it('guidelines stay small enough to load on demand', () => {
    const large = entries
      .map(([id, m]) => [id, Math.ceil((EMBEDDED_DATA.guidelines[m.path] ?? '').length / 4)] as const)
      .filter(([, tokens]) => tokens > 3000);
    expect(large).toEqual([]);
  });
});
