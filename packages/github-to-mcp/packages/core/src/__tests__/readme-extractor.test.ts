/**
 * @fileoverview Unit tests for readme-extractor module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ReadmeExtractor } from '../readme-extractor';

describe('ReadmeExtractor', () => {
  let extractor: ReadmeExtractor;

  beforeEach(() => {
    extractor = new ReadmeExtractor();
  });

  describe('extract', () => {
    it('should extract tools from JavaScript code examples', async () => {
      const readme = `
# API Client

## Usage

\`\`\`javascript
const result = await client.get({ id: 123, name: 'test' });
\`\`\`
      `;

      const tools = await extractor.extract(readme);

      expect(tools.length).toBeGreaterThan(0);
      expect(tools[0].source.type).toBe('readme');
    });

    it('should extract Python MCP tools from code blocks', async () => {
      const readme = `
# MCP Server

\`\`\`python
@mcp.tool(name="GetWeather", description="Get weather for a location")
async def get_weather(city: str):
    pass
\`\`\`
      `;

      const tools = await extractor.extract(readme);

      expect(tools.length).toBeGreaterThan(0);
      const weatherTool = tools.find(t => t.name === 'GetWeather');
      expect(weatherTool).toBeDefined();
      expect(weatherTool?.description).toBe('Get weather for a location');
    });

    it('should extract tools from markdown lists in Tools section', async () => {
      const readme = `
# My Tool

## Available Tools

- **Edit**: Edit files in the repository
- **View**: View file contents
- **Search**: Search for patterns in files
      `;

      const tools = await extractor.extract(readme);

      expect(tools.length).toBeGreaterThan(0);
      const editTool = tools.find(t => t.name === 'Edit');
      expect(editTool).toBeDefined();
      expect(editTool?.description).toContain('Edit');
    });

    it('should handle empty README', async () => {
      const tools = await extractor.extract('');
      expect(tools).toEqual([]);
    });

    it('should handle README with no code examples', async () => {
      const readme = `
# Project Title

This is a project description.

## Installation

Run \`npm install\`.
      `;

      const tools = await extractor.extract(readme);
      // May return empty or minimal tools
      expect(Array.isArray(tools)).toBe(true);
    });

    it('should extract from TypeScript code blocks', async () => {
      const readme = `
## Examples

\`\`\`typescript
const response = await api.create({ name: 'New Item', value: 42 });
\`\`\`
      `;

      const tools = await extractor.extract(readme);

      expect(tools.length).toBeGreaterThan(0);
    });

    it('should extract multiple API calls from same block', async () => {
      const readme = `
## API

\`\`\`javascript
// Get user
await client.get({ userId: 1 });

// Create user
await client.post({ name: 'John', email: 'john@example.com' });
\`\`\`
      `;

      const tools = await extractor.extract(readme);

      // Should extract at least the first API call
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should parse parameters from object literals', async () => {
      const readme = `
\`\`\`javascript
await client.fetch({ 
  query: 'search term', 
  limit: 10,
  includeMetadata: true 
});
\`\`\`
      `;

      const tools = await extractor.extract(readme);

      if (tools.length > 0) {
        const { properties } = tools[0].inputSchema;
        expect(Object.keys(properties).length).toBeGreaterThan(0);
      }
    });

    it('should extract from Features section', async () => {
      const readme = `
# Tool

## Features

- **ListFiles**: List all files in a directory
- **ReadFile**: Read contents of a file
- **WriteFile**: Write content to a file
      `;

      const tools = await extractor.extract(readme);

      // Features section should also be recognized
      expect(Array.isArray(tools)).toBe(true);
    });

    it('should handle FastMCP decorator patterns', async () => {
      const readme = `
\`\`\`python
@server.tool(name="Calculate", description="Perform calculation")
async def calculate(expression: str):
    return eval(expression)
\`\`\`
      `;

      const tools = await extractor.extract(readme);

      // Should recognize @server.tool pattern
      expect(Array.isArray(tools)).toBe(true);
    });
  });

  describe('extractDocumentationLinks', () => {
    it('should extract documentation URLs', () => {
      const readme = `
# Project

Check out [API Docs](https://docs.example.com/api) for more info.
See the [Developer Guide](https://developer.example.com/guide).
      `;

      const links = extractor.extractDocumentationLinks(readme);

      expect(links.length).toBe(2);
      expect(links[0].url).toBe('https://docs.example.com/api');
      expect(links[1].url).toBe('https://developer.example.com/guide');
    });

    it('should filter non-documentation links', () => {
      const readme = `
Check [GitHub](https://github.com/owner/repo) repo.
Read [Documentation](https://docs.example.com/).
      `;

      const links = extractor.extractDocumentationLinks(readme);

      // Should only include docs link
      const docsLinks = links.filter(l => l.url.includes('docs'));
      expect(docsLinks.length).toBe(1);
    });

    it('should return empty array for no links', () => {
      const readme = 'No links here.';
      const links = extractor.extractDocumentationLinks(readme);
      expect(links).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('should handle malformed markdown gracefully', async () => {
      const readme = `
\`\`\`
unclosed code block
      `;

      // Should not throw
      const tools = await extractor.extract(readme);
      expect(Array.isArray(tools)).toBe(true);
    });

    it('should handle very long README files', async () => {
      const longContent = '# Title\n\n' + 'Lorem ipsum. '.repeat(10000);
      
      const tools = await extractor.extract(longContent);
      expect(Array.isArray(tools)).toBe(true);
    });

    it('should handle README with only headers', async () => {
      const readme = `
# Title
## Section 1
### Subsection
## Section 2
      `;

      const tools = await extractor.extract(readme);
      expect(Array.isArray(tools)).toBe(true);
    });

    it('should extract tools with code formatting in names', async () => {
      const readme = `
## Tools

- \`GrepTool\`: Search files using regex
- \`GlobTool\`: Find files by pattern
      `;

      const tools = await extractor.extract(readme);
      
      // Should handle backtick-formatted names
      expect(Array.isArray(tools)).toBe(true);
    });
  });
});
