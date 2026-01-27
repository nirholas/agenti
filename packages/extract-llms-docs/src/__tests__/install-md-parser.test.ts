import { describe, it, expect } from 'vitest'
import { 
  parseInstallMd, 
  isValidInstallMd, 
  getInstallMdSummary 
} from '@/lib/install-md-parser'

const VALID_INSTALL_MD = `# mintlify

> Documentation and setup instructions for mintlify

I want you to install Mintlify CLI for me. Execute all the steps below autonomously.

OBJECTIVE: Install the Mintlify CLI and set up a local documentation preview environment.

DONE WHEN: Local documentation server is running and accessible at http://localhost:3000.

## TODO

- [ ] Verify Node.js v20.17.0+ is installed
- [ ] Install the Mintlify CLI globally
- [ ] Create a new documentation project
- [ ] Start the local development server
- [ ] Verify the preview is accessible at localhost:3000

## Prerequisites

You need to have Node.js v20.17.0 or higher installed. Verify your Node.js version:

\`\`\`bash
node --version
\`\`\`

## Install the CLI

You need to install the Mintlify CLI globally using npm or pnpm.

Using npm:

\`\`\`bash
npm i -g mint
\`\`\`

Using pnpm:

\`\`\`bash
pnpm add -g mint
\`\`\`

## Verify installation

Verify the installation:

\`\`\`bash
mint --version
\`\`\`

EXECUTE NOW: Complete the above TODO list to achieve: Local documentation server is running and accessible at http://localhost:3000.
`

const MINIMAL_INSTALL_MD = `# my-tool

OBJECTIVE: Install the tool.

DONE WHEN: Tool is installed.

## TODO

- [ ] Install it

## Install

\`\`\`bash
npm install my-tool
\`\`\`

EXECUTE NOW: Complete the TODO list.
`

const INVALID_INSTALL_MD = `# Some Random Document

This is just a regular markdown file without install.md format.

## Section 1

Some content here.
`

describe('install-md-parser', () => {
  describe('isValidInstallMd', () => {
    it('should return true for valid install.md content', () => {
      expect(isValidInstallMd(VALID_INSTALL_MD)).toBe(true)
    })

    it('should return true for minimal valid install.md', () => {
      expect(isValidInstallMd(MINIMAL_INSTALL_MD)).toBe(true)
    })

    it('should return false for invalid content', () => {
      expect(isValidInstallMd(INVALID_INSTALL_MD)).toBe(false)
    })

    it('should return false for empty content', () => {
      expect(isValidInstallMd('')).toBe(false)
    })

    it('should return false for content without OBJECTIVE', () => {
      const content = `# test\n\nDONE WHEN: something\n\n## TODO\n\n- [ ] item`
      expect(isValidInstallMd(content)).toBe(false)
    })

    it('should return false for content without DONE WHEN', () => {
      const content = `# test\n\nOBJECTIVE: something\n\n## TODO\n\n- [ ] item`
      expect(isValidInstallMd(content)).toBe(false)
    })

    it('should return false for content without TODO section', () => {
      const content = `# test\n\nOBJECTIVE: something\n\nDONE WHEN: something`
      expect(isValidInstallMd(content)).toBe(false)
    })
  })

  describe('parseInstallMd', () => {
    it('should parse product name from H1 header', () => {
      const parsed = parseInstallMd(VALID_INSTALL_MD)
      expect(parsed.productName).toBe('mintlify')
    })

    it('should parse description from blockquote', () => {
      const parsed = parseInstallMd(VALID_INSTALL_MD)
      expect(parsed.description).toBe('Documentation and setup instructions for mintlify')
    })

    it('should parse OBJECTIVE', () => {
      const parsed = parseInstallMd(VALID_INSTALL_MD)
      expect(parsed.objective).toBe('Install the Mintlify CLI and set up a local documentation preview environment.')
    })

    it('should parse DONE WHEN', () => {
      const parsed = parseInstallMd(VALID_INSTALL_MD)
      expect(parsed.doneWhen).toBe('Local documentation server is running and accessible at http://localhost:3000.')
    })

    it('should parse TODO items', () => {
      const parsed = parseInstallMd(VALID_INSTALL_MD)
      expect(parsed.todoItems).toHaveLength(5)
      expect(parsed.todoItems[0].text).toBe('Verify Node.js v20.17.0+ is installed')
      expect(parsed.todoItems[0].completed).toBe(false)
    })

    it('should parse completed TODO items', () => {
      const content = `# test\n\nOBJECTIVE: test\n\nDONE WHEN: done\n\n## TODO\n\n- [x] completed item\n- [ ] incomplete item\n\nEXECUTE NOW: do it`
      const parsed = parseInstallMd(content)
      expect(parsed.todoItems[0].completed).toBe(true)
      expect(parsed.todoItems[1].completed).toBe(false)
    })

    it('should parse step sections', () => {
      const parsed = parseInstallMd(VALID_INSTALL_MD)
      expect(parsed.steps.length).toBeGreaterThan(0)
      expect(parsed.steps.some(s => s.title === 'Prerequisites')).toBe(true)
      expect(parsed.steps.some(s => s.title === 'Install the CLI')).toBe(true)
    })

    it('should parse code blocks in steps', () => {
      const parsed = parseInstallMd(VALID_INSTALL_MD)
      const installStep = parsed.steps.find(s => s.title === 'Install the CLI')
      expect(installStep).toBeDefined()
      expect(installStep!.codeBlocks.length).toBeGreaterThan(0)
      expect(installStep!.codeBlocks[0].language).toBe('bash')
    })

    it('should mark valid content as valid', () => {
      const parsed = parseInstallMd(VALID_INSTALL_MD)
      expect(parsed.isValid).toBe(true)
      expect(parsed.validationErrors).toHaveLength(0)
    })

    it('should report validation errors for incomplete content', () => {
      const parsed = parseInstallMd('# test\n\nSome content')
      expect(parsed.isValid).toBe(false)
      expect(parsed.validationErrors.length).toBeGreaterThan(0)
    })

    it('should preserve raw content', () => {
      const parsed = parseInstallMd(VALID_INSTALL_MD)
      expect(parsed.raw).toBe(VALID_INSTALL_MD)
    })
  })

  describe('getInstallMdSummary', () => {
    it('should return a summary of parsed content', () => {
      const parsed = parseInstallMd(VALID_INSTALL_MD)
      const summary = getInstallMdSummary(parsed)
      
      expect(summary.productName).toBe('mintlify')
      expect(summary.objective).toContain('Install the Mintlify CLI')
      expect(summary.todoCount).toBe(5)
      expect(summary.stepCount).toBeGreaterThan(0)
      expect(summary.hasCodeBlocks).toBe(true)
    })

    it('should detect when no code blocks exist', () => {
      const content = `# test\n\nOBJECTIVE: test\n\nDONE WHEN: done\n\n## TODO\n\n- [ ] item\n\n## Step\n\nNo code here\n\nEXECUTE NOW: do it`
      const parsed = parseInstallMd(content)
      const summary = getInstallMdSummary(parsed)
      
      expect(summary.hasCodeBlocks).toBe(false)
    })
  })
})
