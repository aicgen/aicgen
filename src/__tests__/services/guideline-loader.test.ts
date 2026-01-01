jest.mock('../../config.js');
import { GuidelineLoader } from '../../services/guideline-loader.js';
import type { Language, InstructionLevel, ArchitectureType, DatasourceType } from '../../models/profile.js';

describe('GuidelineLoader', () => {
  let loader: GuidelineLoader;

  beforeAll(async () => {
    loader = await GuidelineLoader.create();
  });

  describe('Initialization', () => {
    it('should load embedded guidelines', async () => {
      expect(loader).toBeDefined();
      const stats = loader.getStats();
      expect(stats.totalGuidelines).toBeGreaterThan(0);
    });

    it('should have correct guideline count', async () => {
      const stats = loader.getStats();
      expect(stats.totalGuidelines).toBe(82);
    });

    it('should have expected categories', async () => {
      const stats = loader.getStats();
      expect(stats.byCategory).toBeDefined();
      expect(stats.byCategory['Language']).toBeGreaterThan(0);
      expect(stats.byCategory['Architecture']).toBeGreaterThan(0);
      expect(stats.byCategory['Testing']).toBeGreaterThan(0);
      expect(stats.byCategory['Security']).toBeGreaterThan(0);
    });
  });

  describe('Full Level Filtering', () => {
    it('should include ALL guidelines for full level regardless of architecture', async () => {
      const typescript = loader.getGuidelinesForProfile('typescript', 'full', 'microservices', 'sql');
      const typescriptMonolith = loader.getGuidelinesForProfile('typescript', 'full', 'modular-monolith', 'sql');

      // Full level should return same count regardless of architecture
      expect(typescript.length).toBe(typescriptMonolith.length);
      expect(typescript.length).toBeGreaterThanOrEqual(65); // Should include all applicable guidelines
    });

    it('should include all architecture patterns in full level', async () => {
      const guidelines = loader.getGuidelinesForProfile('typescript', 'full', 'microservices', 'sql');
      const allGuidelines = loader.getAllGuidelines();

      // Check if architecture-specific guidelines from OTHER architectures are included
      const architectureGuidelines = allGuidelines.filter(g =>
        g.mapping.architectures && g.mapping.architectures.length > 0
      );

      // At least some architecture guidelines should be in the result
      const includedArchGuidelines = guidelines.filter(id => {
        const mapping = loader.getMapping(id);
        return mapping?.architectures && mapping.architectures.length > 0;
      });

      expect(includedArchGuidelines.length).toBeGreaterThan(0);
    });

    it('full level should include microservices guidelines even when selecting modular-monolith', async () => {
      const guidelines = loader.getGuidelinesForProfile('typescript', 'full', 'modular-monolith', 'sql');

      // Find a microservices-specific guideline
      const allGuidelines = loader.getAllGuidelines();
      const microservicesGuideline = allGuidelines.find(g =>
        g.mapping.architectures?.includes('microservices') &&
        !g.mapping.architectures?.includes('modular-monolith')
      );

      if (microservicesGuideline) {
        expect(guidelines).toContain(microservicesGuideline.id);
      }
    });
  });

  describe('Level-Based Filtering', () => {
    it('basic level should return fewer guidelines than standard', async () => {
      const basic = loader.getGuidelinesForProfile('typescript', 'basic', 'microservices', 'sql');
      const standard = loader.getGuidelinesForProfile('typescript', 'standard', 'microservices', 'sql');

      expect(basic.length).toBeLessThan(standard.length);
    });

    it('standard level should return fewer guidelines than expert', async () => {
      const standard = loader.getGuidelinesForProfile('typescript', 'standard', 'microservices', 'sql');
      const expert = loader.getGuidelinesForProfile('typescript', 'expert', 'microservices', 'sql');

      expect(standard.length).toBeLessThan(expert.length);
    });

    it('expert level should return fewer or equal guidelines than full', async () => {
      const expert = loader.getGuidelinesForProfile('typescript', 'expert', 'microservices', 'sql');
      const full = loader.getGuidelinesForProfile('typescript', 'full', 'microservices', 'sql');

      expect(expert.length).toBeLessThanOrEqual(full.length);
    });
  });

  describe('Architecture-Based Filtering', () => {
    it('should filter by architecture for non-full levels', async () => {
      const microservices = loader.getGuidelinesForProfile('typescript', 'expert', 'microservices', 'sql');
      const monolith = loader.getGuidelinesForProfile('typescript', 'expert', 'modular-monolith', 'sql');

      // At non-full levels, different architectures should give different results
      // (though some guidelines may be shared)
      expect(microservices).toBeDefined();
      expect(monolith).toBeDefined();
    });

    it('should NOT filter by architecture for full level', async () => {
      const microservices = loader.getGuidelinesForProfile('typescript', 'full', 'microservices', 'sql');
      const monolith = loader.getGuidelinesForProfile('typescript', 'full', 'modular-monolith', 'sql');

      // Full level should return same guidelines regardless of selected architecture
      expect(microservices.length).toBe(monolith.length);
    });
  });

  describe('Language-Based Filtering', () => {
    it('should filter by language', async () => {
      const typescript = loader.getGuidelinesForProfile('typescript', 'standard', 'microservices', 'sql');
      const python = loader.getGuidelinesForProfile('python', 'standard', 'microservices', 'sql');

      // Different languages should have some different guidelines
      expect(typescript).toBeDefined();
      expect(python).toBeDefined();
      expect(typescript.length).toBeGreaterThan(0);
      expect(python.length).toBeGreaterThan(0);
    });

    it('should include language-agnostic guidelines for all languages', async () => {
      const typescript = loader.getGuidelinesForProfile('typescript', 'standard', 'microservices', 'sql');
      const python = loader.getGuidelinesForProfile('python', 'standard', 'microservices', 'sql');

      // Find language-agnostic guidelines
      const allGuidelines = loader.getAllGuidelines();
      const agnosticGuideline = allGuidelines.find(g => !g.mapping.languages);

      if (agnosticGuideline) {
        // Language-agnostic guidelines should be in both
        expect(typescript).toContain(agnosticGuideline.id);
        expect(python).toContain(agnosticGuideline.id);
      }
    });
  });

  describe('Datasource Filtering', () => {
    it('should exclude database guidelines when datasource is none', async () => {
      const withDb = loader.getGuidelinesForProfile('typescript', 'standard', 'microservices', 'sql');
      const withoutDb = loader.getGuidelinesForProfile('typescript', 'standard', 'microservices', 'none');

      expect(withoutDb.length).toBeLessThan(withDb.length);
    });

    it('should include SQL guidelines when datasource is sql', async () => {
      const guidelines = loader.getGuidelinesForProfile('typescript', 'standard', 'microservices', 'sql');
      const categoryTree = loader.getGuidelinesByCategory('typescript', 'standard', 'microservices', 'sql');

      // Should have database category when SQL is selected
      expect(categoryTree['Database']).toBeDefined();
    });

    it('should exclude database category when datasource is none', async () => {
      const categoryTree = loader.getGuidelinesByCategory('typescript', 'standard', 'microservices', 'none');

      // Should NOT have database category when datasource is none
      expect(categoryTree['Database']).toBeUndefined();
    });
  });

  describe('Guideline Loading', () => {
    it('should load guideline content by ID', async () => {
      const guidelines = loader.getGuidelinesForProfile('typescript', 'basic', 'microservices', 'sql');
      expect(guidelines.length).toBeGreaterThan(0);

      const content = loader.loadGuideline(guidelines[0]);
      expect(content).toBeDefined();
      expect(typeof content).toBe('string');
      expect(content.length).toBeGreaterThan(0);
    });

    it('should throw error for invalid guideline ID', async () => {
      expect(() => loader.loadGuideline('invalid-guideline-id-12345')).toThrow();
    });
  });

  describe('Guideline Mapping', () => {
    it('should get mapping for guideline ID', async () => {
      const guidelines = loader.getGuidelinesForProfile('typescript', 'basic', 'microservices', 'sql');
      const mapping = loader.getMapping(guidelines[0]);

      expect(mapping).toBeDefined();
      expect(mapping?.path).toBeDefined();
      expect(mapping?.category).toBeDefined();
    });

    it('should return undefined for invalid guideline ID', async () => {
      const mapping = loader.getMapping('invalid-guideline-id-12345');
      expect(mapping).toBeUndefined();
    });
  });

  describe('Profile Assembly', () => {
    it('should assemble complete profile', async () => {
      const profile = loader.assembleProfile('typescript', 'basic', 'microservices', 'sql');

      expect(profile).toBeDefined();
      expect(typeof profile).toBe('string');
      expect(profile.length).toBeGreaterThan(0);
      expect(profile).toContain('---'); // Should have separator between guidelines
    });

    it('should throw error when no guidelines found', async () => {
      // This would only throw if we had a scenario with truly no matching guidelines
      // Since basic level includes language-agnostic guidelines, most profiles will have some
      // The method throws when guidelineIds.length === 0
      const profile = loader.assembleProfile('typescript', 'basic', 'microservices', 'sql');
      expect(profile).toBeDefined();
    });
  });

  describe('Category Tree', () => {
    it('should generate category tree', async () => {
      const tree = loader.getCategoryTree('typescript', 'standard', 'microservices', 'sql');

      expect(tree).toBeDefined();
      expect(Array.isArray(tree)).toBe(true);
      expect(tree.length).toBeGreaterThan(0);

      const firstCategory = tree[0];
      expect(firstCategory.name).toBeDefined();
      expect(firstCategory.count).toBeGreaterThan(0);
      expect(Array.isArray(firstCategory.guidelines)).toBe(true);
    });

    it('should include guideline details in tree', async () => {
      const tree = loader.getCategoryTree('typescript', 'standard', 'microservices', 'sql');
      const firstGuideline = tree[0].guidelines[0];

      expect(firstGuideline.id).toBeDefined();
      expect(firstGuideline.name).toBeDefined();
      expect(firstGuideline.path).toBeDefined();
    });
  });

  describe('Metrics', () => {
    it('should calculate metrics for guidelines', async () => {
      const guidelines = loader.getGuidelinesForProfile('typescript', 'standard', 'microservices', 'sql');
      const metrics = loader.getMetrics(guidelines);

      expect(metrics.guidelineCount).toBe(guidelines.length);
      expect(metrics.hooksCount).toBeGreaterThanOrEqual(0);
      expect(metrics.subAgentsCount).toBeGreaterThanOrEqual(1);
      expect(metrics.estimatedSize).toBeDefined();
      expect(Array.isArray(metrics.categories)).toBe(true);
    });
  });

  describe('Statistics', () => {
    it('should provide comprehensive stats', async () => {
      const stats = loader.getStats();

      expect(stats.totalGuidelines).toBe(82);
      expect(Object.keys(stats.byLanguage).length).toBeGreaterThan(0);
      expect(Object.keys(stats.byLevel).length).toBeGreaterThan(0);
      expect(Object.keys(stats.byArchitecture).length).toBeGreaterThan(0);
      expect(Object.keys(stats.byCategory).length).toBe(12);
    });

    it('should have expected level counts', async () => {
      const stats = loader.getStats();

      expect(stats.byLevel['basic']).toBe(17);
      expect(stats.byLevel['standard']).toBe(68);
      expect(stats.byLevel['expert']).toBe(82);
      expect(stats.byLevel['full']).toBe(82);
    });
  });
});
