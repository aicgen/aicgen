import type { AssistantFileWriter } from '../services/assistant-file-writer.js';

/** Converts Windows separators to `/` so paths can be compared with POSIX literals. */
export function toPosix(path: string): string {
  return path.replace(/\\/g, '/');
}

/**
 * `AssistantFileWriter.generateFiles` returns paths joined with the project directory using the
 * operating system's separator (backslashes on Windows). Tests assert on `/`-separated suffixes,
 * so wrap the writer to return POSIX paths. Writing files works with either separator.
 */
type Generate = AssistantFileWriter['generateFiles'];

export function withPosixPaths<T extends AssistantFileWriter>(writer: T): T {
  const original: Generate = writer.generateFiles.bind(writer);
  writer.generateFiles = async (...args: Parameters<Generate>) => {
    const files = await original(...args);
    return files.map(file => ({ ...file, path: toPosix(file.path) }));
  };
  return writer;
}
