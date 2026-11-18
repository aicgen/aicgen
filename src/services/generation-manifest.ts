import { createHash } from 'crypto';
import { mkdir, readFile, readdir, rmdir, unlink, writeFile } from 'fs/promises';
import { dirname, join, relative } from 'path';
import type { AIAssistant } from '../models/project.js';

/**
 * Generation manifest: `.aicgen/manifest.json` records every file aicgen wrote for each
 * assistant, with a content hash. On the next run, files the previous profile produced but the
 * new one does not (a smaller profile level, another language or architecture, a renamed
 * guideline) are removed, so stale rules and skills do not keep loading into context.
 *
 * Safety rules: a file is only removed when it still matches its recorded hash (edits made by
 * the user are kept and reported), and never when another assistant's entry still claims it.
 */

export const MANIFEST_PATH = '.aicgen/manifest.json';

export interface Manifest {
  version: 1;
  assistants: Partial<Record<AIAssistant, Record<string, string>>>;
}

export interface StalePlan {
  /** Project-relative (POSIX) paths that will be removed. */
  remove: string[];
  /** Stale files the user modified; they are kept. */
  keptModified: string[];
}

export function hashContent(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

export function toRelative(projectPath: string, absolutePath: string): string {
  return relative(projectPath, absolutePath).replace(/\\/g, '/');
}

export async function readManifest(projectPath: string): Promise<Manifest> {
  try {
    const parsed = JSON.parse(await readFile(join(projectPath, MANIFEST_PATH), 'utf-8')) as Manifest;
    if (parsed && parsed.version === 1 && typeof parsed.assistants === 'object') return parsed;
  } catch {
    // Missing or unreadable: treat as a first run.
  }
  return { version: 1, assistants: {} };
}

async function writeManifest(projectPath: string, manifest: Manifest): Promise<void> {
  const target = join(projectPath, MANIFEST_PATH);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');
}

/** Decide which files the previous profile of `assistant` left behind. */
export async function planStaleRemoval(
  projectPath: string,
  manifest: Manifest,
  assistant: AIAssistant,
  nextFiles: Set<string>
): Promise<StalePlan> {
  const previous = manifest.assistants[assistant] ?? {};
  const claimedElsewhere = new Set(
    Object.entries(manifest.assistants)
      .filter(([id]) => id !== assistant)
      .flatMap(([, files]) => Object.keys(files ?? {}))
  );

  const plan: StalePlan = { remove: [], keptModified: [] };
  for (const [path, recordedHash] of Object.entries(previous)) {
    if (nextFiles.has(path) || claimedElsewhere.has(path)) continue;
    let current: string;
    try {
      current = await readFile(join(projectPath, path), 'utf-8');
    } catch {
      continue; // already gone
    }
    if (hashContent(current) === recordedHash) plan.remove.push(path);
    else plan.keptModified.push(path);
  }
  return plan;
}

async function removeEmptyParents(projectPath: string, path: string): Promise<void> {
  let dir = dirname(join(projectPath, path));
  while (dir.length > projectPath.length) {
    try {
      if ((await readdir(dir)).length > 0) return;
      await rmdir(dir);
    } catch {
      return;
    }
    dir = dirname(dir);
  }
}

export async function removeStale(projectPath: string, plan: StalePlan): Promise<void> {
  for (const path of plan.remove) {
    try {
      await unlink(join(projectPath, path));
      await removeEmptyParents(projectPath, path);
    } catch {
      // Best effort: a file that cannot be removed simply stays.
    }
  }
}

/** Replace `assistant`'s entry (or, with `merge`, add to it) and save the manifest. */
export async function recordGenerated(
  projectPath: string,
  assistant: AIAssistant,
  files: Array<{ path: string; content: string }>,
  options: { merge?: boolean; manifest?: Manifest } = {}
): Promise<void> {
  const manifest = options.manifest ?? await readManifest(projectPath);
  const entry: Record<string, string> = options.merge ? { ...(manifest.assistants[assistant] ?? {}) } : {};
  for (const file of files) {
    const rel = toRelative(projectPath, file.path);
    if (rel === MANIFEST_PATH) continue;
    entry[rel] = hashContent(file.content);
  }
  manifest.assistants[assistant] = entry;
  await writeManifest(projectPath, manifest);
}
