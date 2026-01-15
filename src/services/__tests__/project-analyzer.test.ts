import { ProjectAnalyzer } from '../project-analyzer';
import * as path from 'path';

// Mock modules with factory functions for Bun compatibility
jest.mock('fast-glob', () => jest.fn());
jest.mock('../../utils/file', () => ({
  exists: jest.fn(),
  readFile: jest.fn()
}));

const glob = require('fast-glob') as jest.Mock;
const { exists, readFile } = require('../../utils/file');

describe('ProjectAnalyzer', () => {
  let analyzer: ProjectAnalyzer;
  const testProjectPath = '/test/project';

  beforeEach(() => {
    analyzer = new ProjectAnalyzer(testProjectPath);
    jest.clearAllMocks();

    // Default mocks - will be overridden in individual tests
    // Don't set glob here - it conflicts with mockImplementation in tests
    exists.mockResolvedValue(false);
    readFile.mockResolvedValue('{}');
  });

  describe('Language Detection', () => {
    it('should detect TypeScript project', async () => {
      const glob = require('fast-glob');
      const { exists, readFile } = require('../../utils/file');

      // Mock glob to return minimal structure
      glob.mockResolvedValue([]);
      exists.mockImplementation((filepath: string) =>
        Promise.resolve(filepath.endsWith('tsconfig.json'))
      );
      readFile.mockResolvedValue('{}');

      const result = await analyzer.analyze();
      expect(result.metadata.language).toBe('typescript');
    });

    it('should detect Dart project', async () => {
      const glob = require('fast-glob');
      const { exists, readFile } = require('../../utils/file');

      // Mock glob to return minimal structure
      glob.mockResolvedValue([]);
      exists.mockImplementation((filepath: string) =>
        Promise.resolve(filepath.endsWith('pubspec.yaml'))
      );
      readFile.mockResolvedValue('{}');

      const result = await analyzer.analyze();
      expect(result.metadata.language).toBe('dart');
    });

    it('should detect Swift project', async () => {
      const glob = require('fast-glob');
      const { exists, readFile } = require('../../utils/file');

      // Mock glob to return minimal structure
      glob.mockResolvedValue([]);
      exists.mockImplementation((filepath: string) =>
        Promise.resolve(filepath.endsWith('Package.swift'))
      );
      readFile.mockResolvedValue('{}');

      const result = await analyzer.analyze();
      expect(result.metadata.language).toBe('swift');
    });
  });

  describe('Architecture Hints Detection', () => {
    it('should detect monorepo indicators', async () => {
      // Mock glob to return files and then directories
      glob.mockImplementation((pattern: any, options: any) => {
        if (options?.onlyDirectories) {
          return Promise.resolve(['packages/app1', 'packages/app2']);
        }
        return Promise.resolve(['packages/app1/index.ts', 'packages/app2/index.ts']);
      });

      exists.mockImplementation((filepath: string) =>
        Promise.resolve(filepath.includes('nx.json') || filepath.includes('turbo.json'))
      );
      readFile.mockResolvedValue('{}');

      const result = await analyzer.analyze();

      expect(result.metadata.architectureHints).toContain('nx-monorepo');
      expect(result.metadata.architectureHints).toContain('turborepo');
      expect(result.metadata.architectureHints).toContain('workspace-structure');
    });

    it('should detect microservices structure', async () => {
      glob.mockImplementation((pattern: any, options: any) => {
        if (options?.onlyDirectories) {
          return Promise.resolve(['services/api', 'services/auth']);
        }
        return Promise.resolve(['services/api/index.ts', 'services/auth/index.ts']);
      });

      exists.mockImplementation((filepath: string) =>
        Promise.resolve(filepath.includes('docker-compose.yml'))
      );
      readFile.mockResolvedValue('{}');

      const result = await analyzer.analyze();

      expect(result.metadata.architectureHints).toContain('microservices-structure');
      expect(result.metadata.architectureHints).toContain('docker-compose');
    });

    it('should detect serverless indicators', async () => {
      glob.mockImplementation((pattern: any, options: any) => {
        if (options?.onlyDirectories) {
          return Promise.resolve(['functions', 'src', 'lib']);
        }
        return Promise.resolve(['functions/api.ts', 'src/index.ts']);
      });

      exists.mockImplementation((filepath: string) =>
        Promise.resolve(
          filepath.includes('serverless.yml') || filepath.includes('netlify.toml')
        )
      );
      readFile.mockResolvedValue('{}');

      const result = await analyzer.analyze();

      expect(result.metadata.architectureHints).toContain('serverless-framework');
      expect(result.metadata.architectureHints).toContain('netlify');
      expect(result.metadata.architectureHints).toContain('serverless-functions');
    });

    it('should detect DDD structure', async () => {
      glob.mockImplementation((pattern: any, options: any) => {
        if (options?.onlyDirectories) {
          return Promise.resolve([
            'src/domain/aggregate',
            'src/domain/entity',
            'src/bounded-contexts/user'
          ]);
        }
        return Promise.resolve(['src/domain/aggregate/user.ts']);
      });

      exists.mockResolvedValue(false);
      readFile.mockResolvedValue('{}');

      const result = await analyzer.analyze();

      expect(result.metadata.architectureHints).toContain('ddd-structure');
      expect(result.metadata.architectureHints).toContain('bounded-contexts');
    });

    it('should detect hexagonal architecture', async () => {
      glob.mockImplementation((pattern: any, options: any) => {
        if (options?.onlyDirectories) {
          return Promise.resolve([
            'src/domain',
            'src/infrastructure',
            'src/adapters',
            'src/use-cases'
          ]);
        }
        return Promise.resolve(['src/domain/user.ts', 'src/infrastructure/db.ts']);
      });

      exists.mockResolvedValue(false);
      readFile.mockResolvedValue('{}');

      const result = await analyzer.analyze();

      expect(result.metadata.architectureHints).toContain('hexagonal-layers');
      expect(result.metadata.architectureHints).toContain('ports-and-adapters');
      expect(result.metadata.architectureHints).toContain('use-cases');
    });
  });

  describe('Database Hints Detection', () => {
    it('should detect SQL databases from package.json', async () => {
      const glob = require('fast-glob');
      const { exists, readFile } = require('../../utils/file');

      glob.mockResolvedValue(['package.json']);
      exists.mockImplementation((filepath: string) =>
        Promise.resolve(filepath.endsWith('package.json'))
      );
      readFile.mockImplementation((filepath: string) => {
        if (filepath.endsWith('package.json')) {
          return Promise.resolve(
            JSON.stringify({
              dependencies: {
                pg: '^8.0.0',
                prisma: '^4.0.0'
              }
            })
          );
        }
        return Promise.resolve('');
      });

      const result = await analyzer.analyze();

      expect(result.metadata.databaseHints.hasSql).toBe(true);
      expect(result.metadata.databaseHints.hasNoSql).toBe(false);
      expect(result.metadata.databaseHints.detected).toEqual(
        expect.arrayContaining(['PostgreSQL', 'SQL ORM'])
      );
    });

    it('should detect NoSQL databases from package.json', async () => {
      const glob = require('fast-glob');
      const { exists, readFile } = require('../../utils/file');

      glob.mockResolvedValue(['package.json']);
      exists.mockImplementation((filepath: string) =>
        Promise.resolve(filepath.endsWith('package.json'))
      );
      readFile.mockImplementation((filepath: string) => {
        if (filepath.endsWith('package.json')) {
          return Promise.resolve(
            JSON.stringify({
              dependencies: {
                mongodb: '^5.0.0',
                redis: '^4.0.0'
              }
            })
          );
        }
        return Promise.resolve('');
      });

      const result = await analyzer.analyze();

      expect(result.metadata.databaseHints.hasSql).toBe(false);
      expect(result.metadata.databaseHints.hasNoSql).toBe(true);
      expect(result.metadata.databaseHints.detected).toEqual(
        expect.arrayContaining(['MongoDB', 'Redis'])
      );
    });

    it('should detect Prisma schema', async () => {
      const glob = require('fast-glob');
      const { exists, readFile } = require('../../utils/file');

      // Return prisma directory in structure
      glob.mockResolvedValue(['prisma', 'src', 'lib']);
      exists.mockImplementation((filepath: string) => {
        // Return true only for prisma schema file, false for package.json etc
        if (filepath.includes('schema.prisma')) return Promise.resolve(true);
        return Promise.resolve(false);
      });
      readFile.mockResolvedValue('');

      const result = await analyzer.analyze();

      expect(result.metadata.databaseHints.hasSql).toBe(true);
      expect(result.metadata.databaseHints.detected).toContain('Prisma');
    });

    it('should detect Python database dependencies', async () => {
      const glob = require('fast-glob');
      const { exists, readFile } = require('../../utils/file');

      glob.mockResolvedValue(['requirements.txt']);
      exists.mockImplementation((filepath: string) =>
        Promise.resolve(filepath.endsWith('requirements.txt'))
      );
      readFile.mockImplementation((filepath: string) => {
        if (filepath.endsWith('requirements.txt')) {
          return Promise.resolve('psycopg2==2.9.0\nsqlalchemy==1.4.0');
        }
        return Promise.resolve('');
      });

      const result = await analyzer.analyze();

      expect(result.metadata.databaseHints.hasSql).toBe(true);
      expect(result.metadata.databaseHints.detected).toEqual(
        expect.arrayContaining(['PostgreSQL', 'SQLAlchemy'])
      );
    });

    it('should detect Go database dependencies', async () => {
      const glob = require('fast-glob');
      const { exists, readFile } = require('../../utils/file');

      glob.mockResolvedValue(['go.mod']);
      exists.mockImplementation((filepath: string) =>
        Promise.resolve(filepath.endsWith('go.mod'))
      );
      readFile.mockImplementation((filepath: string) => {
        if (filepath.endsWith('go.mod')) {
          return Promise.resolve(
            'require (\n  github.com/lib/pq v1.10.0\n  gorm.io/gorm v1.23.0\n)'
          );
        }
        return Promise.resolve('');
      });

      const result = await analyzer.analyze();

      expect(result.metadata.databaseHints.hasSql).toBe(true);
      expect(result.metadata.databaseHints.detected).toEqual(
        expect.arrayContaining(['PostgreSQL', 'GORM'])
      );
    });
  });

  describe('Testing Hints Detection', () => {
    it('should detect test files and count them', async () => {
      const testFiles = [
        'src/app.test.ts',
        'src/utils.spec.ts',
        'src/api_test.go',
        'tests/integration.test.ts'
      ];

      glob.mockImplementation((pattern: any, options: any) => {
        if (options?.onlyDirectories) {
          return Promise.resolve([]);
        }
        return Promise.resolve(testFiles);
      });

      exists.mockResolvedValue(false);
      readFile.mockResolvedValue('{}');

      const result = await analyzer.analyze();

      expect(result.metadata.testingHints.hasTests).toBe(true);
      expect(result.metadata.testingHints.testFileCount).toBe(4);
      expect(result.metadata.testingHints.frameworks).toContain('Test-style tests');
      expect(result.metadata.testingHints.frameworks).toContain('Spec-style tests');
      expect(result.metadata.testingHints.frameworks).toContain('Go testing');
    });

    it('should handle projects with no tests', async () => {
      glob.mockImplementation((pattern: any, options: any) => {
        if (options?.onlyDirectories) {
          return Promise.resolve([]);
        }
        return Promise.resolve(['src/app.ts', 'src/utils.ts']);
      });

      exists.mockResolvedValue(false);
      readFile.mockResolvedValue('{}');

      const result = await analyzer.analyze();

      expect(result.metadata.testingHints.hasTests).toBe(false);
      expect(result.metadata.testingHints.testFileCount).toBe(0);
    });
  });

  describe('Project Type Hints Detection', () => {
    it('should detect web frontend indicators', async () => {
      const files = [
        'src/components/Button.tsx',
        'public/index.html',
        'assets/logo.png',
        'package.json'
      ];

      glob.mockImplementation((pattern: any, options: any) => {
        if (options?.onlyDirectories) {
          return Promise.resolve(['src/components', 'public', 'assets']);
        }
        return Promise.resolve(files);
      });

      exists.mockImplementation((filepath: string) =>
        Promise.resolve(filepath.includes('package.json'))
      );
      readFile.mockImplementation((filepath: string) => {
        if (filepath.includes('package.json')) {
          return Promise.resolve(JSON.stringify({ dependencies: { react: '^18.0.0' } }));
        }
        return Promise.resolve('{}');
      });

      const result = await analyzer.analyze();

      expect(result.metadata.projectTypeHints).toContain('component-based-ui');
      expect(result.metadata.projectTypeHints).toContain('static-assets');
      expect(result.metadata.projectTypeHints).toContain('spa-framework');
      expect(result.metadata.projectTypeHints).toContain('web-app');
    });

    it('should detect API/backend indicators', async () => {
      const files = [
        'src/routes/users.ts',
        'src/controllers/auth.ts',
        'api/handlers.ts',
        'package.json'
      ];

      glob.mockImplementation((pattern: any, options: any) => {
        if (options?.onlyDirectories) {
          return Promise.resolve(['src/routes', 'src/controllers', 'api']);
        }
        return Promise.resolve(files);
      });

      exists.mockImplementation((filepath: string) =>
        Promise.resolve(filepath.includes('package.json'))
      );
      readFile.mockImplementation((filepath: string) => {
        if (filepath.includes('package.json')) {
          return Promise.resolve(JSON.stringify({ dependencies: { express: '^4.0.0' } }));
        }
        return Promise.resolve('{}');
      });

      const result = await analyzer.analyze();

      expect(result.metadata.projectTypeHints).toContain('api-routes');
      expect(result.metadata.projectTypeHints).toContain('api-handlers');
      expect(result.metadata.projectTypeHints).toContain('web-framework');
      expect(result.metadata.projectTypeHints).toContain('api-structure');
    });

    it('should detect CLI indicators', async () => {
      const files = ['src/commands/init.ts', 'bin/cli.js', 'package.json'];

      glob.mockImplementation((pattern: any, options: any) => {
        if (options?.onlyDirectories) {
          return Promise.resolve(['src/commands', 'bin']);
        }
        return Promise.resolve(files);
      });

      exists.mockImplementation((filepath: string) =>
        Promise.resolve(filepath.includes('package.json'))
      );
      readFile.mockResolvedValue('{}');

      const result = await analyzer.analyze();

      expect(result.metadata.projectTypeHints).toContain('cli-commands');
      expect(result.metadata.projectTypeHints).toContain('cli-structure');
    });

    it('should detect library indicators', async () => {
      const files = ['src/index.ts', 'lib/utils.js', 'dist/bundle.js', 'package.json'];

      glob.mockImplementation((pattern: any, options: any) => {
        if (options?.onlyDirectories) {
          return Promise.resolve(['src', 'lib', 'dist']);
        }
        return Promise.resolve(files);
      });

      exists.mockImplementation((filepath: string) =>
        Promise.resolve(filepath.includes('package.json'))
      );
      readFile.mockResolvedValue('{}');

      const result = await analyzer.analyze();

      expect(result.metadata.projectTypeHints).toContain('library-entry');
      expect(result.metadata.projectTypeHints).toContain('library-build');
    });

    it('should detect mobile indicators', async () => {
      const files = [
        'src/App.ios.ts',
        'src/Button.android.tsx',
        'ios/Info.plist',
        'android/build.gradle'
      ];

      glob.mockImplementation((pattern: any, options: any) => {
        if (options?.onlyDirectories) {
          return Promise.resolve(['src', 'ios', 'android']);
        }
        return Promise.resolve(files);
      });

      exists.mockResolvedValue(false);
      readFile.mockResolvedValue('{}');

      const result = await analyzer.analyze();

      expect(result.metadata.projectTypeHints).toContain('mobile-platform');
      expect(result.metadata.projectTypeHints).toContain('native-mobile');
    });
  });
});
