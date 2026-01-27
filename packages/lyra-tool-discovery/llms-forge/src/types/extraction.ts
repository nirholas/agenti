export interface ExtractionLog {
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
  timestamp: number;
}

export interface ExtractionState {
  status: 'idle' | 'checking' | 'fetching' | 'processing' | 'complete' | 'error';
  progress: number;
  logs: ExtractionLog[];
  result: ExtractionResult | null;
  error?: string;
}

export interface ExtractionResult {
  success: boolean;
  strategy: string;
  source: {
    url: string;
    title: string;
  };
  documents: MarkdownDocument[];
  fullDocument: string;
  agentPrompt: string;
  mcpConfig: string;
  stats: {
    totalDocuments: number;
    totalWords: number;
    totalCharacters: number;
    extractionTime: number;
  };
}

export interface MarkdownDocument {
  title: string;
  url: string;
  content: string;
  wordCount: number;
}
