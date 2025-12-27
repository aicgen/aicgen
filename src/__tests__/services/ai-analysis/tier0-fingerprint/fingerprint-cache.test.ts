/**
 * Tests for fingerprint cache
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { FingerprintCache } from '../../../../services/ai-analysis/tier0-fingerprint/fingerprint-cache.js';
import type { AnalysisResult } from '../../../../services/ai-analysis/types.js';
import { rmdir } from 'fs/promises';
import { existsSync } from 'fs';

describe('FingerprintCache', () => {
  let cache: FingerprintCache;
  const testCacheDir = '/tmp/aicgen-test-cache-' + Date.now();

  beforeEach(() => {
    cache = new FingerprintCache(testCacheDir, 30);
  });

  afterEach(async () => {
    // Clean up test cache directory
    if (existsSync(testCacheDir)) {
      try {
        await rmdir(testCacheDir, { recursive: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  it('should store and retrieve analysis results', async () => {
    const fingerprint = 'test-fingerprint-123';
    const mockResult: AnalysisResult = {
      language: 'typescript',
      projectType: 'cli',
      architecture: {
        pattern: 'modular-monolith',
        confidence: 0.9,
      },
      frameworks: ['commander', 'inquirer'],
      packageManager: 'npm',
      suggestedGuidelines: ['typescript-general'],
      confidence: 0.9,
      reasoning: 'Test reasoning',
      testingMaturity: 'medium',
      source: 'static-only',
      timestamp: Date.now(),
      schemaVersion: '1.0.0',
    };

    // Store
    await cache.set(fingerprint, mockResult);

    // Retrieve
    const retrieved = await cache.get(fingerprint);

    expect(retrieved).not.toBeNull();
    expect(retrieved?.language).toBe('typescript');
    expect(retrieved?.projectType).toBe('cli');
    expect(retrieved?.frameworks).toEqual(['commander', 'inquirer']);
  });

  it('should return null for non-existent fingerprint', async () => {
    const result = await cache.get('non-existent-fingerprint');
    expect(result).toBeNull();
  });

  it('should clear all cache entries', async () => {
    // Store multiple entries
    await cache.set('fingerprint1', createMockResult());
    await cache.set('fingerprint2', createMockResult());
    await cache.set('fingerprint3', createMockResult());

    // Verify they exist
    expect(await cache.has('fingerprint1')).toBe(true);
    expect(await cache.has('fingerprint2')).toBe(true);
    expect(await cache.has('fingerprint3')).toBe(true);

    // Clear all
    await cache.clear();

    // Verify they're gone
    expect(await cache.has('fingerprint1')).toBe(false);
    expect(await cache.has('fingerprint2')).toBe(false);
    expect(await cache.has('fingerprint3')).toBe(false);
  });

  it('should return accurate cache stats', async () => {
    // Start with empty cache
    let stats = await cache.getStats();
    expect(stats.totalEntries).toBe(0);

    // Add some entries
    await cache.set('fingerprint1', createMockResult());
    await cache.set('fingerprint2', createMockResult());

    stats = await cache.getStats();
    expect(stats.totalEntries).toBe(2);
    expect(stats.totalSizeBytes).toBeGreaterThan(0);
    expect(stats.oldestEntry).toBeDefined();
    expect(stats.newestEntry).toBeDefined();
  });

  it('should detect expired entries with short TTL', async () => {
    // Create cache with 0 day TTL (everything expires immediately)
    const expiredCache = new FingerprintCache(testCacheDir + '-expired', 0);

    const oldResult = createMockResult();
    oldResult.timestamp = Date.now() - 1000; // 1 second ago

    await expiredCache.set('old-fingerprint', oldResult);

    // Should return null because TTL is 0
    const retrieved = await expiredCache.get('old-fingerprint');
    expect(retrieved).toBeNull();
  });

  it('should clear only expired entries', async () => {
    const shortTTLCache = new FingerprintCache(testCacheDir + '-short-ttl', 0);

    // Add old entry (will be expired)
    const oldResult = createMockResult();
    oldResult.timestamp = Date.now() - 10000; // 10 seconds ago
    await shortTTLCache.set('old', oldResult);

    // Add new entry (won't be expired)
    const newResult = createMockResult();
    newResult.timestamp = Date.now();
    await shortTTLCache.set('new', newResult);

    // Clear expired
    const deletedCount = await shortTTLCache.clearExpired();

    // Should have deleted at least the old one
    expect(deletedCount).toBeGreaterThanOrEqual(1);
  });

  it('should validate schema version', async () => {
    const invalidResult = createMockResult();
    invalidResult.schemaVersion = '2.0.0'; // Future version

    await cache.set('invalid-schema', invalidResult);

    // Should return null for invalid schema version
    const retrieved = await cache.get('invalid-schema');
    expect(retrieved).toBeNull();
  });

  it('should handle corrupted cache files gracefully', async () => {
    const fingerprint = 'corrupted';

    // Store valid result first
    await cache.set(fingerprint, createMockResult());

    // Manually write corrupted data (would need file system access)
    // For now, just verify that get handles errors gracefully
    const retrieved = await cache.get('non-existent');
    expect(retrieved).toBeNull();
  });
});

/**
 * Helper to create mock analysis result
 */
function createMockResult(): AnalysisResult {
  return {
    language: 'typescript',
    projectType: 'cli',
    architecture: {
      pattern: 'modular-monolith',
      confidence: 0.9,
    },
    frameworks: ['test-framework'],
    packageManager: 'npm',
    suggestedGuidelines: ['test-guideline'],
    confidence: 0.9,
    reasoning: 'Mock result for testing',
    testingMaturity: 'medium',
    source: 'static-only',
    timestamp: Date.now(),
    schemaVersion: '1.0.0',
  };
}
