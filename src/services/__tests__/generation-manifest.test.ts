import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import {
  MANIFEST_PATH,
  hashContent,
  planStaleRemoval,
  readManifest,
  recordGenerated,
  removeStale,
  toRelative,
} from '../generation-manifest.js';

describe('generation manifest', () => {
  let root: string;

  const put = async (rel: string, content: string) => {
    await mkdir(dirname(join(root, rel)), { recursive: true });
    await writeFile(join(root, rel), content);
  };

  beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'aicgen-manifest-')); });
  afterEach(async () => { await rm(root, { recursive: true, force: true }); });

  it('treats a missing or corrupt manifest as a first run', async () => {
    expect(await readManifest(root)).toEqual({ version: 1, assistants: {} });
    await put(MANIFEST_PATH, '{ not json');
    expect(await readManifest(root)).toEqual({ version: 1, assistants: {} });
  });

  it('records POSIX-relative paths with content hashes per assistant', async () => {
    await recordGenerated(root, 'claude-code', [{ path: join(root, '.claude', 'rules', 'a.md'), content: 'A' }]);
    await recordGenerated(root, 'codex', [{ path: join(root, 'AGENTS.md'), content: 'B' }]);

    const manifest = await readManifest(root);
    expect(manifest.assistants['claude-code']).toEqual({ '.claude/rules/a.md': hashContent('A') });
    expect(manifest.assistants.codex).toEqual({ 'AGENTS.md': hashContent('B') });
    expect(toRelative(root, join(root, 'a', 'b.md'))).toBe('a/b.md');
  });

  it('plans removal only for unmodified files the new profile no longer produces', async () => {
    await put('.claude/rules/keep.md', 'K');
    await put('.claude/rules/gone.md', 'G');
    await put('.claude/rules/edited.md', 'E');
    await recordGenerated(root, 'claude-code', [
      { path: join(root, '.claude/rules/keep.md'), content: 'K' },
      { path: join(root, '.claude/rules/gone.md'), content: 'G' },
      { path: join(root, '.claude/rules/edited.md'), content: 'E' },
      { path: join(root, '.claude/rules/already-deleted.md'), content: 'X' },
    ]);
    await writeFile(join(root, '.claude/rules/edited.md'), 'E but the user changed it');

    const plan = await planStaleRemoval(root, await readManifest(root), 'claude-code', new Set(['.claude/rules/keep.md']));

    expect(plan.remove).toEqual(['.claude/rules/gone.md']);
    expect(plan.keptModified).toEqual(['.claude/rules/edited.md']);
  });

  it('never removes a file another assistant still claims', async () => {
    await put('AGENTS.md', 'shared');
    await recordGenerated(root, 'claude-code', [{ path: join(root, 'AGENTS.md'), content: 'shared' }]);
    await recordGenerated(root, 'codex', [{ path: join(root, 'AGENTS.md'), content: 'shared' }]);

    const plan = await planStaleRemoval(root, await readManifest(root), 'claude-code', new Set());
    expect(plan.remove).toEqual([]);
  });

  it('removes files and the empty folders they leave, but never the project root or user files', async () => {
    await put('.claude/skills/aicgen-old/SKILL.md', 'S');
    await put('.claude/skills/mine/SKILL.md', 'user skill');
    await recordGenerated(root, 'claude-code', [{ path: join(root, '.claude/skills/aicgen-old/SKILL.md'), content: 'S' }]);

    const manifest = await readManifest(root);
    await removeStale(root, await planStaleRemoval(root, manifest, 'claude-code', new Set()));

    expect(existsSync(join(root, '.claude/skills/aicgen-old'))).toBe(false);
    expect(await readFile(join(root, '.claude/skills/mine/SKILL.md'), 'utf-8')).toBe('user skill');
    expect(existsSync(root)).toBe(true);
  });

  it('can merge new files into an assistant entry without dropping the existing ones', async () => {
    await recordGenerated(root, 'claude-code', [{ path: join(root, 'a.md'), content: '1' }]);
    await recordGenerated(root, 'claude-code', [{ path: join(root, 'b.md'), content: '2' }], { merge: true });
    expect(Object.keys((await readManifest(root)).assistants['claude-code']!).sort()).toEqual(['a.md', 'b.md']);
  });
});
