# Plugin Development

Agenti supports plugins for extending functionality without modifying the core codebase. This guide covers creating and registering plugins.

## Plugin Structure

A plugin is a package that exports tools following the Agenti tool interface:

```
my-agenti-plugin/
├── package.json
├── src/
│   ├── index.ts        # Plugin entry point
│   └── tools/
│       ├── tool-one.ts
│       └── tool-two.ts
└── tests/
    └── tools.test.ts
```

## Creating a Plugin

### 1. Initialize the Package

```bash
mkdir my-agenti-plugin && cd my-agenti-plugin
npm init -y
npm install zod typescript
```

### 2. Define Tools

```typescript
// src/tools/my-tool.ts
import { z } from 'zod';

const inputSchema = z.object({
  query: z.string().describe('Search query'),
});

export const myPluginTool = {
  name: 'myplugin_search',
  description: 'Search for something using my plugin',
  inputSchema,
  async execute(params: unknown) {
    const { query } = inputSchema.parse(params);
    // Plugin logic here
    return { success: true, data: { results: [] } };
  },
};
```

### 3. Export from Entry Point

```typescript
// src/index.ts
export { myPluginTool } from './tools/my-tool';

// Export all tools as an array for easy registration
export const tools = [myPluginTool];
```

### 4. Configure package.json

```json
{
  "name": "my-agenti-plugin",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "keywords": ["agenti", "mcp", "plugin"],
  "peerDependencies": {
    "zod": "^4.0.0"
  }
}
```

## Registering Plugins

### Via Configuration

Add plugins to the Agenti configuration:

```json
{
  "plugins": [
    "my-agenti-plugin",
    "./local-plugins/custom-plugin"
  ]
}
```

### Programmatic Registration

When using Agenti as a library:

```typescript
import { createServer } from '@nirholas/agenti';
import { tools as myPluginTools } from 'my-agenti-plugin';

const server = createServer({
  additionalTools: [...myPluginTools],
});
```

## Plugin Guidelines

### Naming Conventions
- Package name: `agenti-plugin-<name>` or `@scope/agenti-plugin-<name>`
- Tool names: Prefix with plugin identifier (e.g., `myplugin_action`)

### Best Practices
1. **Use Zod** for input validation (consistent with core)
2. **Return standard format** (`{ success, data }` or `{ success, error }`)
3. **Include descriptions** on all schema fields
4. **Handle errors gracefully** - never throw unhandled exceptions
5. **Document environment variables** your plugin requires
6. **Add tests** for all tools
7. **Keep dependencies minimal** to avoid conflicts

### What Plugins Can Do
- Add new tools for additional data sources
- Integrate with custom APIs and services
- Add chain support for niche blockchains
- Provide domain-specific analytics
- Add custom notification integrations

### What Plugins Should Not Do
- Modify core Agenti behavior
- Override existing tools
- Access internal Agenti state directly
- Bundle large dependencies unnecessarily

## Testing Plugins

```typescript
import { describe, it, expect } from 'vitest';
import { myPluginTool } from '../src';

describe('my plugin', () => {
  it('should export tools with correct interface', () => {
    expect(myPluginTool.name).toBeDefined();
    expect(myPluginTool.description).toBeDefined();
    expect(myPluginTool.inputSchema).toBeDefined();
    expect(myPluginTool.execute).toBeInstanceOf(Function);
  });
});
```

## Publishing

```bash
npm run build
npm publish
```

Users can then install and configure your plugin:

```bash
npm install my-agenti-plugin
```
