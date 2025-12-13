import { select, input, checkbox, confirm, editor } from '@inquirer/prompts';
import chalk from 'chalk';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { mkdir, writeFile, readFile, access } from 'fs/promises';
import YAML from 'yaml';
import { GuidelineLoader, GuidelineMapping } from '../services/guideline-loader.js';
import { showBanner } from '../utils/banner.js';
import { createSummaryBox } from '../utils/formatting.js';
import { Language } from '../models/project.js';
import { InstructionLevel, ArchitectureType } from '../models/profile.js';
import { CONFIG } from '../config.js';


const LANGUAGES: { value: Language; name: string }[] = [
  { value: 'typescript', name: 'TypeScript' },
  { value: 'javascript', name: 'JavaScript' },
  { value: 'python', name: 'Python' },
  { value: 'go', name: 'Go' },
  { value: 'rust', name: 'Rust' },
  { value: 'java', name: 'Java' },
  { value: 'csharp', name: 'C#' },
  { value: 'ruby', name: 'Ruby' }
];

const LEVELS: { value: InstructionLevel; name: string }[] = [
  { value: 'basic', name: 'Basic' },
  { value: 'standard', name: 'Standard' },
  { value: 'expert', name: 'Expert' },
  { value: 'full', name: 'Full' }
];

const ARCHITECTURES: { value: ArchitectureType; name: string }[] = [
  { value: 'layered', name: 'Layered' },
  { value: 'modular-monolith', name: 'Modular Monolith' },
  { value: 'microservices', name: 'Microservices' },
  { value: 'event-driven', name: 'Event-Driven' },
  { value: 'hexagonal', name: 'Hexagonal' },
  { value: 'clean-architecture', name: 'Clean Architecture' },
  { value: 'ddd', name: 'Domain-Driven Design' },
  { value: 'serverless', name: 'Serverless' },
  { value: 'other', name: 'Other / None' }
];

export async function addGuidelineCommand() {
  showBanner();

  console.log(chalk.cyan('\n📝 Add Custom Guideline\n'));

  try {
    // 1. Load existing guidelines to show categories
    const loader = await GuidelineLoader.create();
    const stats = loader.getStats();
    const existingCategories = Object.keys(stats.byCategory).sort();

    // 2. Select or create category
    const categoryChoice = await select({
      message: 'Select category:',
      choices: [
        { value: '__new__', name: chalk.green('+ Create new category') },
        { value: '__separator__', name: chalk.gray('─'.repeat(50)), disabled: true },
        ...existingCategories.map(c => ({ value: c, name: c })),
        { value: 'cancel', name: 'Cancel', description: 'Exit' }
      ]
    });

    if (categoryChoice === 'cancel') {
      console.log(chalk.gray('\nCancelled.'));
      return;
    }

    let category: string;
    if (categoryChoice === '__new__') {
      category = await input({
        message: 'Category name:',
        validate: (value) => {
          if (!value.trim()) return 'Category name is required';
          if (value.length > 50) return 'Category name too long (max 50 characters)';
          return true;
        }
      });
    } else {
      category = categoryChoice;
    }

    // 3. Guideline details
    const name = await input({
      message: 'Guideline name:',
      validate: (value) => {
        if (!value.trim()) return 'Name is required';
        if (value.length > 100) return 'Name too long (max 100 characters)';
        return true;
      }
    });

    const description = await input({
      message: 'Short description (optional):',
      default: ''
    });

    // 4. Applicability - Languages
    const languageChoice = await select({
      message: 'Applicable to languages:',
      choices: [
        { value: 'all', name: 'All languages' },
        { value: 'specific', name: 'Specific languages only' }
      ]
    });

    let languages: Language[] = [];
    if (languageChoice === 'specific') {
      languages = await checkbox({
        message: 'Select languages:',
        choices: LANGUAGES.map(l => ({ value: l.value, name: l.name }))
      }) as Language[];

      if (languages.length === 0) {
        console.log(chalk.yellow('\n⚠️  No languages selected, applying to all languages'));
      }
    }

    // 5. Applicability - Levels
    const levels = await checkbox({
      message: 'Applicable to instruction levels:',
      choices: LEVELS.map(l => ({ value: l.value, name: l.name, checked: true }))
    }) as InstructionLevel[];

    if (levels.length === 0) {
      console.log(chalk.yellow('\n⚠️  No levels selected, using all levels'));
      levels.push('basic', 'standard', 'expert', 'full');
    }

    // 6. Applicability - Architectures
    const architectureChoice = await select({
      message: 'Applicable to architectures:',
      choices: [
        { value: 'all', name: 'All architectures' },
        { value: 'specific', name: 'Specific architectures only' }
      ]
    });

    let architectures: ArchitectureType[] = [];
    if (architectureChoice === 'specific') {
      architectures = await checkbox({
        message: 'Select architectures:',
        choices: ARCHITECTURES.map(a => ({ value: a.value, name: a.name }))
      }) as ArchitectureType[];

      if (architectures.length === 0) {
        console.log(chalk.yellow('\n⚠️  No architectures selected, applying to all'));
      }
    }

    // 7. Tags
    const tagsInput = await input({
      message: 'Tags (comma-separated, optional):',
      default: ''
    });

    const tags = tagsInput
      ? tagsInput.split(',').map(t => t.trim()).filter(t => t.length > 0)
      : [];

    // 8. Content
    console.log(chalk.cyan('\n📄 Guideline Content\n'));

    const contentChoice = await select({
      message: 'How to provide content?',
      choices: [
        { value: 'editor', name: 'Open in default editor (recommended)', description: 'Uses $EDITOR or default system editor' },
        { value: 'file', name: 'Import from file', description: 'Copy content from existing markdown file' },
        { value: 'inline', name: 'Type inline', description: 'For short content only' }
      ]
    });

    let content: string;
    switch (contentChoice) {
      case 'file': {
        const filePath = await input({
          message: 'File path:',
          validate: async (value) => {
            try {
              await access(value);
              return true;
            } catch {
              return 'File not found';
            }
          }
        });
        content = await readFile(filePath, 'utf-8');
        break;
      }

      case 'editor':
        content = await editor({
          message: 'Write your guideline (will open in editor):',
          default: `# ${name}\n\n${description ? description + '\n\n' : ''}## Overview\n\nWrite your guideline content here...\n\n## Examples\n\n\`\`\`\n// Code examples\n\`\`\`\n\n## Best Practices\n\n- Point 1\n- Point 2\n`
        });
        break;

      case 'inline':
        content = await editor({
          message: 'Content (markdown):',
          default: `# ${name}\n\n`
        });
        break;

      default:
        content = '';
    }

    if (!content.trim()) {
      console.log(chalk.red('\n❌ Content cannot be empty'));
      return;
    }

    // 9. Generate ID and paths
    const id = generateGuidelineId(category, name);
    const categorySlug = category.toLowerCase().replace(/\s+/g, '-');
    const nameSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const relativePath = `${categorySlug}/${nameSlug}.md`;

    // 10. Show preview
    console.log('\n' + createSummaryBox('📋 Guideline Preview', [
      { label: 'ID', value: id },
      { label: 'Category', value: category },
      { label: 'Name', value: name },
      { label: 'Path', value: relativePath },
      { label: 'Languages', value: languages.length > 0 ? languages.join(', ') : 'All' },
      { label: 'Levels', value: levels.join(', ') },
      { label: 'Architectures', value: architectures.length > 0 ? architectures.join(', ') : 'All' },
      { label: 'Tags', value: tags.length > 0 ? tags.join(', ') : 'None' },
      { label: 'Size', value: `${content.length} characters, ${content.split('\n').length} lines` }
    ]));

    const shouldAdd = await confirm({
      message: 'Add this guideline?',
      default: true
    });

    if (!shouldAdd) {
      console.log(chalk.gray('\nCancelled.'));
      return;
    }

    // 11. Write files
    const userDataPath = join(homedir(), CONFIG.CACHE_DIR_NAME, CONFIG.DATA_DIR);
    const guidelinePath = join(userDataPath, 'guidelines', relativePath);
    const mappingsPath = join(userDataPath, 'custom-mappings.yml');

    // Ensure directories exist
    await mkdir(dirname(guidelinePath), { recursive: true });

    // Write guideline content
    await writeFile(guidelinePath, content, 'utf-8');

    // Update mappings
    let mappings: Record<string, GuidelineMapping> = {};
    try {
      const mappingsContent = await readFile(mappingsPath, 'utf-8');
      mappings = YAML.parse(mappingsContent) as Record<string, GuidelineMapping>;
    } catch {
      // File doesn't exist yet, start with empty mappings
    }

    mappings[id] = {
      path: relativePath,
      category,
      ...(languages.length > 0 && { languages }),
      levels,
      ...(architectures.length > 0 && { architectures }),
      ...(tags.length > 0 && { tags })
    };

    await writeFile(mappingsPath, YAML.stringify(mappings), 'utf-8');

    console.log(chalk.green('\n✅ Guideline added successfully!'));
    console.log(chalk.gray(`\n   Guideline: ${guidelinePath}`));
    console.log(chalk.gray(`   Mapping: ${mappingsPath}`));
    console.log(chalk.cyan(`\n   Run ${chalk.white('aicgen init')} to use your custom guideline`));

  } catch (error) {
    if ((error as Error).message.includes('User force closed')) {
      console.log(chalk.gray('\n\nCancelled.'));
      return;
    }
    console.error(chalk.red(`\n❌ ${(error as Error).message}`));
    process.exit(1);
  }
}

function generateGuidelineId(category: string, name: string): string {
  const categorySlug = category.toLowerCase().replace(/\s+/g, '-');
  const nameSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `custom-${categorySlug}-${nameSlug}`;
}
