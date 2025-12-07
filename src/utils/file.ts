import { promises as fs } from 'fs';
import { dirname } from 'path';

export async function exists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

export async function readFile(path: string): Promise<string> {
  return fs.readFile(path, 'utf-8');
}

export async function writeFile(path: string, content: string): Promise<void> {
  await ensureDir(dirname(path));
  const tempPath = `${path}.tmp`;
  await fs.writeFile(tempPath, content, 'utf-8');
  await fs.rename(tempPath, path);
}

export async function ensureDir(path: string): Promise<void> {
  await fs.mkdir(path, { recursive: true });
}

export async function readJSON<T>(path: string): Promise<T> {
  const content = await readFile(path);
  return JSON.parse(content);
}

export async function writeJSON<T>(path: string, data: T): Promise<void> {
  const content = JSON.stringify(data, null, 2);
  await writeFile(path, content);
}

export interface FileToWrite {
  path: string;
  content: string;
}

export async function writeFiles(files: FileToWrite[]): Promise<void> {
  const tempFiles: string[] = [];

  try {
    for (const file of files) {
      await ensureDir(dirname(file.path));
      const tempPath = `${file.path}.tmp`;
      await fs.writeFile(tempPath, file.content, 'utf-8');
      tempFiles.push(tempPath);
    }

    for (let i = 0; i < files.length; i++) {
      await fs.rename(tempFiles[i], files[i].path);
    }
  } catch (error) {
    for (const tempPath of tempFiles) {
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
    }
    throw error;
  }
}
