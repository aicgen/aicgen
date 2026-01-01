import { checkbox } from '@inquirer/prompts';
import chalk from 'chalk';
import { Language } from '../models/project';
import { InstructionLevel, ArchitectureType, DatasourceType } from '../models/profile';
import { GuidelineLoader } from '../services/guideline-loader';
import { showCheckboxInstructions } from '../utils/banner';
import { BACK_VALUE } from '../utils/wizard-state';

interface CheckboxChoice {
  name: string;
  value: string;
  checked?: boolean;
  disabled?: boolean | string;
}

export async function selectGuidelines(
  language: Language,
  level: InstructionLevel,
  architecture: ArchitectureType,
  canGoBack: boolean,
  datasource?: DatasourceType
): Promise<string[] | typeof BACK_VALUE> {
  const loader = await GuidelineLoader.create();
  const categoryTree = loader.getCategoryTree(language, level, architecture, datasource);

  console.log(chalk.cyan('\n📚 Select Guidelines'));
  showCheckboxInstructions();

  const allGuidelineIds: string[] = [];
  const categoryToGuidelines = new Map<string, string[]>();
  const choices: CheckboxChoice[] = [];

  // Add back option if applicable
  if (canGoBack) {
    choices.push({
      name: chalk.gray('← Back to previous step'),
      value: BACK_VALUE,
      checked: false
    });
    choices.push({
      name: chalk.gray('─'.repeat(50)),
      value: '__SEPARATOR__',
      disabled: true
    });
  }

  // Build choices with categories and guidelines
  for (const category of categoryTree) {
    const categoryKey = `category:${category.name}`;
    const guidelineIds: string[] = [];

    // Category header
    choices.push({
      name: chalk.bold.cyan(`${category.name} (${category.count} guidelines)`),
      value: categoryKey,
      checked: true
    });

    // Guidelines under category
    for (const guideline of category.guidelines) {
      allGuidelineIds.push(guideline.id);
      guidelineIds.push(guideline.id);
      choices.push({
        name: `   ${guideline.name}`,
        value: guideline.id,
        checked: true
      });
    }

    categoryToGuidelines.set(categoryKey, guidelineIds);
  }

  let selected = await checkbox({
    message: 'Select guidelines to include (Space to toggle, Enter to confirm):',
    choices,
    pageSize: 25,
    loop: false
  }) as string[];

  // Handle back selection
  if (selected.includes(BACK_VALUE)) {
    return BACK_VALUE;
  }

  // Filter out separator
  selected = selected.filter(s => s !== '__SEPARATOR__');

  // Smart category-child sync
  const categories = Array.from(categoryToGuidelines.keys());
  const selectedCategories = selected.filter(s => s.startsWith('category:'));
  const selectedGuidelines = selected.filter(s => !s.startsWith('category:'));

  const finalGuidelines = new Set<string>();

  for (const category of categories) {
    const guidelinesInCategory = categoryToGuidelines.get(category) || [];
    const isCategorySelected = selectedCategories.includes(category);

    if (isCategorySelected) {
      // Category is checked → include ALL guidelines in that category
      guidelinesInCategory.forEach(g => finalGuidelines.add(g));
    } else {
      // Category is NOT checked → include only individually selected guidelines
      guidelinesInCategory.forEach(g => {
        if (selectedGuidelines.includes(g)) {
          finalGuidelines.add(g);
        }
      });
    }
  }

  const result = Array.from(finalGuidelines);

  if (result.length === 0) {
    console.log(chalk.yellow('\n⚠️  No guidelines selected. Using all available guidelines.'));
    return allGuidelineIds;
  }

  // Show selection summary
  console.log(chalk.cyan(`\n✓ Selected ${result.length} of ${allGuidelineIds.length} guidelines`));

  return result;
}
