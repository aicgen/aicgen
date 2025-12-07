import { ConfigGenerator } from '../src/services/config-generator.js';
import type { ProfileSelection } from '../src/models/profile.js';

async function demonstratePhase2() {
  console.log('=== Phase 2: Template System & Generation Demo ===\n');

  const generator = new ConfigGenerator();
  const projectPath = process.cwd();

  console.log('Step 1: Getting recommendations...\n');
  const { fingerprint, recommendation, instructionLevelDesc, archDesc } =
    await generator.getRecommendations(projectPath);

  console.log('Project Analysis:');
  console.log(`  Name: ${fingerprint.name}`);
  console.log(`  Language: ${fingerprint.language.primary}`);
  console.log(`  Framework: ${fingerprint.framework?.name || 'None'}`);
  console.log(`  Team Size: ~${fingerprint.projectSize.estimatedTeamSize} developers`);
  console.log(`  File Count: ${fingerprint.projectSize.fileCount}`);

  console.log('\nRecommended Configuration:');
  console.log(`  Instruction Level: ${recommendation.instructionLevel}`);
  console.log(`  - ${instructionLevelDesc.description}`);
  console.log(`  - Best for: ${instructionLevelDesc.bestFor}`);
  console.log(`  Architecture: ${recommendation.architecture}`);
  console.log(`  - ${archDesc.description}`);
  console.log(`  - Complexity: ${archDesc.complexity}`);

  console.log('\nStep 2: Generating configuration files...\n');

  const selection: ProfileSelection = {
    assistant: 'claude-code',
    language: fingerprint.language.primary,
    level: recommendation.instructionLevel,
    architecture: recommendation.architecture
  };

  console.log('Selected Profile:');
  console.log(`  ${selection.assistant} + ${selection.language} + ${selection.level} + ${selection.architecture}`);

  console.log('\nGenerating (dry run)...\n');
  const dryResult = await generator.generate({
    projectPath,
    selection,
    dryRun: true
  });

  if (dryResult.success) {
    console.log('✅ Dry run successful!');
    console.log('\nFiles that would be generated:');
    dryResult.filesGenerated.forEach(file => {
      console.log(`  ✓ ${file}`);
    });

    console.log('\n📝 To actually generate files, run:');
    console.log('   bun run examples/generate.ts');
  } else {
    console.error('\n❌ Generation failed:');
    dryResult.errors.forEach(err => console.error(`  - ${err}`));
  }

  console.log('\n=== Phase 2 Complete ===');
  console.log('\nNext: Phase 3 will add the interactive CLI wizard with Inquirer.js');
}

if (import.meta.main) {
  demonstratePhase2().catch(error => {
    console.error('Error:', error.message);
    process.exit(1);
  });
}
