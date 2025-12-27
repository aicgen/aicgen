/**
 * Tests for static analyzer orchestrator
 */

import { describe, it, expect } from 'bun:test';
import { runStaticAnalysis } from '../../../../services/ai-analysis/tier1-static/static-analyzer.js';

describe('runStaticAnalysis', () => {
  it('should analyze this TypeScript project', async () => {
    const result = await runStaticAnalysis(process.cwd());

    // This is a TypeScript project
    expect(result.languages.primary).toBe('typescript');
    expect(result.languages.all.length).toBeGreaterThan(0);
    expect(result.languages.confidence).toBeGreaterThan(0);

    // Should have dependencies
    expect(result.dependencies.packageManager).toBeDefined();
    expect(Object.keys(result.dependencies.dependencies).length).toBeGreaterThan(0);

    // Should have structure
    expect(result.structure.totalFiles).toBeGreaterThan(0);
    expect(result.structure.totalLines).toBeGreaterThan(0);

    // Should have confidence score
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);

    // Should have execution time
    expect(result.executionTime).toBeGreaterThan(0);
  });

  it('should detect package.json dependencies', async () => {
    const result = await runStaticAnalysis(process.cwd());

    expect(result.dependencies.packageManager).toBeDefined();
    expect(['npm', 'yarn', 'pnpm', 'bun']).toContain(result.dependencies.packageManager);
    expect(result.dependencies.lockfilePresent).toBe(true);
    expect(result.dependencies.manifestPath).toContain('package.json');
  });

  it('should detect TypeScript configuration', async () => {
    const result = await runStaticAnalysis(process.cwd());

    expect(result.configs.hasTypeScript).toBe(true);
    const tsConfig = result.configs.configs.find(c => c.category === 'typescript');
    expect(tsConfig).toBeDefined();
    expect(tsConfig?.files).toContain('tsconfig.json');
  });

  it('should detect common directory patterns', async () => {
    const result = await runStaticAnalysis(process.cwd());

    expect(result.structure.patterns).toBeDefined();
    expect(result.structure.patterns.hasSrcDir).toBe(true);
  });

  it('should complete in under 1 second (performance target)', async () => {
    const start = Date.now();
    const result = await runStaticAnalysis(process.cwd());
    const elapsed = Date.now() - start;

    expect(result.executionTime).toBeLessThan(1000);
    expect(elapsed).toBeLessThan(1000);

    console.log(`Static analysis completed in ${result.executionTime}ms`);
  });

  it('should calculate accurate confidence scores', async () => {
    const result = await runStaticAnalysis(process.cwd());

    // Confidence should be high for this well-structured project
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('should detect all 7 analysis components', async () => {
    const result = await runStaticAnalysis(process.cwd());

    // All 7 components should be present
    expect(result.languages).toBeDefined();
    expect(result.dependencies).toBeDefined();
    expect(result.structure).toBeDefined();
    expect(result.frameworks).toBeDefined();
    expect(result.buildTools).toBeDefined();
    expect(result.monorepo).toBeDefined();
    expect(result.configs).toBeDefined();
  });

  it('should detect frameworks if present', async () => {
    const result = await runStaticAnalysis(process.cwd());

    expect(result.frameworks).toBeDefined();
    // Framework result has optional fields: frontend, backend, testing, etc.
  });

  it('should detect build tools', async () => {
    const result = await runStaticAnalysis(process.cwd());

    expect(result.buildTools).toBeDefined();
    // Build tools may have bundler, monorepoTool, taskRunner, containerization, or ci
  });

  it('should handle monorepo detection', async () => {
    const result = await runStaticAnalysis(process.cwd());

    expect(result.monorepo).toBeDefined();
    expect(result.monorepo.isMonorepo).toBeDefined();
  });
});
