/**
 * Generator unit tests
 * Tests for document generation (full doc, agent guide)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  generateFullDocument,
  generateAgentGuide,
  generateAllDocuments,
  Document,
} from '@llm-energy/core'

describe('generateFullDocument', () => {
  const mockDocuments: Document[] = [
    { filename: 'intro.md', title: 'Introduction', content: '# Introduction\n\nWelcome', tokens: 10 },
    { filename: 'getting-started.md', title: 'Getting Started', content: '## Getting Started\n\nInstall it', tokens: 15 },
  ]

  it('generates full document with title', () => {
    const result = generateFullDocument(
      mockDocuments,
      'raw content',
      'https://docs.example.com'
    )

    expect(result.filename).toBe('llms-full.md')
    expect(result.title).toContain('Example')
    expect(result.content).toContain('# Example Documentation')
  })

  it('includes table of contents', () => {
    const result = generateFullDocument(
      mockDocuments,
      'raw content',
      'https://docs.example.com'
    )

    expect(result.content).toContain('## Table of Contents')
    expect(result.content).toContain('[Introduction]')
    expect(result.content).toContain('[Getting Started]')
  })

  it('includes source URL', () => {
    const result = generateFullDocument(
      mockDocuments,
      'raw content',
      'https://docs.example.com'
    )

    expect(result.content).toContain('Source: https://docs.example.com')
  })

  it('combines all document content', () => {
    const result = generateFullDocument(
      mockDocuments,
      'raw content',
      'https://docs.example.com'
    )

    expect(result.content).toContain('# Introduction')
    expect(result.content).toContain('## Getting Started')
  })

  it('estimates tokens for full content', () => {
    const result = generateFullDocument(
      mockDocuments,
      'raw content',
      'https://docs.example.com'
    )

    expect(result.tokens).toBeGreaterThan(0)
  })

  it('handles empty documents array', () => {
    const result = generateFullDocument(
      [],
      'raw content',
      'https://docs.example.com'
    )

    expect(result.content).toBeDefined()
    expect(result.content).not.toContain('## Table of Contents')
  })
})

describe('generateAgentGuide', () => {
  const mockDocuments: Document[] = [
    { filename: 'intro.md', title: 'Introduction', content: 'Content 1', tokens: 100 },
    { filename: 'api.md', title: 'API Reference', content: 'Content 2', tokens: 200 },
    { filename: 'config.md', title: 'Configuration', content: 'Content 3', tokens: 150 },
  ]

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-16'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('generates agent guide with correct filename', () => {
    const result = generateAgentGuide(
      mockDocuments,
      'https://docs.example.com'
    )

    expect(result.filename).toBe('AGENT-GUIDE.md')
    expect(result.title).toBe('Agent Guide')
  })

  it('includes source information', () => {
    const result = generateAgentGuide(
      mockDocuments,
      'https://docs.example.com'
    )

    expect(result.content).toContain('**Original URL**: https://docs.example.com')
    expect(result.content).toContain('**Extraction Date**: 2026-01-16')
    expect(result.content).toContain('**Total Documents**: 3')
  })

  it('calculates total tokens', () => {
    const result = generateAgentGuide(
      mockDocuments,
      'https://docs.example.com'
    )

    expect(result.content).toContain('450') // 100 + 200 + 150
  })

  it('lists all included files', () => {
    const result = generateAgentGuide(
      mockDocuments,
      'https://docs.example.com'
    )

    expect(result.content).toContain('**intro.md**')
    expect(result.content).toContain('**api.md**')
    expect(result.content).toContain('**config.md**')
  })

  it('includes usage instructions', () => {
    const result = generateAgentGuide(
      mockDocuments,
      'https://docs.example.com'
    )

    expect(result.content).toContain('How to Use This Documentation')
    expect(result.content).toContain('Answer questions')
    expect(result.content).toContain('Provide code examples')
  })

  it('includes recommended reading order', () => {
    const result = generateAgentGuide(
      mockDocuments,
      'https://docs.example.com'
    )

    expect(result.content).toContain('Recommended Reading Order')
    expect(result.content).toContain('llms-full.md')
  })

  it('uses provided site name', () => {
    const result = generateAgentGuide(
      mockDocuments,
      'https://docs.example.com',
      'CustomName'
    )

    expect(result.content).toContain('CustomName') // Uses provided name
  })

  it('includes footer attribution', () => {
    const result = generateAgentGuide(
      mockDocuments,
      'https://docs.example.com'
    )

    expect(result.content).toContain('llm.energy')
  })

  it('handles many documents (truncates topic list)', () => {
    const manyDocs: Document[] = Array.from({ length: 10 }, (_, i) => ({
      filename: `doc-${i}.md`,
      title: `Document ${i}`,
      content: `Content ${i}`,
      tokens: 50,
    }))

    const result = generateAgentGuide(
      manyDocs,
      'https://docs.example.com'
    )

    expect(result.content).toContain('and more')
  })
})

describe('generateAllDocuments', () => {
  const mockDocuments: Document[] = [
    { filename: 'intro.md', title: 'Introduction', content: 'Intro content', tokens: 50 },
    { filename: 'api.md', title: 'API', content: 'API content', tokens: 100 },
  ]

  it('returns all document types', () => {
    const result = generateAllDocuments(
      mockDocuments,
      'raw content',
      'https://docs.example.com'
    )

    expect(result.documents).toBe(mockDocuments)
    expect(result.fullDocument).toBeDefined()
    expect(result.agentGuide).toBeDefined()
  })

  it('generates full document', () => {
    const result = generateAllDocuments(
      mockDocuments,
      'raw content',
      'https://docs.example.com'
    )

    expect(result.fullDocument.filename).toBe('llms-full.md')
    expect(result.fullDocument.content).toContain('Table of Contents')
  })

  it('generates agent guide', () => {
    const result = generateAllDocuments(
      mockDocuments,
      'raw content',
      'https://docs.example.com'
    )

    expect(result.agentGuide.filename).toBe('AGENT-GUIDE.md')
    expect(result.agentGuide.content).toContain('Agent Guide')
  })

  it('extracts site name from URL', () => {
    const result = generateAllDocuments(
      mockDocuments,
      'raw content',
      'https://docs.anthropic.com'
    )

    expect(result.fullDocument.title.toLowerCase()).toContain('anthropic')
    expect(result.agentGuide.content.toLowerCase()).toContain('anthropic')
  })
})
