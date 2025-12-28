/**
 * Analyze Command
 *
 * Run AI-powered codebase analysis
 */

import ora from 'ora';
import chalk from 'chalk';
import { createAIAnalyzer, isAIAnalysisAvailable, getConfiguredProviders } from '../services/ai-analysis-service.js';
import { createSummaryBox } from '../utils/formatting.js';

interface AnalyzeOptions {
  provider?: 'claude' | 'openai' | 'gemini';
  strategy?: 'minimal' | 'balanced' | 'comprehensive';
  noCache?: boolean;
  staticOnly?: boolean;
}

export async function analyzeCommand(options: AnalyzeOptions = {}) {
  console.log(chalk.bold.cyan('\n🔍 AI Codebase Analysis\n'));

  const projectPath = process.cwd();

  // Check if AI providers are configured
  if (!options.staticOnly && !isAIAnalysisAvailable()) {
    console.log(chalk.yellow('⚠️  No AI providers configured'));
    console.log(chalk.gray('\nTo enable AI analysis, set one of these environment variables:'));
    console.log(chalk.gray('  - ANTHROPIC_API_KEY (for Claude)'));
    console.log(chalk.gray('  - OPENAI_API_KEY (for OpenAI)'));
    console.log(chalk.gray('  - GEMINI_API_KEY (for Google Gemini)'));
    console.log(chalk.gray('\nRunning static analysis only...\n'));
    options.staticOnly = true;
  }

  // Show configured providers
  if (!options.staticOnly) {
    const providers = getConfiguredProviders();
    console.log(chalk.gray(`Configured providers: ${providers.join(', ')}\n`));
  }

  const analyzer = createAIAnalyzer();

  let spinner = ora('Analyzing project...').start();

  try {
    let result;

    if (options.staticOnly || !analyzer) {
      // Static analysis only
      spinner.text = 'Running static analysis...';
      result = await analyzer?.analyzeStatic(projectPath);
    } else {
      // Full AI analysis
      spinner.text = 'Running AI-powered analysis...';
      result = await analyzer.analyze(projectPath, {
        preferredProvider: options.provider,
        samplingStrategy: options.strategy || 'balanced',
        useCache: !options.noCache,
        includeTests: false,
      });
    }

    if (!result) {
      spinner.fail('Analysis failed');
      return;
    }

    spinner.succeed(`Analysis complete in ${result.executionTime}ms`);

    // Display results
    console.log('\n' + chalk.bold('📊 Analysis Results\n'));

    // Static Analysis Summary
    const staticSummary = [
      { label: 'Primary Language', value: result.staticAnalysis.languages.primary },
      { label: 'Total Files', value: result.staticAnalysis.structure.totalFiles.toString() },
      { label: 'Estimated LOC', value: result.staticAnalysis.structure.totalLines.toString() },
      { label: 'Confidence', value: `${(result.staticAnalysis.confidence * 100).toFixed(1)}%` },
    ];

    console.log(createSummaryBox('Static Analysis', staticSummary));

    // AI Analysis Results (if available)
    if (!options.staticOnly && result.architecture) {
      console.log('\n' + chalk.bold.green('🤖 AI Insights\n'));

      const aiSummary = [
        { label: 'Architecture', value: result.architecture.pattern },
        { label: 'Project Type', value: result.projectType },
        { label: 'Testing Maturity', value: result.testingMaturity },
        { label: 'Confidence', value: `${(result.architecture.confidence * 100).toFixed(1)}%` },
      ];

      console.log(createSummaryBox('AI Analysis', aiSummary));

      if (result.reasoning) {
        console.log('\n' + chalk.bold('💡 Reasoning\n'));
        console.log(chalk.gray(result.reasoning));
      }

      if (result.suggestedGuidelines?.length > 0) {
        console.log('\n' + chalk.bold('📋 Suggested Guidelines\n'));
        result.suggestedGuidelines.forEach(guideline => {
          console.log(chalk.gray(`  • ${guideline}`));
        });
      }
    }

    // Performance metrics
    console.log('\n' + chalk.bold('⚡ Performance\n'));
    const perfSummary = [
      { label: 'Execution Time', value: `${result.executionTime}ms` },
      { label: 'From Cache', value: result.fromCache ? 'Yes' : 'No' },
      { label: 'Provider', value: result.provider || 'static' },
    ];
    console.log(createSummaryBox('Metrics', perfSummary));

  } catch (error) {
    spinner.fail('Analysis failed');
    console.error(chalk.red('\nError:'), error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}
