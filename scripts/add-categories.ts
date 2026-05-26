#!/usr/bin/env node
/**
 * Add category metadata to guideline-mappings.yml based on directory structure
 */

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import YAML from 'yaml';

interface GuidelineMapping {
  path: string;
  category?: string;
  languages?: string[];
  levels?: string[];
  architectures?: string[];
  tags?: string[];
}

const categoryMap: Record<string, string> = {
  'language': 'Language',
  'architecture': 'Architecture',
  'testing': 'Testing',
  'security': 'Security',
  'performance': 'Performance',
  'api': 'API Design',
  'database': 'Database',
  'devops': 'DevOps',
  'error-handling': 'Error Handling',
  'patterns': 'Design Patterns',
  'practices': 'Best Practices',
  'style': 'Code Style'
};

function getCategoryFromPath(path: string): string {
  const firstDir = path.split('/')[0];
  return categoryMap[firstDir] || 'General';
}

async function addCategories() {
  console.log('📝 Adding categories to guideline-mappings.yml...\n');

  const dataDir = process.env.AICGEN_DATA_DIR || join(process.cwd(), 'data');
  const mappingsPath = join(dataDir, 'guideline-mappings.yml');

  const content = await readFile(mappingsPath, 'utf-8');
  const mappings = YAML.parse(content) as Record<string, GuidelineMapping>;

  let updated = 0;

  for (const [id, mapping] of Object.entries(mappings)) {
    if (!mapping.category) {
      mapping.category = getCategoryFromPath(mapping.path);
      updated++;
    }
  }

  const output = YAML.stringify(mappings, {
    lineWidth: 0,
    defaultStringType: 'PLAIN'
  });

  const header = `# Guideline Mappings
# Defines which guidelines apply to which profiles
#
# Format:
# guideline-id:
#   path: relative/path/to/guideline.md
#   category: Guideline category for organization
#   languages: [list of applicable languages] (optional, if omitted applies to all)
#   levels: [list of applicable levels] (optional, if omitted applies to all)
#   architectures: [list of applicable architectures] (optional, if omitted applies to all)
#   tags: [list of tags for organization]

`;

  await writeFile(mappingsPath, header + output, 'utf-8');

  console.log(`✅ Updated ${updated} mappings with categories`);
  console.log(`📂 Categories found:`);

  const categories = new Set(Object.values(mappings).map(m => m.category));
  categories.forEach(cat => console.log(`   - ${cat}`));
}

addCategories().catch(err => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
