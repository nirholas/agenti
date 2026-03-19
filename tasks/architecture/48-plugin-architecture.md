# Task: Implement Plugin Architecture for Tool Extensions

## Priority: MEDIUM

## Context
With 380+ tools, the monolithic tool registry becomes hard to maintain. A plugin architecture allows teams to develop, test, and deploy tools independently.

## Requirements
1. Define a `ToolPlugin` interface:
   ```typescript
   interface ToolPlugin {
     name: string;
     version: string;
     tools: ToolDefinition[];
     initialize(config: PluginConfig): Promise<void>;
     shutdown(): Promise<void>;
     healthCheck(): Promise<HealthStatus>;
   }
   ```
2. Plugin lifecycle: `discover` -> `validate` -> `initialize` -> `register` -> `shutdown`
3. Plugin sources:
   - Built-in (bundled with the server)
   - Local directory (`PLUGIN_DIR` environment variable)
   - npm packages (`@agenti/plugin-*`)
4. Plugin isolation:
   - Each plugin gets its own configuration namespace
   - Plugins cannot access other plugins' state
   - Failed plugin initialization doesn't crash the server
5. Plugin validation:
   - Schema validation for tool definitions
   - Security scan for known dangerous patterns
   - Version compatibility check
6. Hot-reload: plugins can be added/removed without restart (optional)
7. Plugin CLI: `agenti plugin list|install|remove|enable|disable`

## Acceptance Criteria
- [ ] ToolPlugin interface defined and documented
- [ ] Plugin lifecycle management working
- [ ] At least 3 existing tool categories converted to plugins
- [ ] Failed plugins don't crash server
- [ ] Plugin CLI commands working
