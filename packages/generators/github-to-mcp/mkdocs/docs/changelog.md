# Changelog

All notable changes to GitHub to MCP.

## [1.0.0] - 2025-01-17

### 🎉 Initial Release

First stable release of GitHub to MCP!

### Features

- **Core Conversion** - Convert any GitHub repository to MCP server
- **Web Interface** - Browser-based conversion at [github-to-mcp.vercel.app](https://github-to-mcp.vercel.app)
- **CLI Tool** - Command-line interface for automation
- **Programmatic API** - JavaScript/TypeScript library

### Universal Tools

Every generated server includes:

- `get_readme` - Fetch repository README
- `list_files` - Browse directory structure
- `read_file` - Read file contents
- `search_code` - Search for code patterns

### Extraction Sources

- **OpenAPI/Swagger** - Extract REST API endpoints
- **GraphQL** - Extract queries and mutations
- **MCP Servers** - Parse existing tool definitions
- **Code Analysis** - Detect patterns in source code

### Output Formats

- TypeScript MCP servers
- Python MCP servers (experimental)

### Integrations

- Claude Desktop configuration
- Cursor IDE support
- Continue extension support

---

## [0.9.0] - 2025-01-10 (Beta)

### Added

- GraphQL schema parsing
- Python output support
- Batch conversion feature
- Playground for testing tools

### Changed

- Improved OpenAPI parsing accuracy
- Better error messages
- Faster generation times

### Fixed

- Rate limit handling
- Large repository support
- Unicode file handling

---

## [0.8.0] - 2025-01-03 (Alpha)

### Added

- Initial CLI implementation
- OpenAPI extraction
- Basic web interface

### Known Issues

- GraphQL not yet supported
- Limited error handling
- No Python output

---

## Versioning

This project follows [Semantic Versioning](https://semver.org/):

- **MAJOR** - Breaking changes to public API
- **MINOR** - New features, backward compatible
- **PATCH** - Bug fixes, backward compatible

---

## Upgrade Guide

### From 0.x to 1.0

No breaking changes! Simply update your dependency:

```bash
npm install @nirholas/github-to-mcp@latest
```

---

## Release Schedule

- **Major releases**: As needed for breaking changes
- **Minor releases**: Monthly feature releases
- **Patch releases**: As needed for bug fixes

---

## Contributing

Want to contribute to the next release? See our [Contributing Guide](contributing/index.md)!
