# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

#### Web Application Enhancements
- **Interactive Playground**: Test MCP tools in real-time with dynamic form generation
  - Resizable split-panel interface with drag-to-resize functionality
  - Tool search and filtering with category chips
  - Dynamic parameter forms based on JSON schemas
  - Mock execution with formatted JSON responses
  - Demo mode with sample tools for first-time users
- **Generation Progress Indicator**: Multi-step visual progress tracking
  - Circular progress ring with percentage display
  - 4 weighted steps (Fetching, Classifying, Extracting, Generating)
  - Real-time tools found counter
  - Error state handling per step
- **Branch/Tag/Commit Selection**: Choose specific Git references for conversion
  - GitHub API integration for fetching branches and tags
  - Commit SHA support
  - Default branch detection
  - Search/filter within refs
- **Claude Config Export**: One-click configuration setup
  - NPX method (zero-install)
  - Local method (clone and build)
  - Python method (Python-based server)
  - Copy to clipboard with visual feedback
  - Download as JSON file
- **Advanced Tool Filtering**: Enhanced tool discovery and exploration
  - Real-time search across names and descriptions
  - Category filters (OpenAPI, GraphQL, README)
  - Sort options (Alphabetical, Source Type, Confidence)
  - Results counter
- **Enhanced Tool Display**: Improved tool list UI
  - Collapsible tool cards with schema display
  - Source type badges with color coding
  - Expand/collapse all functionality
  - Grouped view when sorting by source
- **SplitView Component**: Reusable resizable panel layout
  - Mouse drag interaction for resizing
  - Maximize/minimize buttons for each panel
  - Configurable minimum widths
  - Smooth transitions and hover effects

#### Developer Experience
- Comprehensive component documentation
- TypeScript interfaces for all props
- Custom hooks for state management
- Memoization for performance optimization

### Added (Continued)
- Additional extraction patterns for Rust MCP servers
- Support for extracting tools from TypeDoc comments

### Changed
- Improved error messages for rate limiting
- Refactored ConversionResult to use new ToolList and ClaudeConfigExport components
- Enhanced GithubUrlInput with optional branch selector integration

### Fixed
- Edge case in Python decorator parsing with multiline strings
- TypeScript type safety in LoadingSteps component

---

## [1.0.0] - 2026-01-11

### Added

#### Core Features
- **Universal Conversion Engine**: Convert any GitHub repository into an MCP server
- **Smart Detection**: Automatic extraction from OpenAPI specs, README patterns, and code
- **Repository Classification**: Auto-identify repo type (api-sdk, mcp-server, cli-tool, library, documentation)
- **Universal Tools**: Every repo gets 4 base tools (get_readme, list_files, read_file, search_code)

#### Extraction Sources
- OpenAPI/Swagger specification parsing
- README.md tool list extraction
- Python `@mcp.tool` decorator detection
- TypeScript/JavaScript `server.tool()` pattern detection
- Package.json metadata extraction

#### Web Application
- Modern Next.js 14 web interface
- Dark/Light theme support with persistence
- Conversion history with localStorage
- Real-time tool preview
- One-click config generation for Claude, Cursor, ChatGPT
- Download MCP server code

#### CLI
- `npx @nirholas/github-to-mcp <url>` command
- JSON output support
- Configurable output directory
- Verbose logging option

#### Developer Experience
- Full TypeScript support with strict mode
- Comprehensive type definitions
- Programmatic API for integration
- Monorepo structure with pnpm workspaces

### Technical Details

#### Packages
- `@nirholas/github-to-mcp` - Core conversion engine
- `@github-to-mcp/openapi-parser` - OpenAPI specification parser
- `@github-to-mcp/web` - Next.js web application

#### Dependencies
- Next.js 14.2
- React 18.3
- TypeScript 5.5
- Tailwind CSS 3.4
- Radix UI primitives

#### Browser Support
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Security
- Input validation for all GitHub URLs
- Rate limiting on API endpoints
- Security headers (CSP, HSTS, X-Frame-Options)
- No persistent data storage

### Known Issues
- Large repositories (>1000 files) may timeout on free tier
- Private repositories require GitHub token
- Some edge cases in Python multiline string parsing

---

## Version History Summary

| Version | Date | Highlights |
|---------|------|------------|
| 1.0.0 | 2026-01-11 | Initial release |

---

## Migration Guides

### Upgrading to 1.x

This is the initial release. No migration needed.

---

## Release Schedule

- **Patch releases** (1.0.x): As needed for bug fixes
- **Minor releases** (1.x.0): Monthly with new features
- **Major releases** (x.0.0): When breaking changes are necessary

---

[Unreleased]: https://github.com/nirholas/github-to-mcp/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/nirholas/github-to-mcp/releases/tag/v1.0.0
