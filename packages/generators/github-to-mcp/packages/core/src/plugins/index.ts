/**
 * @fileoverview Plugin manager for orchestrating extractor plugins
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import { PluginRegistry, defaultRegistry } from './registry';
import {
  ExtractorPlugin,
  PluginRepoContext,
  PluginExtractionResult,
  PluginDetectionResult,
  PluginManagerConfig,
  PluginLoadResult,
  PluginEvent,
  PluginEventHandler,
  PluginMetadata,
  PluginConfigSchema,
  PluginHooks
} from './types';
import { ExtractedTool } from '../types';

// Re-export types
export type {
  ExtractorPlugin,
  PluginRepoContext,
  PluginExtractionResult,
  PluginDetectionResult,
  PluginManagerConfig,
  PluginLoadResult,
  PluginEvent,
  PluginEventHandler,
  PluginMetadata,
  PluginConfigSchema,
  PluginHooks
};

/**
 * Plugin manager that orchestrates plugin detection and extraction
 */
export class PluginManager {
  private registry: PluginRegistry;
  private config: PluginManagerConfig;

  constructor(config: PluginManagerConfig = {}, registry?: PluginRegistry) {
    this.config = {
      timeout: 30000,
      parallel: true,
      verbose: false,
      ...config
    };
    this.registry = registry || defaultRegistry;
  }

  /**
   * Register an inline plugin
   */
  registerPlugin(plugin: ExtractorPlugin, config: Record<string, any> = {}): void {
    this.registry.register(plugin, config);
    if (this.config.verbose) {
      console.log(`[PluginManager] Registered plugin: ${plugin.metadata.name} v${plugin.metadata.version}`);
    }
  }

  /**
   * Unregister a plugin
   */
  async unregisterPlugin(pluginId: string): Promise<boolean> {
    const result = await this.registry.unregister(pluginId);
    if (this.config.verbose && result) {
      console.log(`[PluginManager] Unregistered plugin: ${pluginId}`);
    }
    return result;
  }

  /**
   * Load a plugin from npm
   */
  async loadPlugin(packageName: string, config: Record<string, any> = {}): Promise<PluginLoadResult> {
    const result = await this.registry.loadFromNpm(packageName, config);
    if (this.config.verbose) {
      if (result.success) {
        console.log(`[PluginManager] Loaded plugin from npm: ${packageName}`);
      } else {
        console.error(`[PluginManager] Failed to load plugin from npm: ${packageName}`, result.error);
      }
    }
    return result;
  }

  /**
   * Load a plugin from a local file
   */
  async loadPluginFromFile(filePath: string, config: Record<string, any> = {}): Promise<PluginLoadResult> {
    const result = await this.registry.loadFromFile(filePath, config);
    if (this.config.verbose) {
      if (result.success) {
        console.log(`[PluginManager] Loaded plugin from file: ${filePath}`);
      } else {
        console.error(`[PluginManager] Failed to load plugin from file: ${filePath}`, result.error);
      }
    }
    return result;
  }

  /**
   * Load all plugins from a directory
   */
  async loadPluginsFromDirectory(dirPath: string): Promise<PluginLoadResult[]> {
    const results = await this.registry.loadFromDirectory(dirPath);
    if (this.config.verbose) {
      const successful = results.filter(r => r.success).length;
      console.log(`[PluginManager] Loaded ${successful}/${results.length} plugins from directory: ${dirPath}`);
    }
    return results;
  }

  /**
   * List all registered plugins
   */
  listPlugins(): Array<{ id: string; name: string; version: string; enabled: boolean; source: string }> {
    return this.registry.list();
  }

  /**
   * Enable a plugin
   */
  enablePlugin(pluginId: string): boolean {
    return this.registry.enable(pluginId);
  }

  /**
   * Disable a plugin
   */
  disablePlugin(pluginId: string): boolean {
    return this.registry.disable(pluginId);
  }

  /**
   * Detect which plugins should process the repository
   */
  async detectPlugins(
    context: PluginRepoContext,
    files: string[]
  ): Promise<Map<string, PluginDetectionResult>> {
    const results = new Map<string, PluginDetectionResult>();
    const plugins = this.registry.getEnabled();

    const detectPromises = plugins.map(async (plugin) => {
      try {
        const result = await this.withTimeout(
          plugin.detect(context, files),
          this.config.timeout!,
          `Detection timeout for plugin: ${plugin.metadata.id}`
        );
        return { pluginId: plugin.metadata.id, result };
      } catch (error) {
        return {
          pluginId: plugin.metadata.id,
          result: {
            shouldProcess: false,
            confidence: 0,
            reason: error instanceof Error ? error.message : 'Detection failed'
          }
        };
      }
    });

    if (this.config.parallel) {
      const detections = await Promise.all(detectPromises);
      for (const { pluginId, result } of detections) {
        results.set(pluginId, result);
      }
    } else {
      for (const promise of detectPromises) {
        const { pluginId, result } = await promise;
        results.set(pluginId, result);
      }
    }

    return results;
  }

  /**
   * Run extraction with all applicable plugins
   */
  async extract(
    context: PluginRepoContext,
    getFile: (path: string) => Promise<string | null>,
    files: string[]
  ): Promise<{
    tools: ExtractedTool[];
    results: Map<string, PluginExtractionResult>;
    errors: Map<string, Error>;
  }> {
    const allTools: ExtractedTool[] = [];
    const results = new Map<string, PluginExtractionResult>();
    const errors = new Map<string, Error>();

    // First, detect applicable plugins
    const detections = await this.detectPlugins(context, files);

    // Filter to plugins that should process
    const applicablePlugins = Array.from(detections.entries())
      .filter(([_, result]) => result.shouldProcess)
      .sort((a, b) => b[1].confidence - a[1].confidence)
      .map(([id]) => id);

    if (this.config.verbose) {
      console.log(`[PluginManager] ${applicablePlugins.length} plugins will process the repository`);
    }

    // Run extraction for each applicable plugin
    const extractPromises = applicablePlugins.map(async (pluginId) => {
      const entry = this.registry.getEntry(pluginId);
      if (!entry) return { pluginId, result: null, error: new Error('Plugin not found') };

      const plugin = entry.plugin;

      try {
        // Call beforeExtract hook
        await plugin.hooks?.beforeExtract?.(context);

        // Run extraction
        const result = await this.withTimeout(
          plugin.extract(context, getFile, entry.config),
          this.config.timeout!,
          `Extraction timeout for plugin: ${pluginId}`
        );

        // Call afterExtract hook
        await plugin.hooks?.afterExtract?.(result);

        return { pluginId, result, error: null };
      } catch (error) {
        return {
          pluginId,
          result: null,
          error: error instanceof Error ? error : new Error(String(error))
        };
      }
    });

    if (this.config.parallel) {
      const extractions = await Promise.all(extractPromises);
      for (const { pluginId, result, error } of extractions) {
        if (result) {
          results.set(pluginId, result);
          allTools.push(...result.tools);
        }
        if (error) {
          errors.set(pluginId, error);
        }
      }
    } else {
      for (const promise of extractPromises) {
        const { pluginId, result, error } = await promise;
        if (result) {
          results.set(pluginId, result);
          allTools.push(...result.tools);
        }
        if (error) {
          errors.set(pluginId, error);
        }
      }
    }

    return { tools: allTools, results, errors };
  }

  /**
   * Run a single plugin's extraction
   */
  async extractWithPlugin(
    pluginId: string,
    context: PluginRepoContext,
    getFile: (path: string) => Promise<string | null>
  ): Promise<PluginExtractionResult> {
    const entry = this.registry.getEntry(pluginId);
    if (!entry) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    const plugin = entry.plugin;

    // Call beforeExtract hook
    await plugin.hooks?.beforeExtract?.(context);

    // Run extraction
    const result = await this.withTimeout(
      plugin.extract(context, getFile, entry.config),
      this.config.timeout!,
      `Extraction timeout for plugin: ${pluginId}`
    );

    // Call afterExtract hook
    await plugin.hooks?.afterExtract?.(result);

    return result;
  }

  /**
   * Subscribe to plugin events
   */
  onEvent(handler: PluginEventHandler): () => void {
    return this.registry.on(handler);
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    total: number;
    enabled: number;
    disabled: number;
    bySource: Record<string, number>;
  } {
    return this.registry.stats();
  }

  /**
   * Clear all plugins
   */
  async clearPlugins(): Promise<void> {
    await this.registry.clear();
  }

  /**
   * Helper to add timeout to promises
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage: string
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
      )
    ]);
  }
}

// Export registry
export { PluginRegistry, defaultRegistry } from './registry';

// Default manager instance
export const defaultPluginManager = new PluginManager();

// Convenience functions
export function registerPlugin(plugin: ExtractorPlugin, config?: Record<string, any>): void {
  defaultPluginManager.registerPlugin(plugin, config);
}

export async function unregisterPlugin(pluginId: string): Promise<boolean> {
  return defaultPluginManager.unregisterPlugin(pluginId);
}

export function listPlugins(): Array<{ id: string; name: string; version: string; enabled: boolean; source: string }> {
  return defaultPluginManager.listPlugins();
}

export async function loadPlugin(packageName: string, config?: Record<string, any>): Promise<PluginLoadResult> {
  return defaultPluginManager.loadPlugin(packageName, config);
}

export async function loadPluginFromFile(filePath: string, config?: Record<string, any>): Promise<PluginLoadResult> {
  return defaultPluginManager.loadPluginFromFile(filePath, config);
}
