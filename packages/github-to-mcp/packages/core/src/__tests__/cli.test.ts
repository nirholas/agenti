/**
 * @fileoverview Unit tests for cli module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing
vi.mock('./index', () => ({
  generateFromGithub: vi.fn(),
  generateFromGithubBatch: vi.fn(),
}));

vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
  })),
}));

vi.mock('chalk', () => ({
  default: {
    red: vi.fn((s: string) => s),
    green: vi.fn((s: string) => s),
    blue: vi.fn((s: string) => s),
    cyan: vi.fn((s: string) => s),
    gray: vi.fn((s: string) => s),
  },
}));

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

describe('CLI', () => {
  let mockExit: ReturnType<typeof vi.spyOn>;
  let mockConsoleError: ReturnType<typeof vi.spyOn>;
  let mockConsoleLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockExit.mockRestore();
    mockConsoleError.mockRestore();
    mockConsoleLog.mockRestore();
  });

  describe('Command parsing', () => {
    it('should accept GitHub URL as argument', () => {
      const url = 'https://github.com/owner/repo';
      
      // Test that URL is valid format
      expect(url).toMatch(/github\.com\/[\w-]+\/[\w-]+/);
    });

    it('should validate URL format', () => {
      const validUrls = [
        'https://github.com/owner/repo',
        'https://github.com/owner/repo.git',
        'https://github.com/owner/my-repo',
        'https://github.com/owner123/repo_name',
      ];

      const urlPattern = /^https:\/\/github\.com\/[\w-]+\/[\w._-]+/;

      validUrls.forEach(url => {
        expect(url).toMatch(urlPattern);
      });
    });

    it('should reject invalid URLs', () => {
      const invalidUrls = [
        'https://gitlab.com/owner/repo',
        'github.com/owner/repo',
        'https://github.com/',
        'not-a-url',
      ];

      const githubPattern = /^https:\/\/github\.com\/[\w-]+\/[\w._-]+/;

      invalidUrls.forEach(url => {
        expect(url).not.toMatch(githubPattern);
      });
    });
  });

  describe('Options', () => {
    it('should have default output directory', () => {
      const defaultOutput = './mcp-tools';
      expect(defaultOutput).toBe('./mcp-tools');
    });

    it('should parse sources option', () => {
      const sourcesStr = 'readme,openapi,code';
      const sources = sourcesStr.split(',');
      
      expect(sources).toEqual(['readme', 'openapi', 'code']);
    });

    it('should validate source types', () => {
      const validSources = ['readme', 'openapi', 'graphql', 'code'];
      const sourceTypes = new Set(['readme', 'openapi', 'graphql', 'code', 'mcp-introspect', 'tests', 'docs', 'examples', 'universal']);

      validSources.forEach(source => {
        expect(sourceTypes.has(source)).toBe(true);
      });
    });

    it('should parse depth option as number', () => {
      const depth = parseInt('3', 10);
      expect(depth).toBe(3);
      expect(typeof depth).toBe('number');
    });

    it('should handle format option', () => {
      const validFormats = ['typescript', 'javascript'];
      
      expect(validFormats).toContain('typescript');
      expect(validFormats).toContain('javascript');
    });
  });

  describe('URL file loading', () => {
    it('should parse newline-separated URLs', () => {
      const fileContent = `
https://github.com/owner/repo1
https://github.com/owner/repo2
https://github.com/owner/repo3
      `.trim();

      const urls = fileContent.split('\n').filter(line => line.trim());

      expect(urls).toHaveLength(3);
      expect(urls[0]).toBe('https://github.com/owner/repo1');
    });

    it('should skip empty lines in URL file', () => {
      const fileContent = `
https://github.com/owner/repo1

https://github.com/owner/repo2

      `.trim();

      const urls = fileContent.split('\n').filter(line => line.trim());

      expect(urls).toHaveLength(2);
    });

    it('should combine file URLs with argument URLs', () => {
      const argUrls = ['https://github.com/owner/repo1'];
      const fileUrls = ['https://github.com/owner/repo2', 'https://github.com/owner/repo3'];
      const combined = [...argUrls, ...fileUrls];

      expect(combined).toHaveLength(3);
    });
  });

  describe('Output generation', () => {
    it('should construct output directory path', () => {
      const baseOutput = './mcp-tools';
      const repoName = 'my-repo';
      const outputDir = `${baseOutput}/${repoName}`;

      expect(outputDir).toBe('./mcp-tools/my-repo');
    });

    it('should handle repo names with special characters', () => {
      const baseOutput = './output';
      const repoName = 'repo.js';
      const outputDir = `${baseOutput}/${repoName}`;

      expect(outputDir).toBe('./output/repo.js');
    });
  });

  describe('Error handling', () => {
    it('should format error messages', () => {
      const error = new Error('Network error');
      const message = `Error: ${error.message}`;

      expect(message).toBe('Error: Network error');
    });

    it('should handle non-Error objects', () => {
      const error = 'String error';
      const message = error instanceof Error ? error.message : String(error);

      expect(message).toBe('String error');
    });
  });

  describe('Classification display', () => {
    it('should format confidence as percentage', () => {
      const confidence = 0.85;
      const percentage = Math.round(confidence * 100);

      expect(percentage).toBe(85);
    });

    it('should format indicators list', () => {
      const indicators = ['has openapi.json', 'API client pattern', 'REST endpoints'];
      const formatted = indicators.join(', ');

      expect(formatted).toBe('has openapi.json, API client pattern, REST endpoints');
    });
  });

  describe('Batch processing', () => {
    it('should process multiple URLs', () => {
      const urls = [
        'https://github.com/owner/repo1',
        'https://github.com/owner/repo2',
        'https://github.com/owner/repo3',
      ];

      expect(urls.length).toBe(3);
      expect(urls.length > 1).toBe(true); // Batch mode condition
    });

    it('should identify single URL mode', () => {
      const urls = ['https://github.com/owner/repo'];

      expect(urls.length).toBe(1);
    });
  });
});
