import { ProjectAnalyzer } from '../project-analyzer';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock file system
jest.mock('fs/promises');
jest.mock('fast-glob');
jest.mock('../../utils/file');

const mockFs = fs as jest.Mocked<typeof fs>;

describe('ProjectAnalyzer', () => {
  let analyzer: ProjectAnalyzer;
  const testProjectPath = '/test/project';

  beforeEach(() => {
    analyzer = new ProjectAnalyzer(testProjectPath);
    jest.clearAllMocks();
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
      const glob = require('fast-glob');
      const { exists, readFile } = require('../../utils/file');

      glob.mockResolvedValue(['packages/app1', 'packages/app2']);
      exists.mockImplementation((filepath: string) =>
        Promise.resolve(filepath.endsWith('nx.json') || filepath.endsWith('turbo.json'))
      );
      readFile.mockResolvedValue('{}');

      const result = await analyzer.analyze();

      expect(result.metadata.architectureHints).toEqual(
        expect.arrayContaining(['nx-monorepo', 'turborepo', 'workspace-structure'])
      );
    });

    it('should detect microservices structure', async () => {
      const glob = require('fast-glob');
      const { exists, readFile } = require('../../utils/file');

      glob.mockResolvedValue(['services/api', 'services/auth']);
      exists.mockImplementation((filepath: string) =>
        Promise.resolve(filepath.endsWith('docker-compose.yml'))
      );
      readFile.mockResolvedValue('{}');

      const result = await analyzer.analyze();

      expect(result.metadata.architectureHints).toEqual(
        expect.arrayContaining(['microservices-structure', 'docker-compose'])
      );
    });

    it('should detect serverless indicators', async () => {
      const glob = require('fast-glob');
      const { exists, readFile } = require('../../utils/file');

      // Return 'functions' directory (not subdirectories) for detection
      glob.mockResolvedValue(['functions', 'src', 'lib']);
      exists.mockImplementation((filepath: string) =>
        Promise.resolve(
          filepath.endsWith('serverless.yml') || filepath.endsWith('netlify.toml')
        )
      );
      readFile.mockResolvedValue('{}');

      const result = await analyzer.analyze();

      expect(result.metadata.architectureHints).toEqual(
        expect.arrayContaining(['serverless-framework', 'netlify', 'serverless-functions'])
      );
    });

    it('should detect DDD structure', async () => {
      const glob = require('fast-glob');
      const { exists, readFile } = require('../../utils/file');

      glob.mockResolvedValue([
        'src/domain/aggregate',
        'src/domain/entity',
        'src/bounded-contexts/user'
      ]);
      exists.mockResolvedValue(false);
      readFile.mockResolvedValue('{}');

      const result = await analyzer.analyze();

      expect(result.metadata.architectureHints).toEqual(
        expect.arrayContaining(['ddd-structure', 'bounded-contexts'])
      );
    });

    it('should detect hexagonal architecture', async () => {
      const glob = require('fast-glob');
      const { exists, readFile } = require('../../utils/file');

      glob.mockResolvedValue([
        'src/domain',
        'src/infrastructure',
        'src/adapters',
        'src/use-cases'
      ]);
      exists.mockResolvedValue(false);
      readFile.mockResolvedValue('{}');

      const result = await analyzer.analyze();

      expect(result.metadata.architectureHints).toEqual(
        expect.arrayContaining(['hexagonal-layers', 'ports-and-adapters', 'use-cases'])
      );
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
      const glob = require('fast-glob');
      const { exists, readFile } = require('../../utils/file');

      glob.mockResolvedValue([
        'src/app.test.ts',
        'src/utils.spec.ts',
        'src/api_test.go',
        'tests/integration.test.ts'
      ]);
      exists.mockResolvedValue(false);
      readFile.mockResolvedValue('');

      const result = await analyzer.analyze();

      expect(result.metadata.testingHints.hasTests).toBe(true);
      expect(result.metadata.testingHints.testFileCount).toBe(4);
      expect(result.metadata.testingHints.frameworks).toEqual(
        expect.arrayContaining(['Test-style tests', 'Spec-style tests', 'Go testing'])
      );
    });

    it('should handle projects with no tests', async () => {
      const glob = require('fast-glob');
      const { exists, readFile } = require('../../utils/file');

      glob.mockResolvedValue(['src/app.ts', 'src/utils.ts']);
      exists.mockResolvedValue(false);
      readFile.mockResolvedValue('');

      const result = await analyzer.analyze();

      expect(result.metadata.testingHints.hasTests).toBe(false);
      expect(result.metadata.testingHints.testFileCount).toBe(0);
    });
  });

  describe('Project Type Hints Detection', () => {
    it('should detect web frontend indicators', async () => {
      const glob = require('fast-glob');
      const { exists, readFile } = require('../../utils/file');

      glob.mockResolvedValue([
        'src/components/Button.tsx',
        'public/index.html',
        'assets/logo.png',
        'package.json'
      ]);
      exists.mockImplementation((filepath: string) =>
        Promise.resolve(filepath.endsWith('package.json'))
      );
      readFile.mockImplementation((filepath: string) => {
        if (filepath.endsWith('package.json')) {
          return Promise.resolve(JSON.stringify({ dependencies: { react: '^18.0.0' } }));
        }
        return Promise.resolve('');
      });

      const result = await analyzer.analyze();

      expect(result.metadata.projectTypeHints).toEqual(
        expect.arrayContaining(['component-based-ui', 'static-assets', 'spa-framework', 'web-app'])
      );
    });

    it('should detect API/backend indicators', async () => {
      const glob = require('fast-glob');
      const { exists, readFile } = require('../../utils/file');

      glob.mockResolvedValue([
        'src/routes/users.ts',
        'src/controllers/auth.ts',
        'api/handlers.ts',
        'package.json'
      ]);
      exists.mockImplementation((filepath: string) =>
        Promise.resolve(filepath.endsWith('package.json'))
      );
      readFile.mockImplementation((filepath: string) => {
        if (filepath.endsWith('package.json')) {
          return Promise.resolve(JSON.stringify({ dependencies: { express: '^4.0.0' } }));
        }
        return Promise.resolve('');
      });

      const result = await analyzer.analyze();

      expect(result.metadata.projectTypeHints).toEqual(
        expect.arrayContaining(['api-routes', 'api-handlers', 'web-framework', 'api-structure'])
      );
    });

    it('should detect CLI indicators', async () => {
      const glob = require('fast-glob');
      const { exists, readFile } = require('../../utils/file');

      glob.mockResolvedValue(['src/commands/init.ts', 'bin/cli.js', 'package.json']);
      exists.mockImplementation((filepath: string) =>
        Promise.resolve(filepath.endsWith('package.json'))
      );
      readFile.mockResolvedValue('{}');

      const result = await analyzer.analyze();

      expect(result.metadata.projectTypeHints).toEqual(
        expect.arrayContaining(['cli-commands', 'cli-structure'])
      );
    });

    it('should detect library indicators', async () => {
      const glob = require('fast-glob');
      const { exists, readFile } = require('../../utils/file');

      glob.mockResolvedValue(['src/index.ts', 'lib/utils.js', 'dist/bundle.js', 'package.json']);
      exists.mockImplementation((filepath: string) =>
        Promise.resolve(filepath.endsWith('package.json'))
      );
      readFile.mockResolvedValue('{}');

      const result = await analyzer.analyze();

      expect(result.metadata.projectTypeHints).toEqual(
        expect.arrayContaining(['library-entry', 'library-build'])
      );
    });

    it('should detect mobile indicators', async () => {
      const glob = require('fast-glob');
      const { exists, readFile } = require('../../utils/file');

      glob.mockResolvedValue([
        'src/App.ios.ts',
        'src/Button.android.tsx',
        'ios/Info.plist',
        'android/build.gradle'
      ]);
      exists.mockResolvedValue(false);
      readFile.mockResolvedValue('');

      const result = await analyzer.analyze();

      expect(result.metadata.projectTypeHints).toEqual(
        expect.arrayContaining(['mobile-platform', 'native-mobile'])
      );
    });
  });
});
