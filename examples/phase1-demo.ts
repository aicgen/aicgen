import { ProjectScanner } from '../src/services/project-scanner.js';
import { ProfileRecommender } from '../src/services/recommender.js';
import { ProfileLoader } from '../src/services/profile-loader.js';
import type { ProfileSelection } from '../src/models/profile.js';

async function demonstratePhase1() {
  console.log('=== Phase 1: Foundation & Schema Demo ===\n');

  const projectPath = process.cwd();

  console.log('1. Scanning project...');
  const scanner = new ProjectScanner();
  const fingerprint = await scanner.scan(projectPath);

  console.log('\nProject Fingerprint:');
  console.log('  Name:', fingerprint.name);
  console.log('  Language:', fingerprint.language.primary);
  console.log('  Confidence:', fingerprint.language.confidence);
  console.log('  Framework:', fingerprint.framework?.name || 'None detected');
  console.log('  Database:', fingerprint.database?.type || 'None detected');
  console.log('  Package Manager:', fingerprint.packageManager);
  console.log('  File Count:', fingerprint.projectSize.fileCount);
  console.log('  Estimated Team Size:', fingerprint.projectSize.estimatedTeamSize);
  console.log('  Has Tests:', fingerprint.structure.hasTests);
  console.log('  Has CI:', fingerprint.structure.hasCI);
  console.log('  Has Docker:', fingerprint.structure.hasDocker);
  console.log('  Existing AI Assistant:', fingerprint.existingConfigs.aiAssistant || 'None');

  console.log('\n2. Getting recommendations...');
  const recommender = new ProfileRecommender();
  const recommendation = recommender.recommend(fingerprint);

  console.log('\nRecommendations:');
  console.log('  Instruction Level:', recommendation.instructionLevel);
  console.log('  Architecture:', recommendation.architecture);
  console.log('  Reasoning:', recommendation.reasoning);

  const instructionDesc = recommender.getInstructionLevelDescription(
    recommendation.instructionLevel
  );
  console.log('\nInstruction Level Details:');
  console.log('  Title:', instructionDesc.title);
  console.log('  Description:', instructionDesc.description);
  console.log('  Estimated Lines:', instructionDesc.estimatedLines);
  console.log('  Best For:', instructionDesc.bestFor);

  const archDesc = recommender.getArchitectureDescription(recommendation.architecture);
  console.log('\nArchitecture Details:');
  console.log('  Title:', archDesc.title);
  console.log('  Description:', archDesc.description);
  console.log('  Complexity:', archDesc.complexity);
  console.log('  Best For:', archDesc.bestFor);

  console.log('\n3. Profile selection...');
  const selection: ProfileSelection = {
    assistant: 'claude-code',
    language: fingerprint.language.primary,
    level: recommendation.instructionLevel,
    architecture: recommendation.architecture
  };

  console.log('\nSelected Profile:');
  console.log('  Assistant:', selection.assistant);
  console.log('  Language:', selection.language);
  console.log('  Level:', selection.level);
  console.log('  Architecture:', selection.architecture);

  console.log('\n4. Loading profile (this will fail until we create profile files)...');
  try {
    const loader = new ProfileLoader();
    const profile = await loader.load(selection);
    console.log('\nProfile loaded successfully!');
    console.log('  Profile Name:', profile.meta.name);
  } catch (error) {
    console.log('\n⚠️  Profile file not found (expected - we need Phase 2 for templates)');
    console.log('  Error:', (error as Error).message);
  }

  console.log('\n=== Phase 1 Complete ===');
  console.log('\nNext: Phase 2 will create the actual profile YAML files and templates.');
}

if (import.meta.main) {
  demonstratePhase1().catch(console.error);
}
