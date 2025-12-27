/**
 * Fingerprint-based cache for analysis results
 *
 * Stores analysis results in ~/.aicgen/cache/analysis/
 * with TTL-based expiration
 */

import { mkdir, readFile, writeFile, readdir, unlink, stat } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { homedir } from 'os';
import type { AnalysisResult, CacheStats } from '../types.js';

/**
 * Cache for fingerprint-based analysis results
 */
export class FingerprintCache {
  private cacheDir: string;
  private ttlDays: number;

  constructor(cacheDir?: string, ttlDays: number = 30) {
    // Resolve ~ to home directory
    this.cacheDir = cacheDir
      ? cacheDir.replace(/^~/, homedir())
      : join(homedir(), '.aicgen', 'cache', 'analysis');
    this.ttlDays = ttlDays;
  }

  /**
   * Get cached analysis result by fingerprint
   */
  async get(fingerprint: string): Promise<AnalysisResult | null> {
    const cacheFilePath = this.getCacheFilePath(fingerprint);

    if (!existsSync(cacheFilePath)) {
      return null;
    }

    try {
      const content = await readFile(cacheFilePath, 'utf-8');
      const cached = JSON.parse(content) as AnalysisResult;

      // Check if cache is expired
      if (this.isExpired(cached.timestamp)) {
        // Delete expired entry
        await unlink(cacheFilePath);
        return null;
      }

      // Validate schema version
      if (!this.isValidSchemaVersion(cached.schemaVersion)) {
        // Delete invalid entry
        await unlink(cacheFilePath);
        return null;
      }

      return cached;
    } catch (error) {
      // Cache file is corrupted or invalid, delete it
      console.warn(`Warning: Invalid cache file ${cacheFilePath}:`, error);
      try {
        await unlink(cacheFilePath);
      } catch {
        // Ignore deletion errors
      }
      return null;
    }
  }

  /**
   * Store analysis result with fingerprint
   */
  async set(fingerprint: string, result: AnalysisResult): Promise<void> {
    // Ensure cache directory exists
    await this.ensureCacheDir();

    const cacheFilePath = this.getCacheFilePath(fingerprint);

    // Write JSON file
    await writeFile(cacheFilePath, JSON.stringify(result, null, 2), 'utf-8');
  }

  /**
   * Clear all cached entries
   */
  async clear(): Promise<void> {
    if (!existsSync(this.cacheDir)) {
      return;
    }

    const files = await readdir(this.cacheDir);

    for (const file of files) {
      if (file.endsWith('.json')) {
        await unlink(join(this.cacheDir, file));
      }
    }
  }

  /**
   * Clear expired entries
   */
  async clearExpired(): Promise<number> {
    if (!existsSync(this.cacheDir)) {
      return 0;
    }

    const files = await readdir(this.cacheDir);
    let deletedCount = 0;

    for (const file of files) {
      if (!file.endsWith('.json')) {
        continue;
      }

      const filePath = join(this.cacheDir, file);

      try {
        const content = await readFile(filePath, 'utf-8');
        const cached = JSON.parse(content) as AnalysisResult;

        if (this.isExpired(cached.timestamp)) {
          await unlink(filePath);
          deletedCount++;
        }
      } catch {
        // Invalid file, delete it
        await unlink(filePath);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    const stats: CacheStats = {
      totalEntries: 0,
      totalSizeBytes: 0,
      hits: 0, // Note: This would require persistent stats tracking
      misses: 0, // Note: This would require persistent stats tracking
    };

    if (!existsSync(this.cacheDir)) {
      return stats;
    }

    const files = await readdir(this.cacheDir);
    const timestamps: number[] = [];

    for (const file of files) {
      if (!file.endsWith('.json')) {
        continue;
      }

      const filePath = join(this.cacheDir, file);

      try {
        const fileStat = await stat(filePath);
        stats.totalEntries++;
        stats.totalSizeBytes += fileStat.size;

        // Read file to get timestamp
        const content = await readFile(filePath, 'utf-8');
        const cached = JSON.parse(content) as AnalysisResult;
        timestamps.push(cached.timestamp);
      } catch {
        // Ignore invalid files
      }
    }

    if (timestamps.length > 0) {
      timestamps.sort((a, b) => a - b);
      stats.oldestEntry = timestamps[0];
      stats.newestEntry = timestamps[timestamps.length - 1];
    }

    return stats;
  }

  /**
   * Check if entry exists and is valid
   */
  async has(fingerprint: string): Promise<boolean> {
    const result = await this.get(fingerprint);
    return result !== null;
  }

  /**
   * Get cache file path for fingerprint
   */
  private getCacheFilePath(fingerprint: string): string {
    return join(this.cacheDir, `${fingerprint}.json`);
  }

  /**
   * Ensure cache directory exists
   */
  private async ensureCacheDir(): Promise<void> {
    if (!existsSync(this.cacheDir)) {
      await mkdir(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Check if cache entry is expired
   */
  private isExpired(timestamp: number): boolean {
    const now = Date.now();
    const ttlMs = this.ttlDays * 24 * 60 * 60 * 1000;
    return now - timestamp > ttlMs;
  }

  /**
   * Check if schema version is valid
   */
  private isValidSchemaVersion(schemaVersion: string): boolean {
    // For now, accept version 1.x.x
    // TODO: Implement more sophisticated version checking if needed
    return schemaVersion.startsWith('1.');
  }
}
