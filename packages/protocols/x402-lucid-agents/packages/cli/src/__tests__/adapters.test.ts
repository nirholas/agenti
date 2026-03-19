import { describe, expect, it } from 'bun:test';

import { getAdapterDefinition } from '../adapters';

describe('Adapter Snippets', () => {
  it('all adapters only provide adapter-specific code', () => {
    const adapters = [
      'hono',
      'express',
      'tanstack-ui',
      'tanstack-headless',
      'next',
    ];

    for (const adapterId of adapters) {
      const adapter = getAdapterDefinition(adapterId);

      // preSetup should be empty - templates handle agent creation
      expect(adapter.snippets.preSetup.trim()).toBe('');

      // appCreation should expect agent to already exist (from template)
      expect(adapter.snippets.appCreation).toContain('agent');
    }
  });

  it('Hono adapter provides adapter-specific code', () => {
    const adapter = getAdapterDefinition('hono');

    // Should only import adapter-specific code
    expect(adapter.snippets.imports).toContain('createAgentApp');
    expect(adapter.snippets.imports).toContain('@lucid-agents/hono');
    expect(adapter.snippets.imports).not.toContain('createAgent(');
    expect(adapter.snippets.imports).not.toContain('from "@lucid-agents/core"');
    expect(adapter.snippets.imports).not.toContain('http');

    // preSetup should be empty
    expect(adapter.snippets.preSetup.trim()).toBe('');

    // appCreation should use agent (created by template)
    expect(adapter.snippets.appCreation).toContain('createAgentApp(agent)');
    expect(adapter.snippets.entrypointRegistration).toContain('addEntrypoint');
  });

  it('Express adapter provides adapter-specific code', () => {
    const adapter = getAdapterDefinition('express');

    // Should only import adapter-specific code
    expect(adapter.snippets.imports).toContain('createAgentApp');
    expect(adapter.snippets.imports).toContain('@lucid-agents/express');
    expect(adapter.snippets.imports).not.toContain('createAgent(');
    expect(adapter.snippets.imports).not.toContain('http');

    // preSetup should be empty
    expect(adapter.snippets.preSetup.trim()).toBe('');

    // appCreation should use agent (created by template)
    expect(adapter.snippets.appCreation).toContain('createAgentApp(agent)');
    expect(adapter.snippets.entrypointRegistration).toContain('addEntrypoint');
  });

  it('TanStack UI adapter provides adapter-specific code', () => {
    const adapter = getAdapterDefinition('tanstack-ui');

    // Should only import adapter-specific code
    expect(adapter.snippets.imports).toContain('createTanStackRuntime');
    expect(adapter.snippets.imports).toContain('@lucid-agents/tanstack');
    expect(adapter.snippets.imports).not.toContain('createAgent(');
    expect(adapter.snippets.imports).not.toContain('http');

    // preSetup should be empty
    expect(adapter.snippets.preSetup.trim()).toBe('');

    // appCreation should use agent (created by template)
    expect(adapter.snippets.appCreation).toContain(
      'createTanStackRuntime(agent)'
    );
    expect(adapter.snippets.appCreation).toContain('handlers');
    expect(adapter.snippets.appCreation).toContain('runtime');

    // Should use runtime.entrypoints.add
    expect(adapter.snippets.entrypointRegistration).toContain(
      'runtime.entrypoints.add'
    );
  });

  it('TanStack Headless adapter provides adapter-specific code', () => {
    const adapter = getAdapterDefinition('tanstack-headless');

    // Should only import adapter-specific code
    expect(adapter.snippets.imports).toContain('createTanStackRuntime');
    expect(adapter.snippets.imports).toContain('@lucid-agents/tanstack');
    expect(adapter.snippets.imports).not.toContain('createAgent(');
    expect(adapter.snippets.imports).not.toContain('http');

    // preSetup should be empty
    expect(adapter.snippets.preSetup.trim()).toBe('');

    // appCreation should use agent (created by template)
    expect(adapter.snippets.appCreation).toContain(
      'createTanStackRuntime(agent)'
    );
    expect(adapter.snippets.appCreation).toContain('handlers');
    expect(adapter.snippets.appCreation).toContain('runtime');

    // Should use runtime.entrypoints.add
    expect(adapter.snippets.entrypointRegistration).toContain(
      'runtime.entrypoints.add'
    );
  });

  it('Next adapter provides adapter-specific code', () => {
    const adapter = getAdapterDefinition('next');

    // Should have no imports (Next.js doesn't need adapter-specific imports)
    expect(adapter.snippets.imports.trim()).toBe('');

    // preSetup should be empty
    expect(adapter.snippets.preSetup.trim()).toBe('');

    // appCreation should use agent (created by template)
    expect(adapter.snippets.appCreation).toContain('agent');
    expect(adapter.snippets.appCreation).toContain('entrypoints');
  });

  it('adapters do not include agent creation code', () => {
    const adapters = [
      'hono',
      'express',
      'tanstack-ui',
      'tanstack-headless',
      'next',
    ];

    for (const adapterId of adapters) {
      const adapter = getAdapterDefinition(adapterId);

      // Adapters should not create agents - templates handle that
      expect(adapter.snippets.imports).not.toContain('createAgent(');
      expect(adapter.snippets.imports).not.toContain(
        'from "@lucid-agents/core"'
      );
      expect(adapter.snippets.imports).not.toContain('http');
      expect(adapter.snippets.preSetup.trim()).toBe('');
      expect(adapter.snippets.appCreation).not.toContain('createAgent(');
      expect(adapter.snippets.appCreation).not.toContain('.use(http())');
    }
  });
});
