import { buildAddableTree } from '../../commands/quick-add.js';
import { GuidelineLoader } from '../../services/guideline-loader.js';
import { EmbeddedDataSource } from '../../services/data-source.js';
import type { ProfileSelection } from '../../models/profile.js';

jest.mock('@inquirer/prompts', () => ({ select: jest.fn(), checkbox: jest.fn(), confirm: jest.fn(), Separator: class {} }));
jest.mock('chalk', () => ({ __esModule: true, default: new Proxy({}, { get: () => (text: string) => text }) }));
jest.mock('ora', () => ({ __esModule: true, default: () => ({ start: () => ({}), succeed: () => ({}), fail: () => ({}) }) }));
jest.mock('../../utils/banner', () => ({ showBanner: jest.fn() }));

const config = (level: ProfileSelection['level']): ProfileSelection => ({
  assistant: 'claude-code', language: 'rust', level, architecture: 'layered', projectType: 'cli', projectName: 'demo', datasource: 'sql',
});

describe('quick-add candidates', () => {
  let loader: GuidelineLoader;
  beforeAll(async () => { loader = await GuidelineLoader.create(new EmbeddedDataSource()); });

  const ids = (level: ProfileSelection['level']) =>
    new Set(buildAddableTree(loader, config(level)).flatMap(category => category.guidelines.map(g => g.id)));

  it('offers guidelines the basic profile does not include, not what is already installed', () => {
    const installed = loader.getGuidelinesForProfile('rust', 'basic', 'layered', 'sql');
    const offered = ids('basic');

    expect(offered.size).toBeGreaterThan(20);
    for (const id of installed) expect(offered.has(id)).toBe(false);
    expect(offered.has('security-supply-chain')).toBe(true);
  });

  it('offers fewer guidelines as the profile grows and never lists installed ones', () => {
    expect(ids('standard').size).toBeLessThan(ids('basic').size);
    const installed = loader.getGuidelinesForProfile('rust', 'full', 'layered', 'sql');
    for (const id of installed) expect(ids('full').has(id)).toBe(false);
  });

  it('only offers guidelines for the project language and carries their descriptions', () => {
    const tree = buildAddableTree(loader, config('basic'));
    const all = tree.flatMap(category => category.guidelines);
    expect(all.some(g => g.id.startsWith('python-'))).toBe(false);
    expect(all.every(g => typeof g.description === 'string' && g.description.includes('Use when'))).toBe(true);
    expect(tree.every(category => category.count === category.guidelines.length && category.count > 0)).toBe(true);
  });
});
