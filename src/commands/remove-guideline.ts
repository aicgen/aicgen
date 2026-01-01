import { select, checkbox, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { homedir } from 'os';
import { join } from 'path';
import { readFile, writeFile, rm } from 'fs/promises';
import { existsSync } from 'fs';
import YAML from 'yaml';
import { CONFIG } from '../config';
import { showBanner } from '../utils/banner';
import { addBackOption, BACK_VALUE } from '../utils/wizard-state';
import { GuidelineMapping } from '../services/guideline-loader';

export async function removeGuidelineCommand() {
  showBanner();
  console.log(chalk.cyan('🗑️  Remove Custom Guidelines\n'));

  const userDataPath = join(homedir(), CONFIG.CACHE_DIR_NAME, CONFIG.DATA_DIR);
  const mappingsPath = join(userDataPath, 'custom-mappings.yml');

  if (!existsSync(mappingsPath)) {
    console.log(chalk.gray('No custom guidelines found.'));
    console.log(chalk.gray('Use `aicgen add-guideline` to create custom guidelines.\n'));
    return;
  }

  // Load custom mappings
  const mappingsContent = await readFile(mappingsPath, 'utf-8');
  const mappings = YAML.parse(mappingsContent) as Record<string, GuidelineMapping>;

  const guidelineIds = Object.keys(mappings);

  if (guidelineIds.length === 0) {
    console.log(chalk.gray('No custom guidelines found.\n'));
    return;
  }

  console.log(chalk.cyan(`Found ${guidelineIds.length} custom guideline(s):\n`));

  let continueLoop = true;
  while (continueLoop) {
    // Ask user what to do
    const action = await select({
      message: 'What would you like to do?',
      choices: [
        { value: 'select', name: 'Select specific guidelines to remove', description: 'Choose which ones to delete' },
        { value: 'all', name: 'Remove ALL custom guidelines', description: 'Delete everything' },
        { value: 'cancel', name: 'Cancel', description: 'Exit without changes' }
      ]
    });

    if (action === 'cancel') {
      console.log(chalk.gray('\nCancelled.'));
      return;
    }

    let toRemove: string[] = [];

    if (action === 'all') {
      const confirmAll = await confirm({
        message: chalk.yellow(`Remove ALL ${guidelineIds.length} custom guidelines?`),
        default: false
      });

      if (!confirmAll) {
        continue;
      }

      toRemove = guidelineIds;
    } else {
      // Let user select which to remove
      const choices = addBackOption(guidelineIds.map(id => {
        const mapping = mappings[id];
        return {
          name: `${id} (${mapping.category || 'General'})`,
          value: id,
          checked: false
        };
      }), true);

      const selected = await checkbox({
        message: 'Select guidelines to remove (Space to toggle, Enter to confirm):',
        choices,
        loop: false
      }) as string[];

      // Check if Back was selected (it comes as a string in the array if selected, though checkbox UI usually handles it differently if we mix types, but here we treat it as value)
      // Actually checkbox returns array of values. If BACK_VALUE is in there, we should go back.
      if (selected.includes(BACK_VALUE)) {
        continue;
      }

      if (selected.length === 0) {
        console.log(chalk.gray('\nNo guidelines selected.'));
        continue;
      }

      toRemove = selected;
    }

    // Remove selected guidelines
    let removedCount = 0;
    const errors: string[] = [];

    for (const id of toRemove) {
      try {
        const mapping = mappings[id];

        // Delete the guideline file
        const guidelinePath = join(userDataPath, 'guidelines', mapping.path);
        if (existsSync(guidelinePath)) {
          await rm(guidelinePath);
        }

        // Remove from mappings
        delete mappings[id];
        removedCount++;

        console.log(chalk.green(`✓ Removed: ${id}`));
      } catch (error) {
        errors.push(`Failed to remove ${id}: ${error}`);
        console.log(chalk.red(`✗ Failed: ${id}`));
      }
    }

    // Update mappings file
    if (removedCount > 0) {
      if (Object.keys(mappings).length === 0) {
        // No guidelines left, remove the file
        await rm(mappingsPath);
        console.log(chalk.gray('\n  (No custom guidelines remaining, removed mappings file)'));
        return; // Exit as nothing left
      } else {
        // Update mappings file
        await writeFile(mappingsPath, YAML.stringify(mappings), 'utf-8');
      }
    }

    // Summary
    console.log(chalk.green(`\n✅ Removed ${removedCount} custom guideline(s)`));

    if (errors.length > 0) {
      console.log(chalk.red(`\n❌ Errors:`));
      errors.forEach(err => console.log(chalk.red(`   ${err}`)));
    }

    // Refresh list for next loop iteration
    const remainingIds = Object.keys(mappings);
    if (remainingIds.length === 0) {
      continueLoop = false;
    }
  }
}
