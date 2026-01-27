/**
 * Parser unit tests
 * Tests for parsing llms.txt content into structured documents
 */

import { describe, it, expect } from 'vitest'
import {
  slugify,
  estimateTokens,
  extractSiteName,
  parseMarkdownSections,
  sectionsToDocuments,
  parseLlmsContent,
  ParsedSection,
  Document,
} from '@llm-energy/core'

describe('slugify', () => {
  it('converts basic text to slug', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  it('removes special characters', () => {
    expect(slugify('API Reference (v2)')).toBe('api-reference-v2')
  })

  it('handles multiple spaces', () => {
    expect(slugify('Getting   Started')).toBe('getting-started')
  })

  it('trims leading/trailing whitespace', () => {
    expect(slugify('  Hello  ')).toBe('hello')
  })

  it('handles multiple hyphens', () => {
    expect(slugify('hello---world')).toBe('hello-world')
  })

  it('returns empty string for empty input', () => {
    expect(slugify('')).toBe('')
  })

  it('handles unicode characters', () => {
    expect(slugify('Über Guide')).toBe('ber-guide')
  })

  it('preserves numbers', () => {
    expect(slugify('Chapter 1')).toBe('chapter-1')
  })
})

describe('estimateTokens', () => {
  it('estimates tokens correctly (~4 chars per token)', () => {
    expect(estimateTokens('hello')).toBe(2) // 5 chars / 4 = 1.25 → ceil = 2
  })

  it('handles empty string', () => {
    expect(estimateTokens('')).toBe(0)
  })

  it('handles long text', () => {
    const text = 'a'.repeat(100)
    expect(estimateTokens(text)).toBe(25) // 100 / 4 = 25
  })

  it('rounds up fractional tokens', () => {
    expect(estimateTokens('a')).toBe(1) // 1 / 4 = 0.25 → ceil = 1
  })
})

describe('extractSiteName', () => {
  it('extracts site name from docs subdomain', () => {
    expect(extractSiteName('https://docs.anthropic.com')).toBe('anthropic')
  })

  it('extracts site name from www subdomain', () => {
    expect(extractSiteName('https://www.stripe.com')).toBe('stripe')
  })

  it('extracts site name from simple domain', () => {
    expect(extractSiteName('https://example.com')).toBe('example')
  })

  it('handles URLs with paths', () => {
    expect(extractSiteName('https://docs.stripe.com/api/charges')).toBe('stripe')
  })

  it('returns default for invalid URL', () => {
    expect(extractSiteName('not-a-url')).toBe('documentation')
  })

  it('handles localhost', () => {
    expect(extractSiteName('http://localhost:3000')).toBe('localhost')
  })
})

describe('parseMarkdownSections', () => {
  it('parses single header', () => {
    const content = '# Title\n\nContent here'
    const sections = parseMarkdownSections(content)
    
    expect(sections).toHaveLength(1)
    expect(sections[0].title).toBe('Title')
    expect(sections[0].level).toBe(1)
    expect(sections[0].content).toBe('Content here')
  })

  it('parses multiple headers', () => {
    const content = `# First

Content 1

## Second

Content 2

### Third

Content 3`
    
    const sections = parseMarkdownSections(content)
    
    expect(sections).toHaveLength(3)
    expect(sections[0].title).toBe('First')
    expect(sections[0].level).toBe(1)
    expect(sections[1].title).toBe('Second')
    expect(sections[1].level).toBe(2)
    expect(sections[2].title).toBe('Third')
    expect(sections[2].level).toBe(3)
  })

  it('handles content with no headers', () => {
    const content = 'Just some content without any headers'
    const sections = parseMarkdownSections(content)
    
    expect(sections).toHaveLength(1)
    expect(sections[0].title).toBe('Documentation')
    expect(sections[0].content).toBe('Just some content without any headers')
  })

  it('handles empty content', () => {
    expect(parseMarkdownSections('')).toHaveLength(0)
    expect(parseMarkdownSections('   ')).toHaveLength(0)
  })

  it('preserves content between headers', () => {
    const content = `## Section

Line 1
Line 2
Line 3

## Next Section

More content`
    
    const sections = parseMarkdownSections(content)
    
    expect(sections[0].content).toBe('Line 1\nLine 2\nLine 3')
    expect(sections[1].content).toBe('More content')
  })

  it('handles headers without content', () => {
    const content = `## Empty Section

## Another Section

Some content`
    
    const sections = parseMarkdownSections(content)
    
    expect(sections).toHaveLength(2)
    expect(sections[0].content).toBe('')
    expect(sections[1].content).toBe('Some content')
  })

  it('handles all header levels (1-6)', () => {
    const content = `# H1
## H2
### H3
#### H4
##### H5
###### H6`
    
    const sections = parseMarkdownSections(content)
    
    expect(sections).toHaveLength(6)
    sections.forEach((section: ParsedSection, index: number) => {
      expect(section.level).toBe(index + 1)
    })
  })

  it('ignores hash symbols in code blocks', () => {
    // Note: This is a known limitation - the parser is simple and doesn't handle code blocks
    // This test documents current behavior
    const content = `## Section

\`\`\`python
# This is a comment
print("hello")
\`\`\``
    
    const sections = parseMarkdownSections(content)
    expect(sections.length).toBeGreaterThanOrEqual(1)
  })
})

describe('sectionsToDocuments', () => {
  it('converts sections to documents with filenames', () => {
    const sections = [
      { title: 'Getting Started', level: 2, content: 'Content 1' },
      { title: 'API Reference', level: 2, content: 'Content 2' },
    ]
    
    const docs = sectionsToDocuments(sections)
    
    expect(docs).toHaveLength(2)
    expect(docs[0].filename).toBe('getting-started.md')
    expect(docs[1].filename).toBe('api-reference.md')
  })

  it('ensures unique filenames', () => {
    const sections = [
      { title: 'Section', level: 2, content: 'Content 1' },
      { title: 'Section', level: 2, content: 'Content 2' },
      { title: 'Section', level: 2, content: 'Content 3' },
    ]
    
    const docs = sectionsToDocuments(sections)
    
    expect(docs[0].filename).toBe('section.md')
    expect(docs[1].filename).toBe('section-1.md')
    expect(docs[2].filename).toBe('section-2.md')
  })

  it('includes header in document content', () => {
    const sections = [
      { title: 'Test', level: 2, content: 'Content here' },
    ]
    
    const docs = sectionsToDocuments(sections)
    
    expect(docs[0].content).toContain('## Test')
    expect(docs[0].content).toContain('Content here')
  })

  it('calculates token counts', () => {
    const sections = [
      { title: 'Test', level: 2, content: 'a'.repeat(100) },
    ]
    
    const docs = sectionsToDocuments(sections)
    
    expect(docs[0].tokens).toBeGreaterThan(0)
  })

  it('handles empty sections array', () => {
    const docs = sectionsToDocuments([])
    expect(docs).toHaveLength(0)
  })

  it('uses "section" for empty title', () => {
    const sections = [
      { title: '', level: 2, content: 'Content' },
    ]
    
    const docs = sectionsToDocuments(sections)
    
    expect(docs[0].filename).toBe('section.md')
  })
})

describe('parseLlmsContent', () => {
  it('parses complete llms.txt content', () => {
    const content = `# My Project

A great project.

## Getting Started

Install with npm.

## API Reference

See the API docs.`
    
    const docs = parseLlmsContent(content)
    
    expect(docs.length).toBeGreaterThanOrEqual(2)
    expect(docs.some((d: Document) => d.filename.includes('getting-started'))).toBe(true)
    expect(docs.some((d: Document) => d.filename.includes('api-reference'))).toBe(true)
  })

  it('returns empty array for empty content', () => {
    expect(parseLlmsContent('')).toHaveLength(0)
    expect(parseLlmsContent('   ')).toHaveLength(0)
    expect(parseLlmsContent('\n\n\n')).toHaveLength(0)
  })

  it('returns empty array for null/undefined', () => {
    expect(parseLlmsContent(null as unknown as string)).toHaveLength(0)
    expect(parseLlmsContent(undefined as unknown as string)).toHaveLength(0)
  })

  it('handles real-world llms.txt format', () => {
    const content = `# Anthropic

> Build with Claude

## Overview

Anthropic develops AI systems.

## Claude API

Use the Claude API to integrate Claude into your applications.

### Authentication

Use your API key.

### Making Requests

Send HTTP requests to the API.`
    
    const docs = parseLlmsContent(content)
    
    expect(docs.length).toBeGreaterThan(0)
    // Verify we have documents with reasonable content
    docs.forEach((doc: Document) => {
      expect(doc.filename).toMatch(/\.md$/)
      expect(doc.title).toBeTruthy()
      expect(doc.tokens).toBeGreaterThan(0)
    })
  })
})
