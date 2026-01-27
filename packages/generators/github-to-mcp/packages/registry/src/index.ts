/**
 * @fileoverview MCP Registry package exports
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license Apache-2.0
 */

// Main registry class
export { McpRegistry, type McpRegistryOptions } from './registry';

// Storage adapters
export { FileStorage, MemoryStorage } from './storage';

// Updater
export { RegistryUpdater, type UpdaterOptions } from './updater';

// Types
export type {
  // Core types
  RegistryEntry,
  RegistryEntrySummary,
  ToolSummary,
  QualityScore,
  AuthScheme,
  
  // Configs
  IdeConfigs,
  GeneratedCode,
  
  // Operations
  ListOptions,
  ListResult,
  InstallOptions,
  InstallResult,
  UpdateInfo,
  
  // Storage
  StorageAdapter,
  
  // Stats
  RegistryStats,
} from './types';

// Re-export popular entries
export { popularEntries, getPopularEntry } from './popular';
