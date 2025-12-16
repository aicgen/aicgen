#!/usr/bin/env bun

/**
 * Generate version.json with dynamic stats calculated from guideline-mappings.yml
 */

import { readFileSync, writeFileSync } from 'fs';
import { parse as parseYAML } from 'yaml';
import { join } from 'path';

interface GuidelineMapping {
  path: string;
  category?: string;
  languages?: string[];
  levels?: string[];
  architectures?: string[];
  datasources?: string[];
  tags?: string[];
}

interface GuidelineMappings {
  [key: string]: GuidelineMapping;
}

interface VersionData {
  version: string;
  lastUpdated: string;
  totalGuidelines: number;
  categories: Record<string, number>;
  languages: Record<string, number>;
  architectures: Record<string, number>;
  levels: Record<string, number>;
  datasources: Record<string, number>;
}

const DATA_DIR = join(__dirname, '../data');
const MAPPINGS_FILE = join(DATA_DIR, 'guideline-mappings.yml');
const VERSION_FILE = join(DATA_DIR, 'version.json');

function calculateStats(mappings: GuidelineMappings): Omit<VersionData, 'version' | 'lastUpdated'> {
  const categories: Record<string, number> = {};
  const languages: Record<string, number> = {};
  const architectures: Record<string, number> = {};
  const levels: Record<string, number> = {
    basic: 0,
    standard: 0,
    expert: 0,
    full: 0
  };
  const datasources: Record<string, number> = {};

  const guidelineIds = Object.keys(mappings);

  // Count by category
  for (const id of guidelineIds) {
    const mapping = mappings[id];

    if (mapping.category) {
      categories[mapping.category] = (categories[mapping.category] || 0) + 1;
    }
  }

  // Count by language (only language-specific guidelines)
  for (const id of guidelineIds) {
    const mapping = mappings[id];

    if (mapping.languages && mapping.languages.length > 0) {
      for (const lang of mapping.languages) {
        languages[lang] = (languages[lang] || 0) + 1;
      }
    }
  }

  // Count by architecture (only architecture-specific guidelines)
  for (const id of guidelineIds) {
    const mapping = mappings[id];

    if (mapping.architectures && mapping.architectures.length > 0) {
      for (const arch of mapping.architectures) {
        architectures[arch] = (architectures[arch] || 0) + 1;
      }
    }
  }

  // Count by level
  for (const id of guidelineIds) {
    const mapping = mappings[id];
    const mappingLevels = mapping.levels || ['basic', 'standard', 'expert', 'full'];

    for (const level of mappingLevels) {
      if (level in levels) {
        levels[level]++;
      }
    }
  }

  // Count by datasource (only datasource-specific guidelines)
  for (const id of guidelineIds) {
    const mapping = mappings[id];

    if (mapping.datasources && mapping.datasources.length > 0) {
      for (const ds of mapping.datasources) {
        datasources[ds] = (datasources[ds] || 0) + 1;
      }
    }
  }

  return {
    totalGuidelines: guidelineIds.length,
    categories,
    languages,
    architectures,
    levels,
    datasources
  };
}

function main() {
  console.log('📊 Generating version.json with dynamic stats...\n');

  // Read guideline mappings
  const mappingsContent = readFileSync(MAPPINGS_FILE, 'utf-8');
  const mappings = parseYAML(mappingsContent) as GuidelineMappings;

  // Calculate stats
  const stats = calculateStats(mappings);

  // Get today's date
  const today = new Date().toISOString().split('T')[0];

  // Create version data
  const versionData: VersionData = {
    version: '1.0.0',
    lastUpdated: today,
    ...stats
  };

  // Write to file
  writeFileSync(VERSION_FILE, JSON.stringify(versionData, null, 2) + '\n');

  console.log(`✅ Generated ${VERSION_FILE}`);
  console.log(`   Total guidelines: ${stats.totalGuidelines}`);
  console.log(`   Categories: ${Object.keys(stats.categories).length}`);
  console.log(`   Languages: ${Object.keys(stats.languages).length}`);
  console.log(`   Architectures: ${Object.keys(stats.architectures).length}`);
  console.log(`   Levels: basic(${stats.levels.basic}), standard(${stats.levels.standard}), expert(${stats.levels.expert}), full(${stats.levels.full})`);
  console.log(`   Datasources: ${Object.keys(stats.datasources).length}`);
}

main();
