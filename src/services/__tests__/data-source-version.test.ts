import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  EmbeddedDataSource,
  FileSystemDataSource,
  HybridDataSource,
  MinVersionDataSource,
  compareVersions,
  isOlderVersion,
} from '../data-source.js';
import { needsUpdate } from '../../commands/update.js';

jest.mock('ora', () => ({ __esModule: true, default: () => ({ start: () => ({}), stop: () => ({}), succeed: () => ({}), fail: () => ({}) }) }));
jest.mock('chalk', () => ({ __esModule: true, default: new Proxy({}, { get: () => (text: string) => text }) }));
jest.mock('../../utils/formatting', () => ({ createSummaryBox: jest.fn() }));

describe('version comparison', () => {
  it('compares dotted versions numerically', () => {
    expect(compareVersions('2.0.0', '1.2.1')).toBeGreaterThan(0);
    expect(compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0);
    expect(compareVersions('2.0', '2.0.0')).toBe(0);
    expect(compareVersions('1.0.0-beta.3', '1.0.0')).toBe(0);
  });

  it('treats unreadable versions as older', () => {
    expect(isOlderVersion('unknown', '2.0.0')).toBe(true);
    expect(isOlderVersion('1.2.0', '2.0.0')).toBe(true);
    expect(isOlderVersion('2.0.0', '2.0.0')).toBe(false);
    expect(isOlderVersion('2.1.0', '2.0.0')).toBe(false);
  });
});

describe('a downloaded data package older than the bundled data', () => {
  let dir: string;

  const writeCache = async (version: string) => {
    await mkdir(join(dir, 'guidelines'), { recursive: true });
    await writeFile(join(dir, 'version.json'), JSON.stringify({ version }));
    await writeFile(join(dir, 'guideline-mappings.yml'), 'typescript-basics:\n  path: language/typescript/basics.md\n  levels:\n    - basic\n');
    await writeFile(join(dir, 'guidelines', 'basics.md'), '# OLD 1.x TEXT');
  };

  beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'aicgen-cache-')); });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

  const load = async (cacheMin: string) => new HybridDataSource([
    new MinVersionDataSource(new FileSystemDataSource(dir), cacheMin),
    new EmbeddedDataSource(),
  ]).load();

  it('does not override the bundled guidelines', async () => {
    await writeCache('1.2.0');
    const data = await load('2.0.0');

    expect(data.mappings['typescript-basics'].description).toContain('Use when');
    expect(Object.values(data.guidelines).some(text => text.includes('OLD 1.x TEXT'))).toBe(false);
    expect(await new MinVersionDataSource(new FileSystemDataSource(dir), '2.0.0').exists()).toBe(false);
  });

  it('is ignored when it has no readable version', async () => {
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'guideline-mappings.yml'), 'x:\n  path: x.md\n');
    expect(await new MinVersionDataSource(new FileSystemDataSource(dir), '2.0.0').exists()).toBe(false);
  });

  it('still wins when it is newer than the bundled data', async () => {
    await writeCache('2.1.0');
    const source = new MinVersionDataSource(new FileSystemDataSource(dir), '2.0.0');
    expect(await source.exists()).toBe(true);
    expect(Object.keys((await load('2.0.0')).mappings['typescript-basics'])).not.toContain('description');
  });
});

describe('aicgen update', () => {
  it('does not offer an older release over the bundled data', () => {
    expect(needsUpdate('2.0.0', '1.2.0')).toBe(false);
    expect(needsUpdate('2.0.0', '2.0.0')).toBe(false);
    expect(needsUpdate('2.0.0', '2.1.0')).toBe(true);
  });
});
