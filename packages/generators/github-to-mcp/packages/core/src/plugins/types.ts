/**
 * @fileoverview Plugin system type definitions
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import { ExtractedTool, GithubToMcpOptions, RepoClassification } from '../types';

/**
 * Repository context passed to plugins
 */
export interface PluginRepoContext {
  /** Repository owner */
  owner: string;
  /** Repository name */
  repo: string;
  /** Repository URL */
  url: string;
  /** Repository classification */
  classification: RepoClassification;
  /** Repository metadata */
  metadata: {
    stars: number;
    language: string;
    license?: string;
    description?: string;
  };
  /** README content if available */
  readme?: string;
  /** GitHub token for API access */
  githubToken?: string;
}

/**
 * File content for plugin processing
 */
export interface PluginFileContent {
  path: string;
  content: string;
  language: string;
}

/**
 * Plugin detection result
 */
export interface PluginDetectionResult {
  /** Whether the plugin should process this repo */
  shouldProcess: boolean;
  /** Confidence level (0-1) */
  confidence: number;
  /** Reason for the decision */
  reason: string;
  /** Specific files that triggered detection */
  matchedFiles?: string[];
}

/**
 * Plugin extraction result
 */
export interface PluginExtractionResult {
  /** Extracted tools */
  tools: ExtractedTool[];
  /** Source files processed */
  sourceFiles: string[];
  /** Any warnings during extraction */
  warnings?: string[];
  /** Plugin-specific metadata */
  metadata?: Record<string, any>;
}

/**
 * Plugin lifecycle hooks
 */
export interface PluginHooks {
  /** Called when the plugin is registered */
  onRegister?: () => void | Promise<void>;
  /** Called when the plugin is unregistered */
  onUnregister?: () => void | Promise<void>;
  /** Called before extraction begins */
  beforeExtract?: (context: PluginRepoContext) => void | Promise<void>;
  /** Called after extraction completes */
  afterExtract?: (result: PluginExtractionResult) => void | Promise<void>;
}

/**
 * Plugin configuration schema
 */
export interface PluginConfigSchema {
  /** Configuration option name */
  name: string;
  /** Option type */
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  /** Description of the option */
  description: string;
  /** Default value */
  default?: any;
  /** Whether the option is required */
  required?: boolean;
  /** Validation function */
  validate?: (value: any) => boolean;
}

/**
 * Plugin metadata
 */
export interface PluginMetadata {
  /** Unique plugin identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Plugin version (semver) */
  version: string;
  /** Plugin description */
  description: string;
  /** Plugin author */
  author?: string;
  /** Plugin homepage/repository */
  homepage?: string;
  /** License */
  license?: string;
  /** Tags for categorization */
  tags?: string[];
  /** Minimum core version required */
  minCoreVersion?: string;
}

/**
 * Main plugin interface that extractors must implement
 */
export interface ExtractorPlugin {
  /** Plugin metadata */
  metadata: PluginMetadata;
  
  /** Configuration schema */
  configSchema?: PluginConfigSchema[];
  
  /** Lifecycle hooks */
  hooks?: PluginHooks;

  /**
   * Detect if this plugin should process the repository
   * @param context Repository context
   * @param files List of files in the repository
   */
  detect(context: PluginRepoContext, files: string[]): Promise<PluginDetectionResult>;

  /**
   * Extract tools from the repository
   * @param context Repository context
   * @param getFile Function to get file content
   * @param config Plugin configuration
   */
  extract(
    context: PluginRepoContext,
    getFile: (path: string) => Promise<string | null>,
    config?: Record<string, any>
  ): Promise<PluginExtractionResult>;
}

/**
 * Plugin factory function type
 */
export type PluginFactory = (options?: Record<string, any>) => ExtractorPlugin;

/**
 * Plugin loader result
 */
export interface PluginLoadResult {
  success: boolean;
  plugin?: ExtractorPlugin;
  error?: Error;
  source: 'npm' | 'local' | 'inline';
}

/**
 * Plugin registry entry
 */
export interface PluginRegistryEntry {
  plugin: ExtractorPlugin;
  config: Record<string, any>;
  enabled: boolean;
  source: 'npm' | 'local' | 'inline';
  loadedAt: Date;
}

/**
 * Plugin manager configuration
 */
export interface PluginManagerConfig {
  /** Directory to search for local plugins */
  pluginDir?: string;
  /** Auto-load plugins from pluginDir */
  autoLoad?: boolean;
  /** Enable verbose logging */
  verbose?: boolean;
  /** Plugin execution timeout in ms */
  timeout?: number;
  /** Run plugins in parallel */
  parallel?: boolean;
}

/**
 * Event emitted by plugin manager
 */
export interface PluginEvent {
  type: 'registered' | 'unregistered' | 'enabled' | 'disabled' | 'error' | 'extraction-start' | 'extraction-complete';
  pluginId: string;
  timestamp: Date;
  data?: any;
}

/**
 * Plugin event handler
 */
export type PluginEventHandler = (event: PluginEvent) => void;
