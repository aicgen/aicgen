/**
 * Integration test for AI Analysis Service
 * Tests the full flow with real API
 */

import { AIAnalysisService } from './ai-analysis.service.js';
import { ProjectAnalyzer } from '../project-analyzer.js';

async function runIntegrationTest() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY not set');
    process.exit(1);
  }

  console.log('🧪 Starting AI Analysis Integration Test\n');

  // Analyze current project
  const projectPath = process.cwd();
  console.log('📂 Project:', projectPath);

  const analyzer = new ProjectAnalyzer(projectPath);
  const context = await analyzer.analyze();

  console.log('📊 Analysis Context:');
  console.log('  - Files:', context.metadata.files.length);
  console.log('  - Language:', context.metadata.language);
  console.log('  - Frameworks:', context.metadata.frameworksDetected?.join(', ') || 'none');
  console.log('  - Samples:', context.samples.length);

  // Test AI Analysis
  console.log('\n🤖 Testing Gemini Provider...');

  const aiService = new AIAnalysisService({
    timeoutMs: 30000,
    maxRetries: 3,
    initialRetryDelayMs: 1000
  });

  try {
    const result = await aiService.analyzeProject(context, 'gemini', apiKey);

    console.log('\n✅ AI Analysis SUCCESS!\n');
    console.log('📋 Results:');
    console.log('  Language:', result.language);
    console.log('  Project Type:', result.projectType);
    console.log('  Architecture:', result.architecture.pattern, `(${Math.round(result.architecture.confidence * 100)}% confidence)`);
    console.log('  Datasource:', result.datasource);
    console.log('  Level:', result.level);
    console.log('  Testing Maturity:', result.testingMaturity);
    console.log('  Reasoning:', result.reasoning);

    if (result.backendStyle) {
      console.log('  Backend Style:', result.backendStyle);
    }
    if (result.frontendStyle) {
      console.log('  Frontend Style:', result.frontendStyle);
    }

    console.log('\n✅ ALL TESTS PASSED');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ AI Analysis FAILED');
    console.error('Error:', error);
    process.exit(1);
  }
}

runIntegrationTest();
