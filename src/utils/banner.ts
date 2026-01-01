import chalk from 'chalk';
import { CONFIG } from '../config';

// Color palette matching logo.svg
const colors = {
  cyan: chalk.hex('#06b6d4'),      // Neural nodes
  purple: chalk.hex('#8b5cf6'),    // Box and flow end
  green: chalk.hex('#10b981'),     // Success indicator
  gray: chalk.hex('#94a3b8'),      // Subtitle
  white: chalk.white.bold,         // Title
};

export function showBanner() {
  // ASCII art matching the new logo design with exact SVG colors
  const logo = `
      ${colors.cyan('(●)')}
         ${colors.cyan('╲')}
      ${colors.cyan('(●)')} ${colors.cyan('───')}${colors.purple('▶')}  ${colors.purple('╔═════════════════════════════╗')}
         ${colors.cyan('╱')}      ${colors.purple('║')}     ${colors.white('AI CONFIG GENERATOR')}     ${colors.purple('║')}
      ${colors.cyan('(●)')}       ${colors.purple('║')}      ${colors.gray('for better coding')}      ${colors.purple('║')}
                ${colors.purple('╚═════════════════════════════╝')}
  `;

  console.log(logo);
  console.log(colors.gray(`                      v${CONFIG.APP_VERSION} · MIT License\n`));
}

export function showInstructions() {
  console.log(chalk.gray('   Navigation:'));
  console.log(chalk.gray('   ↑↓ arrows    - Navigate options'));
  console.log(chalk.gray('   Space        - Select/deselect (checkboxes)'));
  console.log(chalk.gray('   Enter        - Confirm selection'));
  console.log(chalk.gray('   Ctrl+C       - Cancel anytime\n'));
}

export function showCheckboxInstructions() {
  console.log(chalk.gray('\n   💡 Tip: Uncheck a category to uncheck all items in that category'));
  console.log(chalk.gray('   Use Space to toggle, Enter to confirm\n'));
}

export function getLogoPrefix(animated: boolean = false): string {
  if (!animated) {
    return `${colors.cyan('(●)')} ${colors.cyan('─')}${colors.purple('▶')} ${colors.purple('▢')}`;
  }

  const frames = [
    `${colors.cyan('(●)')} ${colors.cyan('─')}${colors.purple('▶')}   ${colors.gray('▢')}`,
    `${colors.cyan('(●)')} ${colors.cyan('──')}${colors.purple('▶')}  ${colors.gray('▢')}`,
    `${colors.cyan('(●)')} ${colors.cyan('───')}${colors.purple('▶')} ${colors.gray('▢')}`,
    `${colors.cyan('(●)')} ${colors.cyan('───')}${colors.purple('▶')} ${colors.purple('▣')}`,
    `${colors.cyan('(●)')} ${colors.cyan('───')}${colors.purple('▶')} ${colors.green('✓')}`
  ];

  const index = Math.floor(Date.now() / 200) % frames.length;
  return frames[index];
}

export function showSmallLogo() {
  console.log(`
      ${colors.cyan('(●)')}
         ${colors.cyan('╲')}
      ${colors.cyan('(●)')} ${colors.cyan('─')}${colors.purple('▶')} ${colors.purple('╔═══════╗')}
         ${colors.cyan('╱')}   ${colors.purple('║')} ${colors.white('aicgen')} ${colors.purple('║')}
      ${colors.cyan('(●)')}    ${colors.purple('╚═══════╝')}
  `);
}
