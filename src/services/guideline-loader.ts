import { GuidelineMapping } from '../embedded-data.js';
import { Language } from '../models/project.js';
import { InstructionLevel, ArchitectureType, DatasourceType } from '../models/profile.js';
import { homedir } from 'os';
import { join } from 'path';
import {
  DataSource,
  HybridDataSource,
  FileSystemDataSource,
  CustomMappingsDataSource,
  EmbeddedDataSource,
  GuidelineData
} from './data-source.js';
import { CONFIG } from '../config.js';

export type { GuidelineMapping };

export class GuidelineLoader {
  private mappings: Record<string, GuidelineMapping>;
  private guidelines: Record<string, string>;
  private version: string;

  static async create(dataSource?: DataSource): Promise<GuidelineLoader> {
    const source = dataSource || GuidelineLoader.createDefaultDataSource();
    const data = await source.load();
    return new GuidelineLoader(data);
  }

  private static createDefaultDataSource(): DataSource {
    const homeDir = homedir();
    const userDataPath = join(homeDir, CONFIG.CACHE_DIR_NAME, CONFIG.DATA_DIR);
    const officialCachePath = join(homeDir, CONFIG.CACHE_DIR_NAME, CONFIG.CACHE_DIR);

    return new HybridDataSource([
      new CustomMappingsDataSource(userDataPath),      // Highest priority
      new FileSystemDataSource(officialCachePath),     // Official updates
      new EmbeddedDataSource()                         // Fallback
    ]);
  }

  private constructor(data: GuidelineData) {
    this.mappings = data.mappings;
    this.guidelines = data.guidelines;
    this.version = data.version || 'unknown';
  }

  getVersion(): string {
    return this.version;
  }

  getAllGuidelines(): Array<{ id: string; mapping: GuidelineMapping }> {
    return Object.entries(this.mappings).map(([id, mapping]) => ({
      id,
      mapping
    }));
  }

  getGuidelinesForProfile(
    language: Language,
    level: InstructionLevel,
    architecture: ArchitectureType,
    datasource?: DatasourceType
  ): string[] {
    const matchingGuidelines: string[] = [];

    for (const [guidelineId, mapping] of Object.entries(this.mappings)) {
      // Language filter
      if (mapping.languages && !mapping.languages.includes(language)) {
        continue;
      }

      // Level filter
      if (mapping.levels && !mapping.levels.includes(level)) {
        continue;
      }

      // Architecture filter - SKIP for "full" level (include all architectures)
      if (level !== 'full' && mapping.architectures && !mapping.architectures.includes(architecture)) {
        continue;
      }

      // Datasource filter - skip if guideline requires specific datasource that doesn't match
      if (datasource && mapping.datasources && !mapping.datasources.includes(datasource)) {
        continue;
      }

      // Skip database guidelines entirely if datasource is 'none'
      if (datasource === 'none' && mapping.category === 'Database') {
        continue;
      }

      matchingGuidelines.push(guidelineId);
    }

    return matchingGuidelines;
  }

  loadGuideline(guidelineId: string): string {
    const mapping = this.mappings[guidelineId];
    if (!mapping) {
      throw new Error(`Guideline not found: ${guidelineId}`);
    }

    const content = this.guidelines[mapping.path];
    if (!content) {
      throw new Error(`Guideline content not found: ${mapping.path}`);
    }

    return content;
  }

  getMapping(guidelineId: string): GuidelineMapping | undefined {
    return this.mappings[guidelineId];
  }

  assembleProfile(
    language: Language,
    level: InstructionLevel,
    architecture: ArchitectureType,
    datasource?: DatasourceType
  ): string {
    const guidelineIds = this.getGuidelinesForProfile(language, level, architecture, datasource);

    if (guidelineIds.length === 0) {
      throw new Error(`No guidelines found for profile: ${language}-${level}-${architecture}`);
    }

    const guidelineContents = guidelineIds.map(id => this.loadGuideline(id));
    return guidelineContents.join('\n\n---\n\n');
  }

  getGuidelinesByCategory(language?: Language, level?: InstructionLevel, architecture?: ArchitectureType, datasource?: DatasourceType): Record<string, string[]> {
    const byCategory: Record<string, string[]> = {};

    for (const [guidelineId, mapping] of Object.entries(this.mappings)) {
      if (language && mapping.languages && !mapping.languages.includes(language)) {
        continue;
      }

      if (level && mapping.levels && !mapping.levels.includes(level)) {
        continue;
      }

      // Architecture filter - SKIP for "full" level (include all architectures)
      if (level !== 'full' && architecture && mapping.architectures && !mapping.architectures.includes(architecture)) {
        continue;
      }

      if (datasource && mapping.datasources && !mapping.datasources.includes(datasource)) {
        continue;
      }

      if (datasource === 'none' && mapping.category === 'Database') {
        continue;
      }

      const category = mapping.category || 'General';
      if (!byCategory[category]) {
        byCategory[category] = [];
      }
      byCategory[category].push(guidelineId);
    }

    return byCategory;
  }

  getCategoryTree(language?: Language, level?: InstructionLevel, architecture?: ArchitectureType, datasource?: DatasourceType): CategoryNode[] {
    const byCategory = this.getGuidelinesByCategory(language, level, architecture, datasource);

    return Object.entries(byCategory)
      .map(([name, guidelineIds]) => ({
        name,
        count: guidelineIds.length,
        guidelines: guidelineIds.map(id => ({
          id,
          name: this.mappings[id].path.split('/').pop()?.replace('.md', '') || id,
          path: this.mappings[id].path
        }))
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  getMetrics(guidelineIds: string[]): ProfileMetrics {
    const categories: Record<string, number> = {};

    for (const id of guidelineIds) {
      const mapping = this.mappings[id];
      if (mapping) {
        const category = mapping.category || 'General';
        categories[category] = (categories[category] || 0) + 1;
      }
    }

    return {
      guidelineCount: guidelineIds.length,
      hooksCount: this.estimateHooks(guidelineIds),
      subAgentsCount: this.estimateSubAgents(guidelineIds),
      estimatedSize: this.estimateSize(guidelineIds),
      categories: Object.entries(categories).map(([name, count]) => ({ name, count }))
    };
  }

  private estimateHooks(guidelineIds: string[]): number {
    const hasFormatting = guidelineIds.some(id => id.includes('style') || id.includes('typescript') || id.includes('python'));
    const hasSecurity = guidelineIds.some(id => id.includes('security'));
    const hasTesting = guidelineIds.some(id => id.includes('testing'));

    let count = 0;
    if (hasFormatting) count += 1;
    if (hasSecurity) count += 2;
    if (hasTesting) count += 1;
    return count;
  }

  private estimateSubAgents(guidelineIds: string[]): number {
    const hasArchitecture = guidelineIds.some(id => id.includes('architecture'));
    const hasSecurity = guidelineIds.some(id => id.includes('security'));
    const hasStyle = guidelineIds.some(id => id.includes('style'));

    let count = 1;
    if (hasArchitecture) count += 1;
    if (hasSecurity) count += 1;
    if (hasStyle && guidelineIds.length > 10) count += 1;
    return count;
  }

  private estimateSize(guidelineIds: string[]): string {
    const avgSizePerGuideline = 2.5;
    const totalKB = guidelineIds.length * avgSizePerGuideline;

    if (totalKB < 1) return '<1 KB';
    if (totalKB < 10) return `~${Math.round(totalKB)} KB`;
    return `~${Math.round(totalKB / 10) * 10} KB`;
  }

  getStats(): {
    totalGuidelines: number;
    byLanguage: Record<string, number>;
    byLevel: Record<string, number>;
    byArchitecture: Record<string, number>;
    byCategory: Record<string, number>;
    byTag: Record<string, number>;
  } {
    const stats = {
      totalGuidelines: Object.keys(this.mappings).length,
      byLanguage: {} as Record<string, number>,
      byLevel: {} as Record<string, number>,
      byArchitecture: {} as Record<string, number>,
      byCategory: {} as Record<string, number>,
      byTag: {} as Record<string, number>
    };

    for (const mapping of Object.values(this.mappings)) {
      if (mapping.languages) {
        for (const lang of mapping.languages) {
          stats.byLanguage[lang] = (stats.byLanguage[lang] || 0) + 1;
        }
      } else {
        stats.byLanguage['all'] = (stats.byLanguage['all'] || 0) + 1;
      }

      if (mapping.levels) {
        for (const lvl of mapping.levels) {
          stats.byLevel[lvl] = (stats.byLevel[lvl] || 0) + 1;
        }
      } else {
        stats.byLevel['all'] = (stats.byLevel['all'] || 0) + 1;
      }

      if (mapping.architectures) {
        for (const arch of mapping.architectures) {
          stats.byArchitecture[arch] = (stats.byArchitecture[arch] || 0) + 1;
        }
      } else {
        stats.byArchitecture['all'] = (stats.byArchitecture['all'] || 0) + 1;
      }

      const category = mapping.category || 'General';
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;

      if (mapping.tags) {
        for (const tag of mapping.tags) {
          stats.byTag[tag] = (stats.byTag[tag] || 0) + 1;
        }
      }
    }

    return stats;
  }
}

export interface CategoryNode {
  name: string;
  count: number;
  guidelines: {
    id: string;
    name: string;
    path: string;
  }[];
}

export interface ProfileMetrics {
  guidelineCount: number;
  hooksCount: number;
  subAgentsCount: number;
  estimatedSize: string;
  categories: {
    name: string;
    count: number;
  }[];
}
