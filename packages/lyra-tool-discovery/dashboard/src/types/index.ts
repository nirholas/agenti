// Template interface for all 8 plugin templates
export interface Template {
  id: string;
  name: string;
  type: 'mcp' | 'default' | 'openapi' | 'settings' | 'standalone' | 'markdown';
  icon: string;
  description: string;
  useCase: string;
  criteria: string[];
  example: Record<string, unknown>;
  cliCommand: string;
}

// Feature interface for homepage features
export interface Feature {
  icon: string;
  title: string;
  description: string;
  color: 'violet' | 'cyan' | 'pink' | 'green' | 'orange' | 'blue';
}

// Navigation link interface
export interface NavLink {
  href: string;
  label: string;
  external?: boolean;
}

// Analysis result from the discover command
export interface AnalysisResult {
  source: 'github' | 'npm';
  name: string;
  url: string;
  template: string;
  confidence: number;
  metadata: {
    stars?: number;
    downloads?: number;
    lastUpdated?: string;
    description?: string;
    topics?: string[];
  };
  config: Record<string, unknown>;
}

// Step for HowItWorks component
export interface Step {
  number: number;
  title: string;
  description: string;
  icon: string;
}

// Stat for Stats component
export interface Stat {
  value: number;
  label: string;
  suffix?: string;
  prefix?: string;
}

// Badge variants
export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'mcp' | 'openapi';

// Button variants and sizes
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';
