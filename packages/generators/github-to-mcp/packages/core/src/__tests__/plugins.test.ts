/**
 * @fileoverview Unit tests for plugin system
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  PluginManager,
  PluginRegistry,
  ExtractorPlugin,
  PluginRepoContext,
  PluginDetectionResult,
  PluginExtractionResult
} from '../plugins';

// Create a mock plugin factory
function createMockPlugin(overrides: Partial<ExtractorPlugin> = {}): ExtractorPlugin {
  return {
    metadata: {
      id: 'mock-plugin',
      name: 'Mock Plugin',
      version: '1.0.0',
      description: 'A mock plugin for testing'
    },
    detect: vi.fn().mockResolvedValue({
      shouldProcess: true,
      confidence: 0.8,
      reason: 'Mock detection'
    }),
    extract: vi.fn().mockResolvedValue({
      tools: [
        {
          name: 'mock_tool',
          description: 'A mock tool',
          inputSchema: { type: 'object', properties: {}, required: [] },
          source: { type: 'code', file: 'mock.ts' }
        }
      ],
      sourceFiles: ['mock.ts']
    }),
    ...overrides
  };
}

// Create mock repo context
function createMockContext(): PluginRepoContext {
  return {
    owner: 'test',
    repo: 'repo',
    url: 'https://github.com/test/repo',
    classification: {
      type: 'library',
      confidence: 0.7,
      indicators: ['test']
    },
    metadata: {
      stars: 100,
      language: 'TypeScript'
    }
  };
}

describe('PluginRegistry', () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = new PluginRegistry();
  });

  afterEach(async () => {
    await registry.clear();
  });

  describe('register', () => {
    it('should register a plugin', () => {
      const plugin = createMockPlugin();
      registry.register(plugin);

      expect(registry.has('mock-plugin')).toBe(true);
      expect(registry.get('mock-plugin')).toBe(plugin);
    });

    it('should call onRegister hook', () => {
      const onRegister = vi.fn();
      const plugin = createMockPlugin({
        hooks: { onRegister }
      });

      registry.register(plugin);

      expect(onRegister).toHaveBeenCalled();
    });

    it('should accept configuration', () => {
      const plugin = createMockPlugin();
      const config = { option1: 'value1' };

      registry.register(plugin, config);

      expect(registry.getConfig('mock-plugin')).toEqual(config);
    });
  });

  describe('unregister', () => {
    it('should unregister a plugin', async () => {
      const plugin = createMockPlugin();
      registry.register(plugin);

      const result = await registry.unregister('mock-plugin');

      expect(result).toBe(true);
      expect(registry.has('mock-plugin')).toBe(false);
    });

    it('should call onUnregister hook', async () => {
      const onUnregister = vi.fn();
      const plugin = createMockPlugin({
        hooks: { onUnregister }
      });

      registry.register(plugin);
      await registry.unregister('mock-plugin');

      expect(onUnregister).toHaveBeenCalled();
    });

    it('should return false for non-existent plugin', async () => {
      const result = await registry.unregister('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('list', () => {
    it('should list all registered plugins', () => {
      const plugin1 = createMockPlugin({ metadata: { id: 'plugin-1', name: 'Plugin 1', version: '1.0.0', description: 'Test' } });
      const plugin2 = createMockPlugin({ metadata: { id: 'plugin-2', name: 'Plugin 2', version: '2.0.0', description: 'Test' } });

      registry.register(plugin1);
      registry.register(plugin2);

      const list = registry.list();

      expect(list.length).toBe(2);
      expect(list.map(p => p.id)).toContain('plugin-1');
      expect(list.map(p => p.id)).toContain('plugin-2');
    });

    it('should include enabled status', () => {
      const plugin = createMockPlugin();
      registry.register(plugin);

      const list = registry.list();

      expect(list[0].enabled).toBe(true);
    });
  });

  describe('enable/disable', () => {
    it('should disable a plugin', () => {
      const plugin = createMockPlugin();
      registry.register(plugin);

      registry.disable('mock-plugin');

      const entry = registry.getEntry('mock-plugin');
      expect(entry?.enabled).toBe(false);
    });

    it('should enable a disabled plugin', () => {
      const plugin = createMockPlugin();
      registry.register(plugin);
      registry.disable('mock-plugin');

      registry.enable('mock-plugin');

      const entry = registry.getEntry('mock-plugin');
      expect(entry?.enabled).toBe(true);
    });

    it('should return false for non-existent plugin', () => {
      expect(registry.disable('non-existent')).toBe(false);
      expect(registry.enable('non-existent')).toBe(false);
    });
  });

  describe('getEnabled', () => {
    it('should return only enabled plugins', () => {
      const plugin1 = createMockPlugin({ metadata: { id: 'plugin-1', name: 'Plugin 1', version: '1.0.0', description: 'Test' } });
      const plugin2 = createMockPlugin({ metadata: { id: 'plugin-2', name: 'Plugin 2', version: '2.0.0', description: 'Test' } });

      registry.register(plugin1);
      registry.register(plugin2);
      registry.disable('plugin-2');

      const enabled = registry.getEnabled();

      expect(enabled.length).toBe(1);
      expect(enabled[0].metadata.id).toBe('plugin-1');
    });
  });

  describe('updateConfig', () => {
    it('should update plugin configuration', () => {
      const plugin = createMockPlugin();
      registry.register(plugin, { option1: 'value1' });

      registry.updateConfig('mock-plugin', { option2: 'value2' });

      expect(registry.getConfig('mock-plugin')).toEqual({
        option1: 'value1',
        option2: 'value2'
      });
    });

    it('should validate config against schema', () => {
      const plugin = createMockPlugin({
        configSchema: [
          { name: 'requiredOption', type: 'string', description: 'Required', required: true }
        ]
      });
      registry.register(plugin);

      expect(() => registry.updateConfig('mock-plugin', {})).toThrow('Missing required config option');
    });
  });

  describe('events', () => {
    it('should emit events on registration', () => {
      const handler = vi.fn();
      registry.on(handler);

      const plugin = createMockPlugin();
      registry.register(plugin);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'registered',
          pluginId: 'mock-plugin'
        })
      );
    });

    it('should emit events on unregistration', async () => {
      const plugin = createMockPlugin();
      registry.register(plugin);

      const handler = vi.fn();
      registry.on(handler);

      await registry.unregister('mock-plugin');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'unregistered',
          pluginId: 'mock-plugin'
        })
      );
    });

    it('should allow unsubscribing', () => {
      const handler = vi.fn();
      const unsubscribe = registry.on(handler);

      unsubscribe();

      const plugin = createMockPlugin();
      registry.register(plugin);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('stats', () => {
    it('should return registry statistics', () => {
      const plugin1 = createMockPlugin({ metadata: { id: 'plugin-1', name: 'Plugin 1', version: '1.0.0', description: 'Test' } });
      const plugin2 = createMockPlugin({ metadata: { id: 'plugin-2', name: 'Plugin 2', version: '2.0.0', description: 'Test' } });

      registry.register(plugin1);
      registry.register(plugin2);
      registry.disable('plugin-2');

      const stats = registry.stats();

      expect(stats.total).toBe(2);
      expect(stats.enabled).toBe(1);
      expect(stats.disabled).toBe(1);
      expect(stats.bySource.inline).toBe(2);
    });
  });
});

describe('PluginManager', () => {
  let manager: PluginManager;
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = new PluginRegistry();
    manager = new PluginManager({ verbose: false }, registry);
  });

  afterEach(async () => {
    await manager.clearPlugins();
  });

  describe('registerPlugin', () => {
    it('should register a plugin', () => {
      const plugin = createMockPlugin();
      manager.registerPlugin(plugin);

      const list = manager.listPlugins();
      expect(list.length).toBe(1);
      expect(list[0].id).toBe('mock-plugin');
    });
  });

  describe('unregisterPlugin', () => {
    it('should unregister a plugin', async () => {
      const plugin = createMockPlugin();
      manager.registerPlugin(plugin);

      const result = await manager.unregisterPlugin('mock-plugin');

      expect(result).toBe(true);
      expect(manager.listPlugins().length).toBe(0);
    });
  });

  describe('detectPlugins', () => {
    it('should detect which plugins should process the repo', async () => {
      const plugin = createMockPlugin();
      manager.registerPlugin(plugin);

      const context = createMockContext();
      const results = await manager.detectPlugins(context, ['file1.ts', 'file2.ts']);

      expect(results.get('mock-plugin')).toBeDefined();
      expect(results.get('mock-plugin')?.shouldProcess).toBe(true);
    });

    it('should handle detection errors gracefully', async () => {
      const plugin = createMockPlugin({
        detect: vi.fn().mockRejectedValue(new Error('Detection failed'))
      });
      manager.registerPlugin(plugin);

      const context = createMockContext();
      const results = await manager.detectPlugins(context, []);

      expect(results.get('mock-plugin')?.shouldProcess).toBe(false);
    });
  });

  describe('extract', () => {
    it('should run extraction with applicable plugins', async () => {
      const plugin = createMockPlugin();
      manager.registerPlugin(plugin);

      const context = createMockContext();
      const getFile = vi.fn().mockResolvedValue('file content');

      const { tools, results, errors } = await manager.extract(context, getFile, ['file.ts']);

      expect(tools.length).toBe(1);
      expect(tools[0].name).toBe('mock_tool');
      expect(results.get('mock-plugin')).toBeDefined();
      expect(errors.size).toBe(0);
    });

    it('should skip plugins that should not process', async () => {
      const plugin = createMockPlugin({
        detect: vi.fn().mockResolvedValue({
          shouldProcess: false,
          confidence: 0,
          reason: 'Not applicable'
        })
      });
      manager.registerPlugin(plugin);

      const context = createMockContext();
      const getFile = vi.fn();

      const { tools } = await manager.extract(context, getFile, []);

      expect(tools.length).toBe(0);
      expect(plugin.extract).not.toHaveBeenCalled();
    });

    it('should handle extraction errors', async () => {
      const plugin = createMockPlugin({
        extract: vi.fn().mockRejectedValue(new Error('Extraction failed'))
      });
      manager.registerPlugin(plugin);

      const context = createMockContext();
      const getFile = vi.fn();

      const { errors } = await manager.extract(context, getFile, []);

      expect(errors.get('mock-plugin')).toBeDefined();
      expect(errors.get('mock-plugin')?.message).toBe('Extraction failed');
    });

    it('should call lifecycle hooks', async () => {
      const beforeExtract = vi.fn();
      const afterExtract = vi.fn();
      const plugin = createMockPlugin({
        hooks: { beforeExtract, afterExtract }
      });
      manager.registerPlugin(plugin);

      const context = createMockContext();
      const getFile = vi.fn();

      await manager.extract(context, getFile, []);

      expect(beforeExtract).toHaveBeenCalledWith(context);
      expect(afterExtract).toHaveBeenCalled();
    });
  });

  describe('extractWithPlugin', () => {
    it('should run extraction with a specific plugin', async () => {
      const plugin = createMockPlugin();
      manager.registerPlugin(plugin);

      const context = createMockContext();
      const getFile = vi.fn();

      const result = await manager.extractWithPlugin('mock-plugin', context, getFile);

      expect(result.tools.length).toBe(1);
    });

    it('should throw for non-existent plugin', async () => {
      const context = createMockContext();
      const getFile = vi.fn();

      await expect(
        manager.extractWithPlugin('non-existent', context, getFile)
      ).rejects.toThrow('Plugin not found');
    });
  });

  describe('enablePlugin/disablePlugin', () => {
    it('should enable and disable plugins', () => {
      const plugin = createMockPlugin();
      manager.registerPlugin(plugin);

      manager.disablePlugin('mock-plugin');
      expect(manager.listPlugins()[0].enabled).toBe(false);

      manager.enablePlugin('mock-plugin');
      expect(manager.listPlugins()[0].enabled).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return statistics', () => {
      const plugin = createMockPlugin();
      manager.registerPlugin(plugin);

      const stats = manager.getStats();

      expect(stats.total).toBe(1);
      expect(stats.enabled).toBe(1);
    });
  });
});
