/**
 * @fileoverview Plugin registry for managing extractor plugins
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import {
  ExtractorPlugin,
  PluginRegistryEntry,
  PluginLoadResult,
  PluginFactory,
  PluginEvent,
  PluginEventHandler
} from './types';
import * as path from 'path';
import * as fs from 'fs/promises';

/**
 * Plugin registry that manages loading, storing, and accessing plugins
 */
export class PluginRegistry {
  private plugins: Map<string, PluginRegistryEntry> = new Map();
  private eventHandlers: Set<PluginEventHandler> = new Set();

  /**
   * Register a plugin from an ExtractorPlugin instance
   */
  register(plugin: ExtractorPlugin, config: Record<string, any> = {}): void {
    const entry: PluginRegistryEntry = {
      plugin,
      config,
      enabled: true,
      source: 'inline',
      loadedAt: new Date()
    };

    this.plugins.set(plugin.metadata.id, entry);
    
    // Call onRegister hook
    plugin.hooks?.onRegister?.();

    this.emit({
      type: 'registered',
      pluginId: plugin.metadata.id,
      timestamp: new Date(),
      data: { name: plugin.metadata.name, version: plugin.metadata.version }
    });
  }

  /**
   * Unregister a plugin by ID
   */
  async unregister(pluginId: string): Promise<boolean> {
    const entry = this.plugins.get(pluginId);
    if (!entry) {
      return false;
    }

    // Call onUnregister hook
    await entry.plugin.hooks?.onUnregister?.();

    this.plugins.delete(pluginId);

    this.emit({
      type: 'unregistered',
      pluginId,
      timestamp: new Date()
    });

    return true;
  }

  /**
   * Load a plugin from an npm package
   */
  async loadFromNpm(packageName: string, config: Record<string, any> = {}): Promise<PluginLoadResult> {
    try {
      // Dynamic import of the npm package
      const module = await import(packageName);
      
      // Check for default export or plugin factory
      let plugin: ExtractorPlugin;
      
      if (typeof module.default === 'function') {
        // Plugin factory
        plugin = (module.default as PluginFactory)(config);
      } else if (typeof module.default === 'object' && module.default.metadata) {
        // Direct plugin export
        plugin = module.default;
      } else if (typeof module.createPlugin === 'function') {
        // Named factory export
        plugin = module.createPlugin(config);
      } else {
        throw new Error(`Package ${packageName} does not export a valid plugin`);
      }

      const entry: PluginRegistryEntry = {
        plugin,
        config,
        enabled: true,
        source: 'npm',
        loadedAt: new Date()
      };

      this.plugins.set(plugin.metadata.id, entry);
      plugin.hooks?.onRegister?.();

      this.emit({
        type: 'registered',
        pluginId: plugin.metadata.id,
        timestamp: new Date(),
        data: { source: 'npm', package: packageName }
      });

      return {
        success: true,
        plugin,
        source: 'npm'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        source: 'npm'
      };
    }
  }

  /**
   * Load a plugin from a local file
   */
  async loadFromFile(filePath: string, config: Record<string, any> = {}): Promise<PluginLoadResult> {
    try {
      const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
      
      // Check file exists
      await fs.access(absolutePath);

      // Dynamic import
      const module = await import(absolutePath);

      let plugin: ExtractorPlugin;

      if (typeof module.default === 'function') {
        plugin = (module.default as PluginFactory)(config);
      } else if (typeof module.default === 'object' && module.default.metadata) {
        plugin = module.default;
      } else if (typeof module.createPlugin === 'function') {
        plugin = module.createPlugin(config);
      } else {
        throw new Error(`File ${filePath} does not export a valid plugin`);
      }

      const entry: PluginRegistryEntry = {
        plugin,
        config,
        enabled: true,
        source: 'local',
        loadedAt: new Date()
      };

      this.plugins.set(plugin.metadata.id, entry);
      plugin.hooks?.onRegister?.();

      this.emit({
        type: 'registered',
        pluginId: plugin.metadata.id,
        timestamp: new Date(),
        data: { source: 'local', file: filePath }
      });

      return {
        success: true,
        plugin,
        source: 'local'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        source: 'local'
      };
    }
  }

  /**
   * Load all plugins from a directory
   */
  async loadFromDirectory(dirPath: string, config: Record<string, any> = {}): Promise<PluginLoadResult[]> {
    const results: PluginLoadResult[] = [];

    try {
      const absolutePath = path.isAbsolute(dirPath) ? dirPath : path.resolve(process.cwd(), dirPath);
      const entries = await fs.readdir(absolutePath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.ts') || entry.name.endsWith('.mjs'))) {
          const filePath = path.join(absolutePath, entry.name);
          const result = await this.loadFromFile(filePath, config);
          results.push(result);
        } else if (entry.isDirectory()) {
          // Check for index file in directory
          const indexPath = path.join(absolutePath, entry.name, 'index.js');
          try {
            await fs.access(indexPath);
            const result = await this.loadFromFile(indexPath, config);
            results.push(result);
          } catch {
            // No index file, skip directory
          }
        }
      }
    } catch (error) {
      results.push({
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        source: 'local'
      });
    }

    return results;
  }

  /**
   * Get a plugin by ID
   */
  get(pluginId: string): ExtractorPlugin | undefined {
    return this.plugins.get(pluginId)?.plugin;
  }

  /**
   * Get a plugin entry by ID
   */
  getEntry(pluginId: string): PluginRegistryEntry | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * Check if a plugin is registered
   */
  has(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  /**
   * Enable a plugin
   */
  enable(pluginId: string): boolean {
    const entry = this.plugins.get(pluginId);
    if (!entry) return false;

    entry.enabled = true;
    
    this.emit({
      type: 'enabled',
      pluginId,
      timestamp: new Date()
    });

    return true;
  }

  /**
   * Disable a plugin
   */
  disable(pluginId: string): boolean {
    const entry = this.plugins.get(pluginId);
    if (!entry) return false;

    entry.enabled = false;

    this.emit({
      type: 'disabled',
      pluginId,
      timestamp: new Date()
    });

    return true;
  }

  /**
   * List all registered plugins
   */
  list(): Array<{ id: string; name: string; version: string; enabled: boolean; source: string }> {
    return Array.from(this.plugins.entries()).map(([id, entry]) => ({
      id,
      name: entry.plugin.metadata.name,
      version: entry.plugin.metadata.version,
      enabled: entry.enabled,
      source: entry.source
    }));
  }

  /**
   * Get all enabled plugins
   */
  getEnabled(): ExtractorPlugin[] {
    return Array.from(this.plugins.values())
      .filter(entry => entry.enabled)
      .map(entry => entry.plugin);
  }

  /**
   * Get all plugins
   */
  getAll(): ExtractorPlugin[] {
    return Array.from(this.plugins.values()).map(entry => entry.plugin);
  }

  /**
   * Update plugin configuration
   */
  updateConfig(pluginId: string, config: Record<string, any>): boolean {
    const entry = this.plugins.get(pluginId);
    if (!entry) return false;

    // Validate config against schema if available
    if (entry.plugin.configSchema) {
      for (const schema of entry.plugin.configSchema) {
        if (schema.required && !(schema.name in config)) {
          throw new Error(`Missing required config option: ${schema.name}`);
        }
        if (schema.name in config && schema.validate) {
          if (!schema.validate(config[schema.name])) {
            throw new Error(`Invalid value for config option: ${schema.name}`);
          }
        }
      }
    }

    entry.config = { ...entry.config, ...config };
    return true;
  }

  /**
   * Get plugin configuration
   */
  getConfig(pluginId: string): Record<string, any> | undefined {
    return this.plugins.get(pluginId)?.config;
  }

  /**
   * Subscribe to plugin events
   */
  on(handler: PluginEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  /**
   * Emit a plugin event
   */
  private emit(event: PluginEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch {
        // Ignore handler errors
      }
    }
  }

  /**
   * Clear all plugins
   */
  async clear(): Promise<void> {
    for (const [id, entry] of this.plugins) {
      await entry.plugin.hooks?.onUnregister?.();
      this.emit({
        type: 'unregistered',
        pluginId: id,
        timestamp: new Date()
      });
    }
    this.plugins.clear();
  }

  /**
   * Get registry statistics
   */
  stats(): {
    total: number;
    enabled: number;
    disabled: number;
    bySource: Record<string, number>;
  } {
    const entries = Array.from(this.plugins.values());
    const bySource: Record<string, number> = {};

    for (const entry of entries) {
      bySource[entry.source] = (bySource[entry.source] || 0) + 1;
    }

    return {
      total: entries.length,
      enabled: entries.filter(e => e.enabled).length,
      disabled: entries.filter(e => !e.enabled).length,
      bySource
    };
  }
}

// Default registry instance
export const defaultRegistry = new PluginRegistry();
