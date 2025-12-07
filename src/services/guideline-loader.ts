import { EMBEDDED_DATA, GuidelineMapping } from '../embedded-data.js';
import { AIAssistant, Language } from '../models/project.js';
import { InstructionLevel, ArchitectureType } from '../models/profile.js';

export type { GuidelineMapping };

export class GuidelineLoader {
  private mappings: Record<string, GuidelineMapping>;
  private guidelines: Record<string, string>;

  constructor() {
    this.mappings = EMBEDDED_DATA.mappings;
    this.guidelines = EMBEDDED_DATA.guidelines;
  }

  getGuidelinesForProfile(
    _assistant: AIAssistant,
    language: Language,
    level: InstructionLevel,
    architecture: ArchitectureType
  ): string[] {
    const matchingGuidelines: string[] = [];

    for (const [guidelineId, mapping] of Object.entries(this.mappings)) {
      if (mapping.languages && !mapping.languages.includes(language)) {
        continue;
      }

      if (mapping.levels && !mapping.levels.includes(level)) {
        continue;
      }

      if (mapping.architectures && !mapping.architectures.includes(architecture)) {
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

  assembleProfile(
    assistant: AIAssistant,
    language: Language,
    level: InstructionLevel,
    architecture: ArchitectureType
  ): string {
    const guidelineIds = this.getGuidelinesForProfile(assistant, language, level, architecture);

    if (guidelineIds.length === 0) {
      throw new Error(`No guidelines found for profile: ${assistant}-${language}-${level}-${architecture}`);
    }

    const guidelineContents = guidelineIds.map(id => this.loadGuideline(id));
    return guidelineContents.join('\n\n---\n\n');
  }

  getStats(): {
    totalGuidelines: number;
    byLanguage: Record<string, number>;
    byLevel: Record<string, number>;
    byArchitecture: Record<string, number>;
    byTag: Record<string, number>;
  } {
    const stats = {
      totalGuidelines: Object.keys(this.mappings).length,
      byLanguage: {} as Record<string, number>,
      byLevel: {} as Record<string, number>,
      byArchitecture: {} as Record<string, number>,
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

      if (mapping.tags) {
        for (const tag of mapping.tags) {
          stats.byTag[tag] = (stats.byTag[tag] || 0) + 1;
        }
      }
    }

    return stats;
  }
}
