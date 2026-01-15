/**
 * Manual test to verify Gemini provider configuration
 * Run with: bun run src/services/ai-analysis/providers/__test-manual__.ts
 */

import { GeminiProvider } from './gemini.provider.js';
import { AnalysisContext } from '../../project-analyzer.js';

async function testGeminiProvider() {
  const apiKey = process.env.GEMINI_API_KEY || 'test-key';

  if (apiKey === 'test-key') {
    console.error('Please set GEMINI_API_KEY environment variable');
    process.exit(1);
  }

  const provider = new GeminiProvider(apiKey);

  const mockContext: AnalysisContext = {
    metadata: {
      files: ['test.ts'],
      packages: [],
      frameworksDetected: [],
      databases: []
    },
    samples: [
      {
        path: 'test.ts',
        content: 'console.log("Hello");'
      }
    ]
  };

  const prompt = `You are a codebase analyzer.
Return ONLY valid JSON matching this schema:
{
  "language": "typescript",
  "projectType": "web-app",
  "architecture": {
    "pattern": "layered",
    "confidence": 0.9
  },
  "datasource": "postgresql",
  "level": "standard",
  "testingMaturity": "medium",
  "reasoning": "test"
}`;

  try {
    console.log('Testing Gemini provider...');
    console.log('Model:', provider['modelConfig'].model);
    console.log('Timeout:', provider['modelConfig'].timeout);
    console.log('MaxTokens:', provider['modelConfig'].maxTokens);

    const response = await provider.analyze(mockContext, prompt);
    console.log('\n=== RAW RESPONSE ===');
    console.log(response);
    console.log('\n=== PARSED JSON ===');

    try {
      const parsed = JSON.parse(response);
      console.log(JSON.stringify(parsed, null, 2));

      // Check if all required fields are present
      const requiredFields = ['language', 'projectType', 'architecture', 'datasource', 'level', 'testingMaturity'];
      const missingFields = requiredFields.filter(field => !(field in parsed));

      if (missingFields.length > 0) {
        console.error('\n❌ Missing required fields:', missingFields);
      } else {
        console.log('\n✅ All required fields present');
      }
    } catch (parseError) {
      console.error('\n❌ Failed to parse JSON:', parseError);
    }
  } catch (error) {
    console.error('\n❌ Error:', error);
  }
}

testGeminiProvider();
