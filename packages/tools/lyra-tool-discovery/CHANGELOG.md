# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Comprehensive README documentation
- CONTRIBUTING.md guidelines
- Environment variable template (.env.example)

### Changed
- Nothing yet

### Fixed
- Nothing yet

## [0.1.0] - 2024-01-15

### Added

#### Core Features
- **Multi-provider AI support** - OpenAI (GPT-4o, GPT-4-turbo) and Anthropic (Claude Sonnet, Opus)
- **Auto-detection** of AI provider from environment variables
- **8 plugin templates** for SperaxOS integration:
  - `mcp-http` - Remote MCP servers over HTTP/SSE
  - `mcp-stdio` - Local MCP servers via stdio
  - `openapi` - REST API integrations
  - `standalone` - Full React applications
  - `markdown` - Rich text/documentation plugins
  - `default` - Configurable plugins with settings UI
  - `settings` - User preference plugins
  - `basic` - Simple function-based plugins

#### Discovery Sources
- **GitHub source** - Search repositories by topics, names, and README content
- **npm source** - Search npm registry for MCP-related packages
- Automatic detection of MCP support via `@modelcontextprotocol/sdk` dependency
- README and package.json fetching for AI analysis

#### CLI Commands
- `lyra-discover discover` - Search across configured sources
- `lyra-discover analyze-repo <owner> <repo>` - Analyze specific GitHub repository
- `lyra-discover analyze-npm <package>` - Analyze specific npm package
- `lyra-discover providers` - Show available AI providers
- `lyra-discover templates` - List all plugin templates

#### CLI Options
- `--sources, -s` - Specify discovery sources (github, npm)
- `--limit, -l` - Limit number of results
- `--dry-run, -d` - Preview without AI calls
- `--provider, -p` - Override AI provider
- `--model, -m` - Override AI model

#### Output Formats
- JSON output for CI/CD pipelines
- Quick Import format for SperaxOS
- Console output with rich formatting
- Plugin manifests for plugin.delivery

### Technical Details
- Built with TypeScript 5.7
- Uses Commander.js for CLI
- OpenAI SDK for GPT models
- Anthropic SDK for Claude models
- ESM module format

---

## Version History

| Version | Date | Description |
|---------|------|-------------|
| 0.1.0 | 2024-01-15 | Initial release |

---

## Upcoming Features

Features planned for future releases:

### v0.2.0
- [ ] Configuration file support (`discovery.config.json`)
- [ ] Output to file option (`--output`)
- [ ] Filter by minimum stars
- [ ] Filter by license type

### v0.3.0
- [ ] Smithery source integration
- [ ] OpenAPI Directory source
- [ ] Batch processing mode
- [ ] Caching for repeated analyses

### v0.4.0
- [ ] Plugin manifest generation
- [ ] Automatic PR creation for plugin.delivery
- [ ] GitHub Action for scheduled discovery
- [ ] Webhook notifications

### v1.0.0
- [ ] Stable API
- [ ] Comprehensive test suite
- [ ] Full documentation
- [ ] Production-ready error handling

---

[Unreleased]: https://github.com/nirholas/lyra-tool-discovery/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/nirholas/lyra-tool-discovery/releases/tag/v0.1.0
