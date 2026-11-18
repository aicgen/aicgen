/**
 * Guards for what gets published and for version drift across the release channels. These are
 * cheap file checks that would have caught: the npm package shipping editor state and the
 * repository's own AI configuration, and 1.2.x versions left in the Linux and Windows packaging.
 */
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf-8').replace(/\r\n/g, '\n');
const pkg = JSON.parse(read('package.json')) as {
  version: string;
  files?: string[];
  bin: Record<string, string>;
  engines: { node: string };
};

describe('npm package contents', () => {
  it('publishes only an allowlist: built output, README and LICENSE', () => {
    expect(pkg.files).toEqual(['dist/', 'README.md', 'LICENSE']);
  });

  it('exposes its binary from the built output', () => {
    expect(pkg.bin.aicgen.startsWith('dist/')).toBe(true);
  });

  it('does not track editor or IDE state in git', () => {
    expect(read('.gitignore')).toMatch(/^\.vs\/$/m);
    const tracked = execFileSync('git', ['ls-files', '.vs', '.vscode', '.idea'], { cwd: root, encoding: 'utf-8' }).trim();
    expect(tracked).toBe('');
  });
});

describe('version consistency across release channels', () => {
  it('uses the package.json version in the Debian control file and RPM spec', () => {
    expect(read('packaging/linux/control')).toMatch(new RegExp(`^Version: ${pkg.version}$`, 'm'));
    expect(read('packaging/linux/aicgen.spec')).toMatch(new RegExp(`^Version:\\s+${pkg.version}$`, 'm'));
  });

  it('uses the package.json version in the Windows installer', () => {
    const nsis = read('packaging/windows/setup.nsi');
    expect(nsis).toContain(`"DisplayVersion" "${pkg.version}"`);
    expect(nsis).toContain(`VIProductVersion "${pkg.version}.0"`);
  });

  it('has an RPM changelog whose weekdays match their dates (rpmbuild warns otherwise)', () => {
    const entries = [...read('packaging/linux/aicgen.spec').matchAll(/^\* (\w{3}) (\w{3}) (\d{1,2}) (\d{4}) /gm)];
    expect(entries.length).toBeGreaterThan(0);
    for (const [, weekday, month, day, year] of entries) {
      const date = new Date(`${month} ${day}, ${year} 12:00:00 UTC`);
      expect(date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })).toBe(weekday);
    }
  });

  it('builds and publishes with the Node version the package requires', () => {
    const required = Number(pkg.engines.node.replace(/\D/g, ''));
    const release = read('.github/workflows/release.yml');
    const nodeVersions = [...release.matchAll(/node-version: "(\d+)/g)].map(match => Number(match[1]));
    expect(nodeVersions.length).toBeGreaterThan(0);
    for (const version of nodeVersions) expect(version).toBeGreaterThanOrEqual(required);
  });
});
