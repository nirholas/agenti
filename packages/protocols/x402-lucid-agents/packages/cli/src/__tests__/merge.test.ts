import { describe, test } from 'bun:test';

// Note: These functions would need to be exported from index.ts for testing
// For now, this file documents the expected test structure

describe('Template Merge System', () => {
  describe('parseTemplateSections', () => {
    test('parses valid template with all markers', () => {
      const template = `{{ADAPTER_IMPORTS}}
import { foo } from "bar";

{{ADAPTER_PRE_SETUP}}
const setup = true;

{{ADAPTER_POST_SETUP}}
export const client = {};
`;

      // Would call: const sections = parseTemplateSections(template);
      // expect(sections['{{ADAPTER_IMPORTS}}']).toContain('import { foo }');
      // expect(sections['{{ADAPTER_PRE_SETUP}}']).toContain('const setup');
      // expect(sections['{{ADAPTER_POST_SETUP}}']).toContain('export const client');
    });

    test('throws error when marker is missing', () => {
      const template = `{{ADAPTER_IMPORTS}}
const code = true;
`;

      // expect(() => parseTemplateSections(template)).toThrow('missing required marker');
    });
  });

  describe('mergePackageJson', () => {
    test('merges dependencies correctly', () => {
      const adapter = {
        name: 'test',
        dependencies: { a: '1.0.0', b: '2.0.0' },
      };
      const template = {
        package: {
          dependencies: { c: '3.0.0' },
        },
      };

      // const result = mergePackageJson(adapter, template);
      // expect(result.dependencies).toEqual({
      //   a: '1.0.0',
      //   b: '2.0.0',
      //   c: '3.0.0',
      // });
    });

    test('warns on version conflicts', () => {
      const adapter = {
        dependencies: { shared: '1.0.0' },
      };
      const template = {
        package: {
          dependencies: { shared: '2.0.0' },
        },
      };

      // Should log warning but not throw
      // const result = mergePackageJson(adapter, template);
      // expect(result.dependencies.shared).toBe('2.0.0');
    });
  });

  describe('validateAdapterCompatibility', () => {
    test('passes when adapter is in list', () => {
      const template = {
        id: 'test',
        adapters: ['hono', 'tanstack'],
      };

      // expect(() => validateAdapterCompatibility(template, 'hono')).not.toThrow();
    });

    test('throws when adapter not in list', () => {
      const template = {
        id: 'test',
        adapters: ['hono'],
      };

      // expect(() => validateAdapterCompatibility(template, 'tanstack'))
      //   .toThrow('does not support adapter');
    });
  });

  describe('mergeAdapterAndTemplate', () => {
    test('combines adapter snippets with template sections', () => {
      const snippets = {
        imports: 'import { createAgentApp } from "@lucid-agents/hono";',
        preSetup: '',
        appCreation: 'const { app, addEntrypoint } = createAgentApp(...);',
        entrypointRegistration: 'addEntrypoint({...});',
        postSetup: '',
        exports: 'export { app };',
      };

      const sections = {
        '{{ADAPTER_IMPORTS}}': 'import { identity } from "module";',
        '{{ADAPTER_PRE_SETUP}}': 'const config = {...};',
        '{{ADAPTER_POST_SETUP}}': 'export const client = {};',
      };

      // const result = mergeAdapterAndTemplate(snippets, sections);
      // expect(result).toContain('import { createAgentApp }');
      // expect(result).toContain('import { identity }');
      // expect(result).toContain('const config =');
      // expect(result).toContain('export const client');
      // expect(result).toContain('export { app }');
    });
  });
});

describe('Adapter System', () => {
  test('validates template has required adapters field', () => {
    // Test that templates with adapters field are validated correctly
  });

  test('allows templates without adapters field', () => {
    // Templates without adapters field should work with all adapters
  });
});
