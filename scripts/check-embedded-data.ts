#!/usr/bin/env bun
import { readFile } from 'fs/promises';
import { join } from 'path';
import { buildEmbeddedDataOutput, getDataDir } from './embed-data.ts';

async function main() {
  const dataDir = getDataDir();
  const embeddedPath = join(process.cwd(), 'src', 'embedded-data.ts');
  const current = await readFile(embeddedPath, 'utf-8');
  const { output, mappingCount, guidelineCount } = await buildEmbeddedDataOutput(dataDir);

  if (current !== output) {
    throw new Error(
      [
        'src/embedded-data.ts is stale.',
        `Data source: ${dataDir}`,
        `Expected ${mappingCount} mappings and ${guidelineCount} markdown files.`,
        'Run: bun run embed',
      ].join('\n')
    );
  }

  console.log(`✓ Embedded data is current (${mappingCount} mappings, ${guidelineCount} markdown files)`);
}

main().catch(err => {
  console.error('❌ Embedded data check failed:', err);
  process.exit(1);
});
