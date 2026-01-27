'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import { ArrowLeft, Download, FileText, Check, Loader2, AlertCircle, Copy } from 'lucide-react';
import Link from 'next/link';
import JSZip from 'jszip';

interface SplitDocument {
  filename: string;
  title: string;
  content: string;
  order: number;
}

interface SplitResult {
  siteName: string;
  sourceUrl: string;
  totalPages: number;
  documents: SplitDocument[];
  manifest: { filename: string; title: string; order: number }[];
}

function ExtractPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const url = searchParams.get('url');
  
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<SplitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<SplitDocument | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (url && status === 'idle') {
      fetchDocs(url);
    }
  }, [url, status]);

  const fetchDocs = async (targetUrl: string) => {
    setStatus('loading');
    setError(null);
    
    try {
      const apiUrl = '/api/split?url=' + encodeURIComponent(targetUrl);
      const response = await fetch(apiUrl);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to extract documentation');
      }
      
      setResult(data);
      setStatus('success');
      
      if (data.documents?.length > 0) {
        setSelectedDoc(data.documents[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed');
      setStatus('error');
    }
  };

  const downloadFile = (doc: SplitDocument) => {
    const blob = new Blob([doc.content], { type: 'text/markdown' });
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = doc.filename;
    a.click();
    URL.revokeObjectURL(downloadUrl);
  };

  // Generate ChatGPT paste-ready context
  const generateChatGPTContext = (data: SplitResult): string => {
    const toc = data.documents
      .map((d, i) => `${i + 1}. ${d.title}`)
      .join('\n');
    
    const content = data.documents
      .map(d => `## ${d.title}\n\n${d.content}`)
      .join('\n\n---\n\n');

    return `=== ${data.siteName.toUpperCase()} DOCUMENTATION ===

Use this documentation to answer questions about ${data.siteName}.
When asked about ${data.siteName}, reference this documentation.

--- TABLE OF CONTENTS ---
${toc}

--- DOCUMENTATION ---
${content}
`;
  };

  // Generate Custom GPT instructions template
  const generateCustomGPTInstructions = (data: SplitResult): string => {
    return `# Custom GPT Instructions for ${data.siteName}

## Name
${data.siteName} Documentation Assistant

## Description
An AI assistant specialized in ${data.siteName} documentation. Ask questions about features, APIs, configuration, and best practices.

## Instructions
You are a helpful assistant specialized in ${data.siteName} documentation.

### Your Role
- Answer questions about ${data.siteName} based on the provided documentation
- Provide accurate code examples and configuration snippets
- Guide users through setup, configuration, and troubleshooting
- Reference specific documentation sections when answering

### Guidelines
1. Always base your answers on the provided documentation
2. If information isn't in the docs, clearly state that
3. Provide code examples when relevant
4. Be concise but thorough
5. Ask clarifying questions if the user's intent is unclear

### Knowledge Base
The documentation was extracted from: ${data.sourceUrl}
Total pages: ${data.totalPages}

### Available Topics
${data.documents.map(d => `- ${d.title}`).join('\n')}

## Conversation Starters
- "How do I get started with ${data.siteName}?"
- "What are the main features of ${data.siteName}?"
- "Show me an example of..."
- "How do I configure..."
`;
  };

  // Generate Custom GPT JSON template
  const generateCustomGPTJSON = (data: SplitResult): string => {
    const instructions = `You are a helpful assistant specialized in ${data.siteName} documentation. Answer questions based on the provided knowledge base. Always reference specific documentation when answering. If information isn't available in the docs, clearly state that.`;
    
    return JSON.stringify({
      name: `${data.siteName} Assistant`,
      description: `AI assistant for ${data.siteName} documentation. Ask questions about features, APIs, and configuration.`,
      instructions: instructions,
      conversation_starters: [
        `How do I get started with ${data.siteName}?`,
        `What are the main features?`,
        `Show me a code example`,
        `How do I configure this?`
      ],
      knowledge: {
        source_url: data.sourceUrl,
        total_pages: data.totalPages,
        documents: data.documents.map(d => ({
          title: d.title,
          filename: d.filename
        }))
      }
    }, null, 2);
  };

  // Generate DeepSeek paste-ready context
  const generateDeepSeekContext = (data: SplitResult): string => {
    const toc = data.documents
      .map((d, i) => `${i + 1}. ${d.title}`)
      .join('\n');
    
    const content = data.documents
      .map(d => `### ${d.title}\n\n${d.content}`)
      .join('\n\n---\n\n');

    return `# ${data.siteName} Documentation Reference

> Source: ${data.sourceUrl}
> Pages: ${data.totalPages}

## Instructions
Use this documentation to provide accurate answers about ${data.siteName}.
Always cite the relevant section when answering questions.
If information is not found in this documentation, clearly indicate that.

## Table of Contents
${toc}

## Full Documentation

${content}
`;
  };

  // Generate Gemini paste-ready context
  const generateGeminiContext = (data: SplitResult): string => {
    const toc = data.documents
      .map((d, i) => `${i + 1}. ${d.title}`)
      .join('\n');
    
    const content = data.documents
      .map(d => `## ${d.title}\n\n${d.content}`)
      .join('\n\n---\n\n');

    return `# ${data.siteName} Documentation

**Source:** ${data.sourceUrl}
**Total Pages:** ${data.totalPages}
**Extracted:** ${new Date().toISOString().split('T')[0]}

---

## How to Use This Documentation

This is the complete documentation for ${data.siteName}. Use it to:
- Answer questions about ${data.siteName} features and capabilities
- Provide accurate code examples and configurations
- Guide users through setup and troubleshooting

---

## Table of Contents

${toc}

---

## Documentation Content

${content}
`;
  };

  // Generate NotebookLM-optimized sources document
  const generateNotebookLMSources = (data: SplitResult): string => {
    return `# ${data.siteName} - NotebookLM Source Document

## About This Document
This document contains the complete documentation for ${data.siteName}, formatted for optimal use with Google NotebookLM.

**Source URL:** ${data.sourceUrl}
**Total Sections:** ${data.totalPages}
**Generated:** ${new Date().toISOString().split('T')[0]}

---

## Document Index

${data.documents.map((d, i) => `### ${i + 1}. ${d.title}
${d.content.split('\n').slice(0, 3).join('\n')}...

`).join('\n')}

---

## Complete Documentation

${data.documents.map(d => `# ${d.title}

${d.content}

---
`).join('\n')}

## Key Topics for Reference

${data.documents.map(d => `- **${d.title}**`).join('\n')}
`;
  };

  // Generate Cursor rules file (.cursorrules)
  const generateCursorRules = (data: SplitResult): string => {
    const keyConceptsList = data.documents
      .slice(0, 10)
      .map(d => `- ${d.title}`)
      .join('\n');
    
    const contentSummary = data.documents
      .slice(0, 5)
      .map(d => {
        const firstParagraph = d.content.split('\n\n')[0]?.slice(0, 150) || '';
        return `### ${d.title}\n${firstParagraph}...`;
      })
      .join('\n\n');

    return `# ${data.siteName} Documentation Context

You have access to ${data.siteName} documentation. Use it to provide accurate answers.

## Source
- URL: ${data.sourceUrl}
- Total Pages: ${data.totalPages}
- Generated: ${new Date().toISOString().split('T')[0]}

## Key Concepts
${keyConceptsList}

## Guidelines
- Reference specific documentation sections when answering
- Use code examples from the docs when available
- Be precise with API names, function signatures, and configuration options
- When uncertain, indicate which documentation section might contain more details
- Prefer official patterns and best practices from the documentation

## Content Summary
${contentSummary}

## Available Documentation Sections
${data.documents.map((d, i) => `${i + 1}. ${d.title}`).join('\n')}
`;
  };

  // Generate Windsurf rules file (.windsurfrules)
  const generateWindsurfRules = (data: SplitResult): string => {
    const keyConceptsList = data.documents
      .slice(0, 10)
      .map(d => `- ${d.title}`)
      .join('\n');
    
    const contentSummary = data.documents
      .slice(0, 5)
      .map(d => {
        const firstParagraph = d.content.split('\n\n')[0]?.slice(0, 150) || '';
        return `### ${d.title}\n${firstParagraph}...`;
      })
      .join('\n\n');

    return `# ${data.siteName} Documentation Context

You have access to ${data.siteName} documentation. Use it to provide accurate answers.

## Source
- URL: ${data.sourceUrl}
- Total Pages: ${data.totalPages}
- Generated: ${new Date().toISOString().split('T')[0]}

## Key Concepts
${keyConceptsList}

## Coding Guidelines
- Reference specific documentation sections when answering questions
- Use code examples from the docs when available
- Follow the patterns and conventions demonstrated in the documentation
- Be precise with API names, function signatures, and configuration options
- When implementing features, check the documentation for best practices
- Indicate which documentation section contains relevant details

## Content Summary
${contentSummary}

## Available Documentation Sections
${data.documents.map((d, i) => `${i + 1}. ${d.title}`).join('\n')}
`;
  };

  // Generate Cursor MCP configuration
  const generateCursorMCPConfig = (data: SplitResult): string => {
    const safeName = data.siteName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    
    return JSON.stringify({
      mcpServers: {
        [`${safeName}-docs`]: {
          command: "npx",
          args: [
            "-y",
            "@anthropic-ai/mcp-server-filesystem",
            "./docs"
          ],
          description: `MCP server for ${data.siteName} documentation`,
          env: {}
        }
      },
      _comments: {
        setup: [
          `1. Place your ${data.siteName} documentation files in a 'docs' folder`,
          "2. Add this configuration to your Cursor MCP settings",
          "3. Restart Cursor to enable the MCP server",
          `4. The AI will have access to ${data.siteName} documentation via MCP`
        ],
        source: data.sourceUrl,
        totalPages: data.totalPages,
        generated: new Date().toISOString().split('T')[0]
      }
    }, null, 2);
  };

  // Generate CLAUDE.md for Claude Projects
  const generateClaudeMD = (data: SplitResult): string => {
    const toc = data.documents
      .map((d, i) => `${i + 1}. **${d.title}** - ${d.content.split('\n')[0]?.slice(0, 80) || 'Documentation'}...`)
      .join('\n');
    
    const fullContent = data.documents
      .map(d => `## ${d.title}\n\n${d.content}`)
      .join('\n\n---\n\n');

    return `# ${data.siteName} Documentation

> This file is optimized for Claude Projects. Add it to your project's knowledge base.

## Source Information
- **URL:** ${data.sourceUrl}
- **Pages:** ${data.totalPages}
- **Extracted:** ${new Date().toISOString().split('T')[0]}

## How to Use This Documentation

When answering questions about ${data.siteName}:
1. Reference specific sections from this documentation
2. Provide code examples when available
3. If information isn't found here, clearly state that
4. Use the exact terminology from the documentation

## Available Documentation

${toc}

---

# Full Documentation

${fullContent}
`;
  };

  // Generate Claude Desktop MCP config
  const generateClaudeDesktopConfig = (data: SplitResult): string => {
    const safeName = data.siteName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    
    return JSON.stringify({
      mcpServers: {
        [`${safeName}-docs`]: {
          command: "node",
          args: ["./mcp-server/index.js"],
          env: {}
        }
      }
    }, null, 2);
  };

  // Generate MCP Server package.json
  const generateMCPPackageJson = (data: SplitResult): string => {
    const safeName = data.siteName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    
    return JSON.stringify({
      name: `${safeName}-docs-mcp`,
      version: "1.0.0",
      description: `MCP server for ${data.siteName} documentation`,
      main: "index.js",
      type: "module",
      scripts: {
        start: "node index.js",
        build: "tsc"
      },
      dependencies: {
        "@modelcontextprotocol/sdk": "^1.0.0"
      },
      devDependencies: {
        "@types/node": "^20.0.0",
        "typescript": "^5.0.0"
      }
    }, null, 2);
  };

  // Generate MCP Server index.ts
  const generateMCPServerIndex = (data: SplitResult): string => {
    const docsArray = data.documents.map(d => ({
      title: d.title,
      filename: d.filename,
      content: d.content.slice(0, 500) + '...' // Truncate for template
    }));

    return `import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// ${data.siteName} Documentation MCP Server
// Source: ${data.sourceUrl}

const DOCS = ${JSON.stringify(docsArray, null, 2)};

const server = new McpServer({
  name: "${data.siteName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-docs",
  version: "1.0.0"
});

// List available documentation pages
server.tool(
  "list_docs",
  "List all available ${data.siteName} documentation pages",
  {},
  async () => {
    const pages = DOCS.map((d, i) => \`\${i + 1}. \${d.title}\`).join("\\n");
    return { content: [{ type: "text", text: pages }] };
  }
);

// Search documentation
server.tool(
  "search_docs",
  "Search ${data.siteName} documentation for a specific topic",
  {
    query: { type: "string", description: "Search query" }
  },
  async ({ query }) => {
    const results = DOCS.filter(d => 
      d.title.toLowerCase().includes(query.toLowerCase()) ||
      d.content.toLowerCase().includes(query.toLowerCase())
    );
    
    if (results.length === 0) {
      return { content: [{ type: "text", text: "No results found for: " + query }] };
    }
    
    const text = results.map(d => \`## \${d.title}\\n\\n\${d.content}\`).join("\\n\\n---\\n\\n");
    return { content: [{ type: "text", text }] };
  }
);

// Get specific documentation page
server.tool(
  "get_doc",
  "Get a specific ${data.siteName} documentation page by title",
  {
    title: { type: "string", description: "Page title or number" }
  },
  async ({ title }) => {
    const doc = DOCS.find((d, i) => 
      d.title.toLowerCase() === title.toLowerCase() ||
      (i + 1).toString() === title
    );
    
    if (!doc) {
      return { content: [{ type: "text", text: "Page not found: " + title }] };
    }
    
    return { content: [{ type: "text", text: \`# \${doc.title}\\n\\n\${doc.content}\`}] };
  }
);

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("${data.siteName} Docs MCP Server running...");
`;
  };

  // Generate MCP Server README
  const generateMCPReadme = (data: SplitResult): string => {
    const safeName = data.siteName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    
    return `# ${data.siteName} Documentation MCP Server

This MCP (Model Context Protocol) server provides ${data.siteName} documentation to Claude Desktop and other MCP-compatible clients.

## Setup

### 1. Install dependencies
\`\`\`bash
cd mcp-server
npm install
\`\`\`

### 2. Configure Claude Desktop

Add this to your Claude Desktop config file:

**macOS:** \`~/Library/Application Support/Claude/claude_desktop_config.json\`
**Windows:** \`%APPDATA%\\Claude\\claude_desktop_config.json\`

\`\`\`json
{
  "mcpServers": {
    "${safeName}-docs": {
      "command": "node",
      "args": ["${process.cwd()}/${safeName}-docs/claude/mcp-server/index.js"]
    }
  }
}
\`\`\`

### 3. Restart Claude Desktop

After adding the configuration, restart Claude Desktop to load the MCP server.

## Available Tools

Once connected, Claude will have access to these tools:

- **list_docs** - List all documentation pages
- **search_docs** - Search documentation for a topic
- **get_doc** - Get a specific documentation page

## Source

- URL: ${data.sourceUrl}
- Pages: ${data.totalPages}
- Generated: ${new Date().toISOString().split('T')[0]}
`;
  };

  // Generate GitHub Copilot instructions content
  const generateCopilotInstructions = (data: SplitResult): string => {
    // Extract key patterns and APIs from documentation
    const extractPatterns = (docs: SplitDocument[]): string => {
      const patterns: string[] = [];
      docs.forEach((doc) => {
        // Look for code blocks and API references
        const codeBlockMatches = doc.content.match(/```[\s\S]*?```/g);
        if (codeBlockMatches && codeBlockMatches.length > 0) {
          patterns.push(`- ${doc.title}: Contains ${codeBlockMatches.length} code examples`);
        }
        // Look for function/method patterns
        if (doc.content.match(/function|const|class|interface|type|export/i)) {
          patterns.push(`- ${doc.title}: Contains API definitions`);
        }
      });
      return patterns.length > 0 ? patterns.slice(0, 10).join('\n') : '- See documentation files for API patterns';
    };

    // Create summarized content from first few docs
    const summarizeContent = (docs: SplitDocument[]): string => {
      return docs.slice(0, 5).map((doc) => {
        const preview = doc.content.slice(0, 500).replace(/```[\s\S]*?```/g, '[code block]');
        return `### ${doc.title}\n${preview}${doc.content.length > 500 ? '...' : ''}`;
      }).join('\n\n');
    };

    return `# Copilot Instructions for ${data.siteName}

## Documentation Context
This project uses ${data.siteName}. Refer to the following documentation when providing code suggestions and assistance.

Source: ${data.sourceUrl}
Total Documentation Pages: ${data.totalPages}

## Key APIs and Patterns
${extractPatterns(data.documents)}

## Available Documentation Files
${data.documents.map((d) => `- ${d.filename}: ${d.title}`).join('\n')}

## Documentation Reference
${summarizeContent(data.documents)}

## Usage Guidelines
- When suggesting code, reference patterns from the documentation above
- Prefer APIs and methods documented in ${data.siteName}
- Follow coding conventions shown in the code examples
- When uncertain, refer to the specific documentation file listed above
`;
  };

  // Generate Replit agent context
  const generateReplitAgentContext = (data: SplitResult): string => {
    // Create comprehensive context for Replit Agent
    const docSummary = data.documents.slice(0, 10).map((doc) => {
      const lines = doc.content.split('\n').slice(0, 20).join('\n');
      return `## ${doc.title}\n${lines}\n`;
    }).join('\n---\n\n');

    return `# ${data.siteName} - Replit Agent Context

## Overview
This document provides context from ${data.siteName} documentation for the Replit Agent.

**Source:** ${data.sourceUrl}
**Extracted:** ${new Date().toISOString()}
**Pages:** ${data.totalPages}

## Quick Reference
${data.documents.slice(0, 5).map((d) => `- **${d.title}**: ${d.filename}`).join('\n')}

## Documentation Content

${docSummary}

## Instructions for Agent
1. Use the patterns and APIs documented above when writing code
2. Reference specific documentation sections when explaining solutions
3. Follow the coding style demonstrated in code examples
4. When implementing features, check the relevant documentation file first
`;
  };

  // Generate .replit configuration file
  const generateReplitConfig = (data: SplitResult): string => {
    return `# Replit configuration for ${data.siteName} project

# Agent Instructions
# This project uses ${data.siteName}. See replit-agent-context.md for documentation.

[agent]
enabled = true
context = "replit-agent-context.md"

[agent.instructions]
documentation = "${data.siteName}"
source = "${data.sourceUrl}"
guidelines = """
- Reference ${data.siteName} documentation when providing assistance
- Follow patterns documented in replit-agent-context.md
- Use APIs and methods as documented
- Check documentation before implementing new features
"""

[nix]
channel = "stable-24_05"

[deployment]
run = ["sh", "-c", "echo 'Configure your run command'"]
`;
  };

  // Generate v0.dev context for component generation
  const generateV0Context = (data: SplitResult): string => {
    // Extract component-related documentation
    const componentDocs = data.documents.filter(d => 
      d.title.toLowerCase().includes('component') ||
      d.title.toLowerCase().includes('ui') ||
      d.title.toLowerCase().includes('design') ||
      d.title.toLowerCase().includes('style') ||
      d.content.toLowerCase().includes('component') ||
      d.content.toLowerCase().includes('<') // HTML/JSX
    );

    const relevantDocs = componentDocs.length > 0 ? componentDocs : data.documents.slice(0, 5);

    return `# v0 Component Generation Context: ${data.siteName}

## Overview
Use this documentation when generating UI components for ${data.siteName}.

**Source:** ${data.sourceUrl}
**Documentation Pages:** ${data.totalPages}

## Design System Reference

### Available Components & Patterns
${relevantDocs.map(d => `- **${d.title}**: ${d.content.split('\n')[0]?.slice(0, 100) || 'See documentation'}...`).join('\n')}

## Component Guidelines

When generating components:
1. Follow the patterns and conventions from ${data.siteName}
2. Use the styling approaches documented below
3. Match the component structure shown in examples
4. Maintain consistency with existing design patterns

## Documentation Excerpts

${relevantDocs.slice(0, 5).map(d => {
  const preview = d.content.slice(0, 1000);
  return `### ${d.title}\n\n${preview}${d.content.length > 1000 ? '\n\n...(truncated)' : ''}`;
}).join('\n\n---\n\n')}

## Full Documentation Index

${data.documents.map((d, i) => `${i + 1}. ${d.title}`).join('\n')}
`;
  };

  // Generate Bolt.new project context
  const generateBoltContext = (data: SplitResult): string => {
    const setupDocs = data.documents.filter(d =>
      d.title.toLowerCase().includes('install') ||
      d.title.toLowerCase().includes('setup') ||
      d.title.toLowerCase().includes('start') ||
      d.title.toLowerCase().includes('config') ||
      d.title.toLowerCase().includes('getting')
    );

    const relevantSetup = setupDocs.length > 0 ? setupDocs : data.documents.slice(0, 3);

    return `# Bolt.new Project Context: ${data.siteName}

## Project Overview
This context helps Bolt.new understand ${data.siteName} for project generation.

**Documentation Source:** ${data.sourceUrl}
**Total Pages:** ${data.totalPages}
**Generated:** ${new Date().toISOString().split('T')[0]}

## Setup Instructions

${relevantSetup.map(d => `### ${d.title}\n\n${d.content.slice(0, 800)}${d.content.length > 800 ? '\n\n...' : ''}`).join('\n\n---\n\n')}

## Project Structure Guidelines

When creating a project with ${data.siteName}:
1. Follow the setup instructions above
2. Use the recommended project structure from documentation
3. Include necessary dependencies and configurations
4. Set up proper development environment

## Key Configuration Files

Based on ${data.siteName} documentation, ensure these are properly configured:
- Package dependencies (package.json)
- Configuration files mentioned in setup
- Environment variables if required

## API Reference

${data.documents.slice(0, 8).map(d => `- **${d.title}**: ${d.content.split('\n')[0]?.slice(0, 80)}...`).join('\n')}

## Full Documentation

${data.documents.map(d => `## ${d.title}\n\n${d.content}`).join('\n\n---\n\n')}
`;
  };

  // Generate Lovable.dev knowledge base
  const generateLovableContext = (data: SplitResult): string => {
    const featureDocs = data.documents.filter(d =>
      d.title.toLowerCase().includes('feature') ||
      d.title.toLowerCase().includes('api') ||
      d.title.toLowerCase().includes('guide') ||
      d.title.toLowerCase().includes('example')
    );

    const features = featureDocs.length > 0 ? featureDocs : data.documents;

    return `# Lovable Knowledge Base: ${data.siteName}

## About This Knowledge Base
This document provides ${data.siteName} documentation for Lovable.dev's AI assistant.

**Source:** ${data.sourceUrl}
**Pages:** ${data.totalPages}
**Last Updated:** ${new Date().toISOString().split('T')[0]}

---

## Quick Reference

### Available Features
${features.slice(0, 10).map(d => `- ${d.title}`).join('\n')}

### Key Concepts
${data.documents.slice(0, 5).map(d => {
  const firstLine = d.content.split('\n').find(line => line.trim().length > 20) || d.content.split('\n')[0];
  return `- **${d.title}**: ${firstLine?.slice(0, 100)}...`;
}).join('\n')}

---

## Feature Documentation

${features.map(d => `### ${d.title}

${d.content}

---
`).join('\n')}

## Usage Guidelines

When helping users with ${data.siteName}:
1. Reference specific features from the documentation above
2. Provide accurate code examples when available
3. Follow the patterns demonstrated in the documentation
4. If a feature isn't documented here, clearly state that

## All Available Documentation

${data.documents.map((d, i) => `${i + 1}. **${d.title}** (${d.filename})`).join('\n')}
`;
  };

  // Generate LM Studio plain text context (optimized for local LLMs)
  const generateLMStudioContext = (data: SplitResult): string => {
    // Plain text, no special formatting, optimized for context window
    const content = data.documents.map(d => {
      // Strip markdown formatting for cleaner context
      const plainContent = d.content
        .replace(/#{1,6}\s+/g, '') // Remove headers
        .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
        .replace(/\*([^*]+)\*/g, '$1') // Remove italic
        .replace(/`{3}[\s\S]*?`{3}/g, '[CODE BLOCK]') // Simplify code blocks
        .replace(/`([^`]+)`/g, '$1') // Remove inline code
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links, keep text
        .replace(/^[-*+]\s+/gm, '- '); // Normalize lists
      
      return `=== ${d.title.toUpperCase()} ===\n\n${plainContent}`;
    }).join('\n\n' + '='.repeat(50) + '\n\n');

    return `${data.siteName.toUpperCase()} DOCUMENTATION
Source: ${data.sourceUrl}
Pages: ${data.totalPages}

${'='.repeat(50)}

TABLE OF CONTENTS:
${data.documents.map((d, i) => `${i + 1}. ${d.title}`).join('\n')}

${'='.repeat(50)}

${content}

${'='.repeat(50)}
END OF ${data.siteName.toUpperCase()} DOCUMENTATION
`;
  };

  // Generate Open WebUI RAG-optimized JSON
  const generateOpenWebUIContext = (data: SplitResult): string => {
    // Chunk documents for better RAG retrieval
    const chunkContent = (content: string, maxChunkSize: number = 1000): string[] => {
      const chunks: string[] = [];
      const paragraphs = content.split('\n\n');
      let currentChunk = '';
      
      for (const para of paragraphs) {
        if ((currentChunk + '\n\n' + para).length > maxChunkSize && currentChunk.length > 0) {
          chunks.push(currentChunk.trim());
          currentChunk = para;
        } else {
          currentChunk = currentChunk ? currentChunk + '\n\n' + para : para;
        }
      }
      
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
      
      return chunks.length > 0 ? chunks : [content];
    };

    const documents: { title: string; content: string; metadata: { source: string; page: number; section: string; tokens_approx: number } }[] = [];
    
    data.documents.forEach((doc, docIndex) => {
      const chunks = chunkContent(doc.content);
      
      chunks.forEach((chunk, chunkIndex) => {
        documents.push({
          title: chunks.length > 1 ? `${doc.title} (Part ${chunkIndex + 1})` : doc.title,
          content: chunk,
          metadata: {
            source: data.sourceUrl,
            page: docIndex + 1,
            section: doc.filename,
            tokens_approx: Math.ceil(chunk.length / 4) // Rough token estimate
          }
        });
      });
    });

    return JSON.stringify({
      name: `${data.siteName} Documentation`,
      description: `RAG-optimized documentation for ${data.siteName}`,
      source_url: data.sourceUrl,
      total_original_pages: data.totalPages,
      total_chunks: documents.length,
      generated: new Date().toISOString(),
      documents: documents
    }, null, 2);
  };

  const downloadAllZip = async () => {
    if (!result) return;
    
    setDownloading(true);
    try {
      const zip = new JSZip();
      const folderName = result.siteName + '-docs';
      const folder = zip.folder(folderName);
      
      if (!folder) return;
      
      // Add all documents
      result.documents.forEach((doc) => {
        folder.file(doc.filename, doc.content);
      });
      
      // Add README index
      const readmeContent = '# ' + result.siteName + ' Documentation\n\n' +
        'Extracted from: ' + result.sourceUrl + '\n' +
        'Date: ' + new Date().toISOString() + '\n' +
        'Total Pages: ' + result.totalPages + '\n\n' +
        '## Pages\n\n' +
        result.documents.map(function(d) { return '- [' + d.title + '](./' + d.filename + ')'; }).join('\n');
      
      folder.file('README.md', readmeContent);
      
      // Add ChatGPT formats
      const chatgptFolder = folder.folder('chatgpt');
      if (chatgptFolder) {
        chatgptFolder.file('chatgpt-context.txt', generateChatGPTContext(result));
        chatgptFolder.file('custom-gpt-instructions.md', generateCustomGPTInstructions(result));
        chatgptFolder.file('custom-gpt-template.json', generateCustomGPTJSON(result));
      }
      
      // Add DeepSeek formats
      const deepseekFolder = folder.folder('deepseek');
      if (deepseekFolder) {
        deepseekFolder.file('deepseek-context.txt', generateDeepSeekContext(result));
      }
      
      // Add Gemini formats
      const geminiFolder = folder.folder('gemini');
      if (geminiFolder) {
        geminiFolder.file('gemini-context.txt', generateGeminiContext(result));
        geminiFolder.file('notebooklm-sources.md', generateNotebookLMSources(result));
      }
      
      // Add Claude formats
      const claudeFolder = folder.folder('claude');
      if (claudeFolder) {
        claudeFolder.file('CLAUDE.md', generateClaudeMD(result));
        claudeFolder.file('claude_desktop_config.json', generateClaudeDesktopConfig(result));
        
        // Add MCP server template
        const mcpFolder = claudeFolder.folder('mcp-server');
        if (mcpFolder) {
          mcpFolder.file('package.json', generateMCPPackageJson(result));
          mcpFolder.file('index.js', generateMCPServerIndex(result));
          mcpFolder.file('README.md', generateMCPReadme(result));
        }
      }
      
      // Add Cursor integration files
      const cursorFolder = folder.folder('cursor');
      if (cursorFolder) {
        cursorFolder.file('.cursorrules', generateCursorRules(result));
        cursorFolder.file('cursor-mcp-config.json', generateCursorMCPConfig(result));
      }
      
      // Add Windsurf integration files
      const windsurfFolder = folder.folder('windsurf');
      if (windsurfFolder) {
        windsurfFolder.file('.windsurfrules', generateWindsurfRules(result));
      }

      // Add GitHub Copilot integration files
      const copilotFolder = folder.folder('copilot');
      if (copilotFolder) {
        copilotFolder.file('copilot-instructions.md', generateCopilotInstructions(result));
      }

      // Add Replit integration files
      const replitFolder = folder.folder('replit');
      if (replitFolder) {
        replitFolder.file('.replit', generateReplitConfig(result));
        replitFolder.file('replit-agent-context.md', generateReplitAgentContext(result));
      }

      // Add v0.dev integration files
      const v0Folder = folder.folder('v0');
      if (v0Folder) {
        v0Folder.file('v0-context.md', generateV0Context(result));
      }

      // Add Bolt.new integration files
      const boltFolder = folder.folder('bolt');
      if (boltFolder) {
        boltFolder.file('bolt-context.md', generateBoltContext(result));
      }

      // Add Lovable.dev integration files
      const lovableFolder = folder.folder('lovable');
      if (lovableFolder) {
        lovableFolder.file('lovable-knowledge.md', generateLovableContext(result));
      }

      // Add Local LLM integration files (LM Studio, Open WebUI)
      const localLlmFolder = folder.folder('local-llm');
      if (localLlmFolder) {
        localLlmFolder.file('lmstudio-context.txt', generateLMStudioContext(result));
        localLlmFolder.file('openwebui-docs.json', generateOpenWebUIContext(result));
      }

      // Generate and download
      const blob = await zip.generateAsync({ type: 'blob' });
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = folderName + '.zip';
      a.click();
      URL.revokeObjectURL(downloadUrl);
    } finally {
      setDownloading(false);
    }
  };

  const copyContent = async (content: string) => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const headerTitle = result?.siteName ? result.siteName + ' docs' : 'Extracting...';

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="border-b border-neutral-800 bg-[#0a0a0a]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              href="/" 
              className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
            <div className="h-4 w-px bg-neutral-800" />
            <h1 className="font-semibold">{headerTitle}</h1>
          </div>
          
          {result && (
            <button
              onClick={downloadAllZip}
              disabled={downloading}
              className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg font-medium hover:bg-neutral-200 transition-colors disabled:opacity-50"
            >
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {downloading ? 'Creating ZIP...' : 'Download .zip (' + result.totalPages + ' files)'}
            </button>
          )}
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Loading State */}
        {status === 'loading' && (
          <div className="flex flex-col items-center justify-center py-32">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-4" />
            <p className="text-neutral-400 mb-2">Searching for documentation...</p>
            <p className="text-neutral-500 text-sm">
              Scanning {url} and common doc locations (docs.*, /docs, etc.)
            </p>
            <p className="text-neutral-600 text-xs mt-4">
              This may take up to 20 seconds
            </p>
          </div>
        )}

        {/* Error State */}
        {status === 'error' && (
          <div className="flex flex-col items-center justify-center py-32 max-w-lg mx-auto text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
            <p className="text-xl font-semibold mb-2">No Documentation Found</p>
            <p className="text-neutral-400 mb-4">{error}</p>
            <p className="text-neutral-500 text-sm mb-6">
              We scanned common documentation locations (docs.*, /docs, developers.*, etc.) 
              but couldn&apos;t find an llms.txt file. The site may not support the llms.txt standard yet.
            </p>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-3 bg-white text-black rounded-lg font-medium hover:bg-neutral-200 transition-colors"
            >
              Try Another URL
            </button>
          </div>
        )}

        {/* Success State */}
        {status === 'success' && result && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Sidebar - File List */}
            <div className="lg:col-span-1">
              <div className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden sticky top-24">
                <div className="p-4 border-b border-neutral-800">
                  <h2 className="font-semibold flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    {result.totalPages} Pages
                  </h2>
                  <p className="text-sm text-neutral-500 mt-1">
                    from {result.sourceUrl.split('/').pop()}
                  </p>
                </div>
                <div className="max-h-[60vh] overflow-y-auto">
                  {result.documents.map((doc) => (
                    <button
                      key={doc.filename}
                      onClick={() => setSelectedDoc(doc)}
                      className={'w-full text-left px-4 py-3 border-b border-neutral-800 hover:bg-neutral-800/50 transition-colors ' + (selectedDoc?.filename === doc.filename ? 'bg-neutral-800 border-l-2 border-l-blue-500' : '')}
                    >
                      <p className="font-medium text-sm truncate">{doc.title}</p>
                      <p className="text-xs text-neutral-500 truncate">{doc.filename}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Main Content - Preview */}
            <div className="lg:col-span-3">
              {selectedDoc && (
                <div className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden">
                  {/* File Header */}
                  <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
                    <div>
                      <h2 className="font-semibold">{selectedDoc.title}</h2>
                      <p className="text-sm text-neutral-500">{selectedDoc.filename}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyContent(selectedDoc.content)}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-neutral-800 rounded-lg hover:bg-neutral-700 transition-colors"
                      >
                        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                      <button
                        onClick={() => downloadFile(selectedDoc)}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </button>
                    </div>
                  </div>
                  
                  {/* Content Preview */}
                  <div className="p-6 max-h-[70vh] overflow-y-auto">
                    <pre className="text-sm text-neutral-300 whitespace-pre-wrap font-mono leading-relaxed">
                      {selectedDoc.content}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ExtractPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-white/60">Loading...</div>
      </div>
    }>
      <ExtractPageContent />
    </Suspense>
  );
}
