jest.mock('../../config.js');
import { CONFIG } from '../../config.js';

describe('Tarball Extraction Configuration', () => {
  describe('CONFIG-based Prefix', () => {
    it('should have correct GitHub owner configured', () => {
      expect(CONFIG.GITHUB_REPO_OWNER).toBe('aicgen');
    });

    it('should have correct GitHub repo configured', () => {
      expect(CONFIG.GITHUB_REPO_NAME).toBe('aicgen-data');
    });

    it('should construct correct expected prefix', () => {
      const expectedPrefix = `${CONFIG.GITHUB_REPO_OWNER}-${CONFIG.GITHUB_REPO_NAME}-`;
      expect(expectedPrefix).toBe('aicgen-aicgen-data-');
    });

    it('should not use hardcoded lpsandaruwan prefix', () => {
      const expectedPrefix = `${CONFIG.GITHUB_REPO_OWNER}-${CONFIG.GITHUB_REPO_NAME}-`;
      expect(expectedPrefix).not.toBe('lpsandaruwan-aicgen-docs-');
    });
  });

  describe('Directory Name Matching', () => {
    it('should match correct tarball directory format', () => {
      const expectedPrefix = `${CONFIG.GITHUB_REPO_OWNER}-${CONFIG.GITHUB_REPO_NAME}-`;
      const sampleDirectories = [
        'aicgen-aicgen-data-abc123',
        'aicgen-aicgen-data-def456',
        'aicgen-aicgen-data-1234567890abcdef'
      ];

      sampleDirectories.forEach(dir => {
        expect(dir.startsWith(expectedPrefix)).toBe(true);
      });
    });

    it('should not match incorrect directory formats', () => {
      const expectedPrefix = `${CONFIG.GITHUB_REPO_OWNER}-${CONFIG.GITHUB_REPO_NAME}-`;
      const incorrectDirectories = [
        'lpsandaruwan-aicgen-docs-abc123',
        'other-repo-abc123',
        'random-directory'
      ];

      incorrectDirectories.forEach(dir => {
        expect(dir.startsWith(expectedPrefix)).toBe(false);
      });
    });

    it('should find correct directory in mixed entries', () => {
      const expectedPrefix = `${CONFIG.GITHUB_REPO_OWNER}-${CONFIG.GITHUB_REPO_NAME}-`;
      const entries = [
        'archive.tar.gz',
        'aicgen-aicgen-data-abc123',
        'other-file.md',
        '.temp'
      ];

      const rootDir = entries.find(entry => entry.startsWith(expectedPrefix));
      expect(rootDir).toBe('aicgen-aicgen-data-abc123');
    });
  });

  describe('GitHub API URLs', () => {
    it('should construct correct releases URL', () => {
      const repoUrl = `${CONFIG.GITHUB_API_BASE}/repos/${CONFIG.GITHUB_REPO_OWNER}/${CONFIG.GITHUB_REPO_NAME}`;
      expect(repoUrl).toBe('https://api.github.com/repos/aicgen/aicgen-data');
    });

    it('should construct correct releases latest URL', () => {
      const releasesUrl = `${CONFIG.GITHUB_API_BASE}/repos/${CONFIG.GITHUB_REPO_OWNER}/${CONFIG.GITHUB_REPO_NAME}/releases/latest`;
      expect(releasesUrl).toBe('https://api.github.com/repos/aicgen/aicgen-data/releases/latest');
    });
  });

  describe('Cache Directory Structure', () => {
    it('should have correct cache directory name', () => {
      expect(CONFIG.CACHE_DIR_NAME).toBe('.aicgen');
    });

    it('should have correct data directory name', () => {
      expect(CONFIG.DATA_DIR).toBe('data');
    });

    it('should have correct cache subdirectory', () => {
      expect(CONFIG.CACHE_DIR).toBe('cache/official');
    });
  });

  describe('Version Management', () => {
    it('should have valid version format', () => {
      const version = CONFIG.APP_VERSION;
      // Valid version: X.Y.Z-prerelease or X.Y-prerelease (e.g., "1.0.0-beta.1" or "1.0-beta")
      const versionPattern = /^\d+\.\d+(\.\d+)?(-[a-z0-9.]+)?$/i;
      expect(versionPattern.test(version)).toBe(true);
    });

    it('should not have invalid version patterns', () => {
      const version = CONFIG.APP_VERSION;
      // Should not match invalid patterns like "0.1.0b1" or "0.1b"
      expect(version).not.toMatch(/\d+\.\d+\.\d+b\d*/);
      expect(version).not.toMatch(/\d+b$/);
    });
  });

  describe('Environment Variable Override', () => {
    it('should allow GitHub owner override via env', () => {
      // This tests that the priority system exists (ENV > Config > Default)
      // Actual override would need to be tested in integration tests
      const hasEnvSupport = CONFIG.GITHUB_REPO_OWNER === (
        process.env.AICGEN_GITHUB_OWNER || 'aicgen'
      );
      expect(hasEnvSupport).toBe(true);
    });

    it('should allow GitHub repo override via env', () => {
      const hasEnvSupport = CONFIG.GITHUB_REPO_NAME === (
        process.env.AICGEN_GITHUB_REPO || 'aicgen-data'
      );
      expect(hasEnvSupport).toBe(true);
    });
  });
});
