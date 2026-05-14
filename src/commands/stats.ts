import chalk from 'chalk';
import { GuidelineLoader } from '../services/guideline-loader';
import { WorkflowInjector } from '../services/workflow-injector';

export async function statsCommand() {
  console.log(chalk.blue.bold('\n📊 aicgen Statistics\n'));

  const [loader, injector] = await Promise.all([
    GuidelineLoader.create(),
    WorkflowInjector.create(),
  ]);

  const stats = loader.getStats();
  const workflows = injector.getCommands();

  console.log(chalk.cyan('Total Guidelines:'), chalk.white(stats.totalGuidelines));
  console.log(chalk.cyan('SDLC Workflows:  '), chalk.white(workflows.length));
  workflows.forEach(w => {
    console.log(`   ${chalk.gray(('/' + w.name).padEnd(12))} ${chalk.dim(w.description)}`);
  });

  console.log(chalk.cyan('\n📋 By Language:'));
  Object.entries(stats.byLanguage)
    .sort((a, b) => b[1] - a[1])
    .forEach(([lang, count]) => {
      console.log(`   ${chalk.gray(lang.padEnd(15))} ${chalk.white(count)}`);
    });

  console.log(chalk.cyan('\n🎯 By Level:'));
  Object.entries(stats.byLevel)
    .sort((a, b) => b[1] - a[1])
    .forEach(([level, count]) => {
      console.log(`   ${chalk.gray(level.padEnd(15))} ${chalk.white(count)}`);
    });

  console.log(chalk.cyan('\n🏗️  By Architecture:'));
  Object.entries(stats.byArchitecture)
    .sort((a, b) => b[1] - a[1])
    .forEach(([arch, count]) => {
      console.log(`   ${chalk.gray(arch.padEnd(20))} ${chalk.white(count)}`);
    });

  console.log(chalk.cyan('\n📚 By Category:'));
  Object.entries(stats.byCategory)
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, count]) => {
      console.log(`   ${chalk.gray(category.padEnd(20))} ${chalk.white(count)}`);
    });

  console.log(chalk.cyan('\n🏷️  Top Tags:'));
  Object.entries(stats.byTag)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .forEach(([tag, count]) => {
      console.log(`   ${chalk.gray(tag.padEnd(25))} ${chalk.white(count)}`);
    });

  console.log();
}
