import { DataPackageInstaller } from '../data-package-installer.js';

describe('DataPackageInstaller', () => {
  it('should reject unsafe archive paths', () => {
    const installer = new DataPackageInstaller();
    const isSafeArchivePath = (installer as any).isSafeArchivePath.bind(installer) as (path: string) => boolean;

    expect(isSafeArchivePath('aicgen-aicgen-data-123/guideline-mappings.yml')).toBe(true);
    expect(isSafeArchivePath('/absolute/path')).toBe(false);
    expect(isSafeArchivePath('../escape')).toBe(false);
    expect(isSafeArchivePath('repo/../../escape')).toBe(false);
    expect(isSafeArchivePath('repo\\..\\escape')).toBe(false);
  });
});
