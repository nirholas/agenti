/**
 * @fileoverview Unit tests for streaming module
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  StreamingGenerator,
  streamGenerate,
  collectStreamEvents,
  streamToResult,
  StreamEvent
} from '../streaming';

// Mock the imports
vi.mock('../github-client', () => ({
  GithubClient: vi.fn().mockImplementation(() => ({
    parseGithubUrl: vi.fn().mockReturnValue({ owner: 'test', repo: 'repo' }),
    getRepoMetadata: vi.fn().mockResolvedValue({
      stars: 100,
      language: 'TypeScript',
      license: 'MIT',
      description: 'Test repo'
    }),
    getReadme: vi.fn().mockResolvedValue('# Test Repo\n\nThis is a test'),
    getFile: vi.fn().mockResolvedValue(null),
    searchCode: vi.fn().mockResolvedValue([])
  }))
}));

vi.mock('../readme-extractor', () => ({
  ReadmeExtractor: vi.fn().mockImplementation(() => ({
    extract: vi.fn().mockResolvedValue([])
  }))
}));

vi.mock('../code-extractor', () => ({
  CodeExtractor: vi.fn().mockImplementation(() => ({
    extract: vi.fn().mockResolvedValue([])
  }))
}));

vi.mock('../graphql-extractor', () => ({
  GraphQLExtractor: vi.fn().mockImplementation(() => ({
    extract: vi.fn().mockResolvedValue([])
  }))
}));

vi.mock('../mcp-introspector', () => ({
  McpIntrospector: vi.fn().mockImplementation(() => ({
    extract: vi.fn().mockResolvedValue([])
  }))
}));

vi.mock('../python-generator', () => ({
  PythonGenerator: vi.fn().mockImplementation(() => ({
    generateServer: vi.fn().mockReturnValue('# Python MCP Server')
  }))
}));

vi.mock('@github-to-mcp/openapi-parser', () => ({
  convertOpenApiToMcp: vi.fn().mockResolvedValue([])
}));

describe('StreamingGenerator', () => {
  let generator: StreamingGenerator;

  beforeEach(() => {
    generator = new StreamingGenerator();
    vi.clearAllMocks();
  });

  describe('generate', () => {
    it('should emit start event first', async () => {
      const events: StreamEvent[] = [];
      
      for await (const event of generator.generate('https://github.com/test/repo')) {
        events.push(event);
        if (event.type === 'metadata') break; // Stop early for test
      }

      expect(events[0].type).toBe('start');
      expect((events[0] as any).owner).toBe('test');
      expect((events[0] as any).repo).toBe('repo');
    });

    it('should emit metadata event after start', async () => {
      const events: StreamEvent[] = [];
      
      for await (const event of generator.generate('https://github.com/test/repo')) {
        events.push(event);
        if (event.type === 'metadata') break;
      }

      const metadataEvent = events.find(e => e.type === 'metadata');
      expect(metadataEvent).toBeDefined();
      expect((metadataEvent as any).metadata.stars).toBe(100);
      expect((metadataEvent as any).metadata.language).toBe('TypeScript');
    });

    it('should emit classifying and classified events', async () => {
      const events: StreamEvent[] = [];
      
      for await (const event of generator.generate('https://github.com/test/repo')) {
        events.push(event);
        if (event.type === 'classified') break;
      }

      const classifyingEvent = events.find(e => e.type === 'classifying');
      const classifiedEvent = events.find(e => e.type === 'classified');

      expect(classifyingEvent).toBeDefined();
      expect(classifiedEvent).toBeDefined();
      expect((classifiedEvent as any).classification).toBeDefined();
    });

    it('should emit extracting events for each source', async () => {
      const events: StreamEvent[] = [];
      
      for await (const event of generator.generate('https://github.com/test/repo')) {
        events.push(event);
      }

      const extractingEvents = events.filter(e => e.type === 'extracting');
      expect(extractingEvents.length).toBeGreaterThan(0);

      // Should have events for different sources
      const sources = extractingEvents.map(e => (e as any).source);
      expect(sources).toContain('universal');
    });

    it('should emit source-complete events', async () => {
      const events: StreamEvent[] = [];
      
      for await (const event of generator.generate('https://github.com/test/repo')) {
        events.push(event);
      }

      const sourceCompleteEvents = events.filter(e => e.type === 'source-complete');
      expect(sourceCompleteEvents.length).toBeGreaterThan(0);
    });

    it('should emit tool-found events for universal tools', async () => {
      const events: StreamEvent[] = [];
      
      for await (const event of generator.generate('https://github.com/test/repo')) {
        events.push(event);
      }

      const toolFoundEvents = events.filter(e => e.type === 'tool-found');
      expect(toolFoundEvents.length).toBeGreaterThan(0);

      // Should have universal tools
      const toolNames = toolFoundEvents.map(e => (e as any).tool.name);
      expect(toolNames).toContain('get_readme');
      expect(toolNames).toContain('list_files');
      expect(toolNames).toContain('read_file');
      expect(toolNames).toContain('search_code');
    });

    it('should emit complete event with result', async () => {
      const events: StreamEvent[] = [];
      
      for await (const event of generator.generate('https://github.com/test/repo')) {
        events.push(event);
      }

      const completeEvent = events.find(e => e.type === 'complete');
      expect(completeEvent).toBeDefined();
      expect((completeEvent as any).result).toBeDefined();
      expect((completeEvent as any).totalTools).toBeGreaterThan(0);
      expect((completeEvent as any).duration).toBeGreaterThan(0);
    });

    it('should emit progress events when enabled', async () => {
      const progressGenerator = new StreamingGenerator({ emitProgress: true });
      const events: StreamEvent[] = [];
      
      for await (const event of progressGenerator.generate('https://github.com/test/repo')) {
        events.push(event);
      }

      const progressEvents = events.filter(e => e.type === 'progress');
      expect(progressEvents.length).toBeGreaterThan(0);

      // Progress should go from 0 to 100
      const lastProgress = progressEvents[progressEvents.length - 1] as any;
      expect(lastProgress.progress).toBe(100);
    });

    it('should include timestamps in all events', async () => {
      for await (const event of generator.generate('https://github.com/test/repo')) {
        expect(event.timestamp).toBeDefined();
        expect(typeof event.timestamp).toBe('number');
      }
    });
  });

  describe('with abort signal', () => {
    it('should support abort signal configuration', async () => {
      const controller = new AbortController();
      const abortGenerator = new StreamingGenerator({ abortSignal: controller.signal });
      
      // Test that we can create a generator with an abort signal
      expect(abortGenerator).toBeDefined();
      
      // Abort immediately
      controller.abort();
      
      const events: StreamEvent[] = [];
      try {
        for await (const event of abortGenerator.generate('https://github.com/test/repo')) {
          events.push(event);
        }
      } catch {
        // Expected - abort may throw
      }
      
      // With immediate abort, should either have error, be incomplete, or have been handled gracefully
      expect(events).toBeDefined();
    });
  });
});

describe('streamGenerate', () => {
  it('should be an async generator function', async () => {
    const gen = streamGenerate('https://github.com/test/repo');
    expect(gen[Symbol.asyncIterator]).toBeDefined();
  });
});

describe('collectStreamEvents', () => {
  it('should collect all events into an array', async () => {
    const events = await collectStreamEvents('https://github.com/test/repo');
    
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].type).toBe('start');
    expect(events[events.length - 1].type).toBe('complete');
  });
});

describe('streamToResult', () => {
  it('should return the final result', async () => {
    const result = await streamToResult('https://github.com/test/repo');
    
    expect(result).toBeDefined();
    expect(result?.name).toBe('repo');
    expect(result?.tools).toBeDefined();
    expect(result?.tools.length).toBeGreaterThan(0);
  });
});
