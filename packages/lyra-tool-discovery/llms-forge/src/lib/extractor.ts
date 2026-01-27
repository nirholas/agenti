/**
 * Main Extractor Engine - Orchestrates the extraction process
 */

import { analyzeUrl, type UrlAnalysis, type ExtractionStrategy } from './url-analyzer';
import { parseSitemap, sortDocumentationUrls } from './sitemap-parser';
import { scrapePageToMarkdown, scrapePages, countWords, type MarkdownDocument } from './html-to-markdown';
import { extractSiteName, estimateTokens, slugify } from './parser';

/**
 * Progress callback types
 */
export type ExtractionStatus = 'analyzing' | 'fetching' | 'processing' | 'complete' | 'error';

export interface ExtractionProgress {
  status: ExtractionStatus;
  message: string;
  progress: number; // 0-100
  currentStep?: string;
  totalSteps?: number;
  completedSteps?: number;
  error?: string;
}

export interface ExtractionOptions {
  url: string;
  onProgress?: (progress: ExtractionProgress) => void;
  maxPages?: number;
}

export interface ExtractionResult {
  success: boolean;
  strategy: ExtractionStrategy;
  source: {
    url: string;
    sourceUrl: string;
    title: string;
    siteName: string;
  };
  documents: MarkdownDocument[];
  fullDocument: string;
  agentPrompt: string;
  mcpConfig: object;
  stats: {
    totalDocuments: number;
    totalWords: number;
    totalCharacters: number;
    totalTokens: number;
    extractionTime: number;
  };
  error?: string;
}

/**
 * Extract content from llms.txt file
 */
async function extractFromLlmsTxt(url: string): Promise<MarkdownDocument[]> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'llms-forge/1.0 (Documentation Extractor)',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch llms.txt: ${response.status}`);
  }
  
  const content = await response.text();
  
  // llms.txt format is already markdown-ish
  // Split by ## headers into sections
  const sections = content.split(/^## /m);
  
  const documents: MarkdownDocument[] = [];
  
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i].trim();
    if (!section) continue;
    
    const lines = section.split('\n');
    const title = lines[0] || `Section ${i + 1}`;
    const sectionContent = lines.slice(1).join('\n').trim();
    
    // Only include sections with meaningful content
    if (sectionContent.length > 50 || (i === 0 && section.length > 50)) {
      const fullContent = i === 0 ? section : `## ${title}\n\n${sectionContent}`;
      
      documents.push({
        title: i === 0 ? 'Introduction' : title,
        url,
        content: fullContent,
        wordCount: countWords(fullContent),
      });
    }
  }
  
  // If no sections found, treat entire content as one document
  if (documents.length === 0 && content.length > 50) {
    documents.push({
      title: 'Documentation',
      url,
      content,
      wordCount: countWords(content),
    });
  }
  
  return documents;
}

/**
 * Extract from multiple pages
 */
async function extractFromPages(
  pages: string[],
  onProgress?: (progress: ExtractionProgress) => void
): Promise<MarkdownDocument[]> {
  const sortedPages = sortDocumentationUrls(pages);
  const total = sortedPages.length;
  
  return scrapePages(sortedPages, (completed, totalPages, currentUrl) => {
    const progress = Math.round(20 + (completed / totalPages) * 60);
    onProgress?.({
      status: 'fetching',
      message: `Processing page ${completed + 1} of ${totalPages}`,
      progress,
      currentStep: currentUrl,
      totalSteps: totalPages,
      completedSteps: completed,
    });
  });
}

/**
 * Generate full document from multiple markdown documents
 */
export function generateFullDocument(
  documents: MarkdownDocument[],
  sourceUrl: string,
  siteName: string
): string {
  const formattedSiteName = siteName.charAt(0).toUpperCase() + siteName.slice(1);
  const date = new Date().toISOString().split('T')[0];
  
  // Table of contents
  const toc = documents.map((doc, i) => {
    const anchor = slugify(doc.title);
    return `${i + 1}. [${doc.title}](#${anchor})`;
  }).join('\n');
  
  // Header
  const header = `# ${formattedSiteName} Documentation

> Source: ${sourceUrl}
> Generated: ${date}
> Total sections: ${documents.length}

---

## Table of Contents

${toc}

---

`;

  // Body
  const body = documents.map(doc => `
## ${doc.title}

${doc.content}

---
`).join('\n');

  return header + body;
}

/**
 * Generate agent prompt for AI assistants
 */
export function generateAgentPrompt(
  documents: MarkdownDocument[],
  sourceUrl: string,
  siteName: string
): string {
  const formattedSiteName = siteName.charAt(0).toUpperCase() + siteName.slice(1);
  const topics = documents.slice(0, 8).map(d => d.title).join(', ');
  const totalWords = documents.reduce((sum, d) => sum + d.wordCount, 0);
  
  return `# ${formattedSiteName} Documentation Context

You have access to the official ${formattedSiteName} documentation.

## Source Information
- **URL**: ${sourceUrl}
- **Sections**: ${documents.length}
- **Approximate words**: ${totalWords.toLocaleString()}

## Available Topics
${topics}${documents.length > 8 ? ', and more...' : ''}

## How to Use This Context

1. **Answer questions** about ${formattedSiteName} features, APIs, and usage
2. **Provide code examples** based on the official documentation
3. **Explain concepts** as documented by ${formattedSiteName}
4. **Guide users** through setup, configuration, and best practices

## Important Notes

- This documentation was extracted on ${new Date().toISOString().split('T')[0]}
- Always cite specific sections when providing information
- If information might be outdated, recommend checking the official docs
- Be helpful and accurate based on the provided context

---

The full documentation follows below:
`;
}

/**
 * Generate MCP (Model Context Protocol) configuration
 */
export function generateMcpConfig(sourceUrl: string, siteName: string): object {
  return {
    name: `${siteName}-docs`,
    version: '1.0.0',
    description: `Documentation context for ${siteName}`,
    source: {
      url: sourceUrl,
      extracted: new Date().toISOString(),
    },
    capabilities: {
      resources: true,
      tools: false,
      prompts: false,
    },
    resources: [
      {
        name: 'full-documentation',
        description: 'Complete documentation in a single file',
        uri: `docs://${siteName}/full`,
        mimeType: 'text/markdown',
      },
      {
        name: 'agent-prompt',
        description: 'Optimized prompt for AI assistants',
        uri: `docs://${siteName}/prompt`,
        mimeType: 'text/markdown',
      },
    ],
  };
}

/**
 * Main extraction function
 */
export async function extract(options: ExtractionOptions): Promise<ExtractionResult> {
  const { url, onProgress, maxPages = 50 } = options;
  const startTime = Date.now();

  try {
    // Step 1: Analyze URL
    onProgress?.({
      status: 'analyzing',
      message: 'Analyzing URL...',
      progress: 5,
    });

    const analysis = await analyzeUrl(url);

    onProgress?.({
      status: 'analyzing',
      message: `Strategy: ${analysis.strategy}`,
      progress: 10,
    });

    let documents: MarkdownDocument[] = [];
    let sourceUrl = url;

    // Step 2: Extract based on strategy
    switch (analysis.strategy) {
      case 'llms-txt':
        onProgress?.({
          status: 'fetching',
          message: 'Found llms.txt! Fetching content...',
          progress: 20,
        });
        sourceUrl = analysis.llmsTxtUrl!;
        documents = await extractFromLlmsTxt(analysis.llmsTxtUrl!);
        break;

      case 'sitemap':
        onProgress?.({
          status: 'fetching',
          message: `Found sitemap with ${analysis.pages.length} pages`,
          progress: 20,
        });
        const pagesToProcess = analysis.pages.slice(0, maxPages);
        documents = await extractFromPages(pagesToProcess, onProgress);
        sourceUrl = analysis.sitemapUrl!;
        break;

      case 'docs-discovery':
        onProgress?.({
          status: 'fetching',
          message: `Discovered docs at ${analysis.docsUrl}`,
          progress: 20,
        });
        
        // Re-analyze the docs URL for better extraction
        const docsAnalysis = await analyzeUrl(analysis.docsUrl!);
        sourceUrl = analysis.docsUrl!;
        
        if (docsAnalysis.strategy === 'llms-txt' && docsAnalysis.llmsTxtUrl) {
          documents = await extractFromLlmsTxt(docsAnalysis.llmsTxtUrl);
          sourceUrl = docsAnalysis.llmsTxtUrl;
        } else if (docsAnalysis.strategy === 'sitemap' && docsAnalysis.pages.length > 0) {
          const pagesToProcess = docsAnalysis.pages.slice(0, maxPages);
          documents = await extractFromPages(pagesToProcess, onProgress);
        } else {
          // Fallback to scraping the docs URL directly
          const doc = await scrapePageToMarkdown(analysis.docsUrl!);
          documents = [doc];
        }
        break;

      case 'html-scrape':
      default:
        onProgress?.({
          status: 'fetching',
          message: 'Scraping page content...',
          progress: 20,
        });
        const doc = await scrapePageToMarkdown(url);
        documents = [doc];
        break;
    }

    // Handle empty results
    if (documents.length === 0) {
      throw new Error('No content could be extracted from the URL');
    }

    // Step 3: Process and organize
    onProgress?.({
      status: 'processing',
      message: 'Generating outputs...',
      progress: 85,
    });

    const siteName = extractSiteName(sourceUrl);
    const fullDocument = generateFullDocument(documents, sourceUrl, siteName);
    const agentPrompt = generateAgentPrompt(documents, sourceUrl, siteName);
    const mcpConfig = generateMcpConfig(sourceUrl, siteName);

    // Calculate stats
    const totalWords = documents.reduce((sum, d) => sum + d.wordCount, 0);
    const totalCharacters = fullDocument.length;
    const totalTokens = estimateTokens(fullDocument);
    const extractionTime = Date.now() - startTime;

    onProgress?.({
      status: 'complete',
      message: 'Extraction complete!',
      progress: 100,
    });

    return {
      success: true,
      strategy: analysis.strategy,
      source: {
        url,
        sourceUrl,
        title: documents[0]?.title || siteName,
        siteName,
      },
      documents,
      fullDocument,
      agentPrompt,
      mcpConfig,
      stats: {
        totalDocuments: documents.length,
        totalWords,
        totalCharacters,
        totalTokens,
        extractionTime,
      },
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Extraction failed';
    
    onProgress?.({
      status: 'error',
      message: errorMessage,
      progress: 0,
      error: errorMessage,
    });

    return {
      success: false,
      strategy: 'unknown',
      source: {
        url,
        sourceUrl: url,
        title: 'Extraction Failed',
        siteName: 'unknown',
      },
      documents: [],
      fullDocument: '',
      agentPrompt: '',
      mcpConfig: {},
      stats: {
        totalDocuments: 0,
        totalWords: 0,
        totalCharacters: 0,
        totalTokens: 0,
        extractionTime: Date.now() - startTime,
      },
      error: errorMessage,
    };
  }
}

// Re-export types
export type { MarkdownDocument, UrlAnalysis, ExtractionStrategy };
