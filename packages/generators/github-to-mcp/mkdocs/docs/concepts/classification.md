# Repository Classification

How GitHub to MCP analyzes and categorizes repositories.

## Why Classification Matters

Different repository types require different extraction strategies:

- **API SDKs** → Extract from OpenAPI specs
- **MCP Servers** → Parse existing tool definitions
- **CLI Tools** → Extract command structure
- **Libraries** → Default to universal tools

## Classification Types

### mcp-server

An existing MCP server implementation.

**Indicators:**
- `@modelcontextprotocol/sdk` in dependencies
- `mcp.json` configuration file
- `server.tool()` patterns in code
- "MCP" in README/description

**Extraction Strategy:**
Parse existing tool definitions and re-export them.

---

### api-sdk

A client library for REST or GraphQL APIs.

**Indicators:**
- `openapi.json`, `swagger.yaml` files
- `schema.graphql` file
- Package name contains `-sdk`, `-client`, `-api`
- REST client patterns in code

**Extraction Strategy:**
Parse OpenAPI/GraphQL specs, generate typed API tools.

---

### cli-tool

A command-line interface application.

**Indicators:**
- `bin` entry in package.json
- `argparse`, `commander`, `yargs` dependencies
- `click`, `typer` for Python
- CLI documentation in README

**Extraction Strategy:**
Parse CLI help output or code to extract commands.

---

### library

A general-purpose programming library.

**Indicators:**
- Published to npm/PyPI
- Exports functions/classes
- No specific API or CLI patterns
- Generic package name

**Extraction Strategy:**
Universal tools only, plus any detected patterns.

---

### documentation

A documentation-only repository.

**Indicators:**
- Primarily markdown/MDX files
- MkDocs, Docusaurus, Nextra config
- No source code directories
- "docs" in repo name

**Extraction Strategy:**
Universal tools optimized for documentation browsing.

---

### data

A data or configuration repository.

**Indicators:**
- JSON, YAML, CSV files
- No source code
- "data", "config", "assets" in name
- Large binary files

**Extraction Strategy:**
Universal tools for data access.

---

### unknown

Repository type couldn't be determined.

**Extraction Strategy:**
Universal tools only.

---

## Classification Logic

```typescript
function classifyRepository(repo: RepositoryInfo): RepositoryType {
  const { readme, files, packageJson } = repo;
  
  // Priority 1: Check for MCP server
  if (isMcpServer(packageJson, files)) {
    return 'mcp-server';
  }
  
  // Priority 2: Check for API patterns
  if (hasApiSpecs(files)) {
    return 'api-sdk';
  }
  
  // Priority 3: Check for CLI
  if (isCliTool(packageJson, files)) {
    return 'cli-tool';
  }
  
  // Priority 4: Check for documentation
  if (isDocumentation(files, readme)) {
    return 'documentation';
  }
  
  // Priority 5: Check for data repo
  if (isDataRepo(files)) {
    return 'data';
  }
  
  // Priority 6: Check for library
  if (isLibrary(packageJson)) {
    return 'library';
  }
  
  return 'unknown';
}
```

## Detection Functions

### isMcpServer

```typescript
function isMcpServer(pkg: PackageJson, files: FileTree): boolean {
  // Check dependencies
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (deps['@modelcontextprotocol/sdk']) return true;
  
  // Check for MCP config
  if (files.includes('mcp.json')) return true;
  
  // Check for MCP patterns in source
  const sourceFiles = files.filter(f => f.endsWith('.ts') || f.endsWith('.js'));
  for (const file of sourceFiles) {
    const content = await readFile(file);
    if (content.includes('server.tool(') || 
        content.includes('McpServer')) {
      return true;
    }
  }
  
  return false;
}
```

### hasApiSpecs

```typescript
function hasApiSpecs(files: FileTree): boolean {
  const specPatterns = [
    'openapi.json', 'openapi.yaml', 'openapi.yml',
    'swagger.json', 'swagger.yaml', 'swagger.yml',
    'api-spec.json', 'api-spec.yaml',
    'schema.graphql', 'schema.gql',
  ];
  
  return specPatterns.some(pattern => 
    files.some(f => f.endsWith(pattern))
  );
}
```

### isCliTool

```typescript
function isCliTool(pkg: PackageJson, files: FileTree): boolean {
  // Check for bin entry
  if (pkg.bin) return true;
  
  // Check for CLI dependencies
  const cliDeps = ['commander', 'yargs', 'meow', 'cac', 'argparse'];
  const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
  if (cliDeps.some(d => deps.includes(d))) return true;
  
  // Check for cli directory
  if (files.some(f => f.startsWith('cli/') || f.startsWith('bin/'))) {
    return true;
  }
  
  return false;
}
```

## Manual Override

Classification can be overridden via options:

```typescript
const result = await generateFromGithub(url, {
  forceType: 'api-sdk'  // Override automatic classification
});
```

Or via CLI:

```bash
github-to-mcp <url> --type api-sdk
```

## Classification Impact

| Type | Universal Tools | OpenAPI | GraphQL | Code Analysis |
|------|-----------------|---------|---------|---------------|
| mcp-server | ✅ | ❌ | ❌ | ✅ (MCP patterns) |
| api-sdk | ✅ | ✅ | ✅ | ❌ |
| cli-tool | ✅ | ❌ | ❌ | ✅ (CLI patterns) |
| library | ✅ | ❌ | ❌ | Limited |
| documentation | ✅ | ❌ | ❌ | ❌ |
| data | ✅ | ❌ | ❌ | ❌ |
| unknown | ✅ | ❌ | ❌ | ❌ |

---

## See Also

- [How It Works](how-it-works.md) - Full extraction flow
- [Tool Types](tool-types.md) - Understanding tools
- [Configuration](../getting-started/configuration.md) - Override options
