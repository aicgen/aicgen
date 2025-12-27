/**
 * Tests for fingerprint generation
 */

import { describe, it, expect } from 'bun:test';
import { generateFingerprint } from '../../../../services/ai-analysis/tier0-fingerprint/fingerprint-generator.js';

describe('generateFingerprint', () => {
  it('should generate fingerprint for this project (git repository)', async () => {
    const result = await generateFingerprint(process.cwd());

    expect(result.valid).toBe(true);
    expect(result.hash).toBeDefined();
    expect(result.hash.length).toBeGreaterThan(0);
    expect(result.components.git).toBeDefined(); // This is a git repo
    expect(result.components.structure).toBeDefined();
    expect(result.components.dependencies).toBeDefined();
    expect(result.components.configs).toBeDefined();
    expect(result.timestamp).toBeGreaterThan(0);
  });

  it('should generate consistent hash for unchanged repo', async () => {
    const result1 = await generateFingerprint(process.cwd());
    const result2 = await generateFingerprint(process.cwd());

    expect(result1.hash).toBe(result2.hash);
    expect(result1.components.git).toBe(result2.components.git);
    expect(result1.components.structure).toBe(result2.components.structure);
    expect(result1.components.dependencies).toBe(result2.components.dependencies);
    expect(result1.components.configs).toBe(result2.components.configs);
  });

  it('should handle invalid project path', async () => {
    const result = await generateFingerprint('/invalid/path/that/does/not/exist');

    expect(result.valid).toBe(false);
    expect(result.invalidReason).toContain('does not exist');
  });

  it('should detect git repository', async () => {
    const result = await generateFingerprint(process.cwd());

    // This is a git repo
    expect(result.components.git).toBeDefined();
    expect(result.components.git?.length).toBe(40); // Git SHA-1 hash is 40 characters
  });

  it('should hash dependencies (package.json)', async () => {
    const result = await generateFingerprint(process.cwd());

    // This project has package.json
    expect(result.components.dependencies).toBeDefined();
    expect(result.components.dependencies.length).toBeGreaterThan(0);
  });

  it('should hash config files', async () => {
    const result = await generateFingerprint(process.cwd());

    // This project has package.json, tsconfig.json, etc.
    expect(result.components.configs).toBeDefined();
    expect(result.components.configs.length).toBeGreaterThan(0);
  });

  it('should include timestamp', async () => {
    const before = Date.now();
    const result = await generateFingerprint(process.cwd());
    const after = Date.now();

    expect(result.timestamp).toBeGreaterThanOrEqual(before);
    expect(result.timestamp).toBeLessThanOrEqual(after);
  });

  it('should complete fingerprint generation in under 500ms (performance target)', async () => {
    const start = Date.now();
    const result = await generateFingerprint(process.cwd());
    const elapsed = Date.now() - start;

    expect(result.valid).toBe(true);
    expect(elapsed).toBeLessThan(500); // Performance target: < 500ms

    console.log(`Fingerprint generation took ${elapsed}ms`);
  });
});
