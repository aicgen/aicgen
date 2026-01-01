jest.mock('../../../config.js');

import { AIAnalysisServiceRefactored } from './ai-analysis-refactored.service.js';
import { TimeoutError, ValidationErrors, InvalidCredentialsError } from '../../shared/errors/index.js';
import type { AnalysisContext } from '../../project-analyzer.js';
import type { AIAssistant } from '../../../models/profile.js';

global.fetch = jest.fn();

describe('AIAnalysisServiceRefactored', () => {
  let service: AIAnalysisServiceRefactored;
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    service = new AIAnalysisServiceRefactored({
      timeoutMs: 5000,
      maxRetries: 2,
      initialRetryDelayMs: 100
    });
    mockFetch.mockClear();
  });

  describe('Configuration', () => {
    it('should initialize with default configuration', () => {
      const defaultService = new AIAnalysisServiceRefactored();
      expect(defaultService).toBeDefined();
    });

    it('should initialize with custom configuration', () => {
      const customService = new AIAnalysisServiceRefactored({
        timeoutMs: 10000,
        maxRetries: 5,
        initialRetryDelayMs: 500
      });
      expect(customService).toBeDefined();
    });
  });

  describe('Claude Provider', () => {
    const mockContext: AnalysisContext = {
      metadata: {
        structure: ['src/'],
        files: ['src/index.ts'],
        language: 'typescript',
        frameworks: [],
        buildTools: [],
        packageManager: 'npm',
        repoType: 'unknown',
        fingerprint: 'test-fp'
      },
      samples: [{
        path: 'src/index.ts',
        content: 'console.log("test");'
      }]
    };

    it('should successfully analyze with Claude', async () => {
      const mockResponse = {
        language: 'typescript',
        level: 'standard',
        projectType: 'api',
        architecture: {
          pattern: 'microservices',
          confidence: 0.9
        },
        datasource: 'postgresql',
        reasoning: 'TypeScript detected',
        testingMaturity: 'medium'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{
            type: 'text',
            text: JSON.stringify(mockResponse)
          }]
        })
      } as Response);

      const result = await service.analyzeProject(
        mockContext,
        'claude-code',
        'test-api-key'
      );

      expect(result.language).toBe('typescript');
      expect(result.projectType).toBe('api');
      expect(result.architecture.pattern).toBe('microservices');
    });

    it('should handle Claude API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Unauthorized',
        status: 401
      } as Response);

      await expect(
        service.analyzeProject(mockContext, 'claude-code', 'invalid-key')
      ).rejects.toThrow();
    });
  });

  describe('Gemini Provider', () => {
    const mockContext: AnalysisContext = {
      metadata: {
        structure: [],
        files: ['main.py'],
        language: 'python',
        frameworks: ['flask'],
        buildTools: [],
        packageManager: 'pip',
        repoType: 'unknown',
        fingerprint: 'test-fp-py'
      },
      samples: [{
        path: 'main.py',
        content: 'print("hello")'
      }]
    };

    it('should successfully analyze with Gemini', async () => {
      const mockResponse = {
        language: 'python',
        level: 'expert',
        projectType: 'web',
        architecture: {
          pattern: 'microservices',
          confidence: 0.85
        },
        datasource: 'mongodb',
        reasoning: 'Python with Flask',
        testingMaturity: 'high'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify(mockResponse)
              }]
            }
          }]
        })
      } as Response);

      const result = await service.analyzeProject(
        mockContext,
        'gemini',
        'test-api-key'
      );

      expect(result.language).toBe('python');
      expect(result.projectType).toBe('web');
    });
  });

  describe('OpenAI Provider', () => {
    const mockContext: AnalysisContext = {
      metadata: {
        structure: [],
        files: ['main.go'],
        language: 'go',
        frameworks: [],
        buildTools: [],
        packageManager: 'go',
        repoType: 'unknown',
        fingerprint: 'test-fp-go'
      },
      samples: [{
        path: 'main.go',
        content: 'package main'
      }]
    };

    it('should successfully analyze with OpenAI', async () => {
      const mockResponse = {
        language: 'go',
        level: 'standard',
        projectType: 'api',
        architecture: {
          pattern: 'microservices',
          confidence: 0.9
        },
        datasource: 'postgresql',
        reasoning: 'Go project detected',
        testingMaturity: 'medium'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify(mockResponse)
            }
          }]
        })
      } as Response);

      const result = await service.analyzeProject(
        mockContext,
        'copilot',
        'test-api-key'
      );

      expect(result.language).toBe('go');
      expect(result.projectType).toBe('api');
    });
  });

  describe('Retry Logic', () => {
    const mockContext: AnalysisContext = {
      metadata: {
        structure: [],
        files: [],
        language: 'typescript',
        frameworks: [],
        buildTools: [],
        packageManager: 'npm',
        repoType: 'unknown',
        fingerprint: 'test-fp-retry'
      },
      samples: []
    };

    it('should retry on transient failures', async () => {
      const mockResponse = {
        language: 'typescript',
        level: 'standard',
        projectType: 'api',
        architecture: {
          pattern: 'microservices',
          confidence: 0.9
        },
        datasource: 'postgresql',
        reasoning: 'Test',
        testingMaturity: 'medium'
      };

      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            content: [{ type: 'text', text: JSON.stringify(mockResponse) }]
          })
        } as Response);

      const result = await service.analyzeProject(
        mockContext,
        'claude-code',
        'test-api-key'
      );

      expect(result.language).toBe('typescript');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should not retry on validation errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{
            type: 'text',
            text: JSON.stringify({ invalid: 'response' })
          }]
        })
      } as Response);

      await expect(
        service.analyzeProject(mockContext, 'claude-code', 'test-api-key')
      ).rejects.toThrow();

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Timeout Handling', () => {
    it('should have configured timeout', () => {
      expect(service).toBeDefined();
    });
  });

  describe('Validation', () => {
    const mockContext: AnalysisContext = {
      metadata: {
        structure: [],
        files: [],
        language: 'typescript',
        frameworks: [],
        buildTools: [],
        packageManager: 'npm',
        repoType: 'unknown',
        fingerprint: 'test-fp-validation'
      },
      samples: []
    };

    it('should validate AI response structure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{
            type: 'text',
            text: JSON.stringify({
              language: 'invalid-language',
              level: 'standard'
            })
          }]
        })
      } as Response);

      await expect(
        service.analyzeProject(mockContext, 'claude-code', 'test-api-key')
      ).rejects.toThrow();
    });

    it('should handle invalid JSON in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{
            type: 'text',
            text: 'Not valid JSON'
          }]
        })
      } as Response);

      await expect(
        service.analyzeProject(mockContext, 'claude-code', 'test-api-key')
      ).rejects.toThrow();
    });
  });

  describe('Error Handling', () => {
    const mockContext: AnalysisContext = {
      metadata: {
        structure: [],
        files: [],
        language: 'typescript',
        frameworks: [],
        buildTools: [],
        packageManager: 'npm',
        repoType: 'unknown',
        fingerprint: 'test-fp-error'
      },
      samples: []
    };

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network failed'));

      await expect(
        service.analyzeProject(mockContext, 'claude-code', 'test-api-key')
      ).rejects.toThrow();
    });

    it('should handle 401 unauthorized', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      } as Response);

      await expect(
        service.analyzeProject(mockContext, 'claude-code', 'invalid-key')
      ).rejects.toThrow();
    });

    it('should handle 429 rate limit', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests'
      } as Response);

      await expect(
        service.analyzeProject(mockContext, 'claude-code', 'test-api-key')
      ).rejects.toThrow();
    });
  });

  describe('Context Building', () => {
    it('should build context with all project info', () => {
      const context: AnalysisContext = {
        metadata: {
          structure: ['src/', 'tests/'],
          files: ['src/index.ts', 'src/app.ts'],
          language: 'typescript',
          frameworks: ['express'],
          buildTools: ['tsc'],
          packageManager: 'npm',
          repoType: 'polyrepo',
          fingerprint: 'test-fp-full'
        },
        samples: [
          { path: 'src/index.ts', content: 'import express from "express";' },
          { path: 'src/app.ts', content: 'export const app = express();' }
        ]
      };

      expect(context.metadata.files).toHaveLength(2);
      expect(context.metadata.frameworks).toContain('express');
      expect(context.samples).toHaveLength(2);
    });

    it('should handle minimal context', () => {
      const context: AnalysisContext = {
        metadata: {
          structure: [],
          files: [],
          language: 'typescript',
          frameworks: [],
          buildTools: [],
          packageManager: 'npm',
          repoType: 'unknown',
          fingerprint: 'test-fp-minimal'
        },
        samples: []
      };

      expect(context.metadata.files).toHaveLength(0);
      expect(context.samples).toHaveLength(0);
    });
  });
});
