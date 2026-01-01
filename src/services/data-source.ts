import { readFile, readdir, access } from 'fs/promises';
import { join } from 'path';
import YAML from 'yaml';
import { EMBEDDED_DATA, GuidelineMapping } from '../embedded-data';

export interface GuidelineData {
  mappings: Record<string, GuidelineMapping>;
  guidelines: Record<string, string>;
  version?: string;
}

export interface DataSource {
  load(): Promise<GuidelineData>;
  exists(): Promise<boolean>;
  getVersion(): Promise<string>;
}

export class EmbeddedDataSource implements DataSource {
  async load(): Promise<GuidelineData> {
    return {
      mappings: EMBEDDED_DATA.mappings,
      guidelines: EMBEDDED_DATA.guidelines,
      version: 'embedded'
    };
  }

  async exists(): Promise<boolean> {
    return true;
  }

  async getVersion(): Promise<string> {
    return 'embedded';
  }
}

export class FileSystemDataSource implements DataSource {
  constructor(private basePath: string) {}

  async load(): Promise<GuidelineData> {
    const mappingsPath = join(this.basePath, 'guideline-mappings.yml');
    const mappingsContent = await readFile(mappingsPath, 'utf-8');
    const mappings = YAML.parse(mappingsContent) as Record<string, GuidelineMapping>;

    const guidelines: Record<string, string> = {};
    const guidelinesDir = join(this.basePath, 'guidelines');

    try {
      await this.loadGuidelinesRecursive(guidelinesDir, '', guidelines);
    } catch {
      // Guidelines directory might not exist yet
    }

    const version = await this.readVersion();

    return { mappings, guidelines, version };
  }

  async exists(): Promise<boolean> {
    try {
      await access(join(this.basePath, 'guideline-mappings.yml'));
      return true;
    } catch {
      return false;
    }
  }

  async getVersion(): Promise<string> {
    return await this.readVersion();
  }

  private async readVersion(): Promise<string> {
    try {
      const versionPath = join(this.basePath, 'version.json');
      const versionContent = await readFile(versionPath, 'utf-8');
      const versionData = JSON.parse(versionContent);
      return versionData.version || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private async loadGuidelinesRecursive(
    dir: string,
    relativePath: string,
    guidelines: Record<string, string>
  ): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          await this.loadGuidelinesRecursive(fullPath, relPath, guidelines);
        } else if (entry.name.endsWith('.md')) {
          const content = await readFile(fullPath, 'utf-8');
          guidelines[relPath] = content;
        }
      }
    } catch {
      // Directory might not exist
    }
  }
}

export class CustomMappingsDataSource implements DataSource {
  constructor(private basePath: string) {}

  async load(): Promise<GuidelineData> {
    const mappingsPath = join(this.basePath, 'custom-mappings.yml');

    let mappings: Record<string, GuidelineMapping> = {};
    try {
      const mappingsContent = await readFile(mappingsPath, 'utf-8');
      mappings = YAML.parse(mappingsContent) as Record<string, GuidelineMapping>;
    } catch {
      // Custom mappings don't exist yet
    }

    const guidelines: Record<string, string> = {};
    const guidelinesDir = join(this.basePath, 'guidelines');

    try {
      await this.loadGuidelinesRecursive(guidelinesDir, '', guidelines);
    } catch {
      // Guidelines directory might not exist yet
    }

    return { mappings, guidelines, version: 'custom' };
  }

  async exists(): Promise<boolean> {
    try {
      await access(join(this.basePath, 'custom-mappings.yml'));
      return true;
    } catch {
      // Check if guidelines directory exists
      try {
        await access(join(this.basePath, 'guidelines'));
        return true;
      } catch {
        return false;
      }
    }
  }

  async getVersion(): Promise<string> {
    return 'custom';
  }

  private async loadGuidelinesRecursive(
    dir: string,
    relativePath: string,
    guidelines: Record<string, string>
  ): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          await this.loadGuidelinesRecursive(fullPath, relPath, guidelines);
        } else if (entry.name.endsWith('.md')) {
          const content = await readFile(fullPath, 'utf-8');
          guidelines[relPath] = content;
        }
      }
    } catch {
      // Directory might not exist
    }
  }
}

export class HybridDataSource implements DataSource {
  constructor(private sources: DataSource[]) {}

  async load(): Promise<GuidelineData> {
    const results = await Promise.all(
      this.sources.map(async (source) => {
        if (await source.exists()) {
          try {
            return await source.load();
          } catch (error) {
            console.warn(`Failed to load from data source: ${error}`);
            return null;
          }
        }
        return null;
      })
    );

    const validResults = results.filter((r): r is GuidelineData => r !== null);

    if (validResults.length === 0) {
      throw new Error('No data sources available');
    }

    return this.merge(validResults);
  }

  async exists(): Promise<boolean> {
    const exists = await Promise.all(this.sources.map((s) => s.exists()));
    return exists.some((e) => e);
  }

  async getVersion(): Promise<string> {
    for (const source of this.sources) {
      if (await source.exists()) {
        const version = await source.getVersion();
        if (version !== 'custom' && version !== 'unknown') {
          return version;
        }
      }
    }
    return 'embedded';
  }

  private merge(dataArray: GuidelineData[]): GuidelineData {
    // Merge with priority: first source has highest priority
    const merged: GuidelineData = {
      mappings: {},
      guidelines: {},
      version: dataArray[0]?.version || 'unknown'
    };

    // Merge in reverse order so earlier sources override later ones
    for (let i = dataArray.length - 1; i >= 0; i--) {
      const data = dataArray[i];
      Object.assign(merged.mappings, data.mappings);
      Object.assign(merged.guidelines, data.guidelines);

      // Use the first non-custom, non-unknown version
      if (
        data.version &&
        data.version !== 'custom' &&
        data.version !== 'unknown' &&
        (merged.version === 'unknown' || merged.version === 'custom')
      ) {
        merged.version = data.version;
      }
    }

    return merged;
  }
}
