import { slugify } from './parser'
import { generateAgentPrompt } from './prompt-generator'
import { generateMcpConfig } from './mcp-generator'

/**
 * Represents a markdown document extracted from a source
 */
export interface MarkdownDocument {
  title: string
  url: string
  content: string
  wordCount: number
}

/**
 * Generated output files structure
 */
export interface GeneratedOutputs {
  fullDocument: {
    filename: string
    content: string
    size: number
  }
  sections: Array<{
    filename: string
    content: string
    size: number
  }>
  agentPrompt: {
    filename: string
    content: string
    size: number
  }
  mcpConfig: {
    filename: string
    content: string
    size: number
  }
  readme: {
    filename: string
    content: string
    size: number
  }
}

/**
 * Calculate byte size of a string (works in both browser and Node.js)
 */
function getByteSize(content: string): number {
  if (typeof Blob !== 'undefined') {
    return new Blob([content]).size
  }
  // Fallback for Node.js environment
  return Buffer.byteLength(content, 'utf8')
}

/**
 * Generate all output files from extracted documents
 */
export function generateOutputs(
  documents: MarkdownDocument[],
  sourceUrl: string,
  siteName: string
): GeneratedOutputs {
  // 1. Full Document - All content in one file
  const fullContent = generateFullDocument(documents, sourceUrl, siteName)

  // 2. Individual Sections
  const sections = documents.map((doc, index) => {
    const sectionContent = formatSection(doc)
    return {
      filename: `${String(index + 1).padStart(2, '0')}-${slugify(doc.title)}.md`,
      content: sectionContent,
      size: getByteSize(sectionContent),
    }
  })

  // 3. Agent Prompt
  const agentPromptContent = generateAgentPrompt(documents, sourceUrl, siteName)

  // 4. MCP Config
  const mcpConfigContent = generateMcpConfig(sourceUrl, siteName)

  // 5. README
  const readmeContent = generateReadme(documents, sourceUrl, siteName)

  return {
    fullDocument: {
      filename: 'FULL-DOCUMENTATION.md',
      content: fullContent,
      size: getByteSize(fullContent),
    },
    sections,
    agentPrompt: {
      filename: 'AGENT-PROMPT.md',
      content: agentPromptContent,
      size: getByteSize(agentPromptContent),
    },
    mcpConfig: {
      filename: 'mcp-config.json',
      content: mcpConfigContent,
      size: getByteSize(mcpConfigContent),
    },
    readme: {
      filename: 'README.md',
      content: readmeContent,
      size: getByteSize(readmeContent),
    },
  }
}

/**
 * Generate the full consolidated documentation file
 */
function generateFullDocument(
  documents: MarkdownDocument[],
  sourceUrl: string,
  siteName: string
): string {
  const header = `# ${siteName} Documentation

> Extracted from ${sourceUrl}
> Generated on ${new Date().toISOString().split('T')[0]}
> Total sections: ${documents.length}

---

## Table of Contents

${documents.map((doc, i) => `${i + 1}. [${doc.title}](#${slugify(doc.title)})`).join('\n')}

---

`

  const body = documents
    .map(
      (doc) => `
## ${doc.title}

${doc.content}

---
`
    )
    .join('\n')

  return header + body
}

/**
 * Format a single document section
 */
function formatSection(doc: MarkdownDocument): string {
  return `# ${doc.title}

> Source: ${doc.url}

${doc.content}
`
}

/**
 * Generate the README file for the documentation package
 */
function generateReadme(
  documents: MarkdownDocument[],
  sourceUrl: string,
  siteName: string
): string {
  const totalWords = documents.reduce((sum, d) => sum + d.wordCount, 0)

  return `# ${siteName} Documentation Package

This documentation package was extracted from [${sourceUrl}](${sourceUrl}) using [llm.energy](https://llm.energy).

## Contents

- \`FULL-DOCUMENTATION.md\` - Complete documentation in a single file
- \`AGENT-PROMPT.md\` - Instructions for AI assistants (Claude, ChatGPT)
- \`mcp-config.json\` - Model Context Protocol configuration
- \`sections/\` - Individual documentation sections (${documents.length} files)

## Usage

### With Claude/ChatGPT
1. Upload \`FULL-DOCUMENTATION.md\` to your conversation
2. Optionally include \`AGENT-PROMPT.md\` for better context

### With MCP-Compatible Apps
1. Copy \`mcp-config.json\` to your MCP configuration
2. Point the docs-path to this folder

## Statistics

- **Total Sections:** ${documents.length}
- **Total Words:** ${totalWords.toLocaleString()}
- **Extracted:** ${new Date().toISOString().split('T')[0]}

---

*Powered by [llm.energy](https://llm.energy) - Extract documentation for AI agents*
`
}

/**
 * Convert existing Document type to MarkdownDocument
 */
export function convertToMarkdownDocument(
  doc: { title: string; content: string; filename: string },
  url: string
): MarkdownDocument {
  const wordCount = doc.content.split(/\s+/).filter(Boolean).length
  return {
    title: doc.title,
    url,
    content: doc.content,
    wordCount,
  }
}
