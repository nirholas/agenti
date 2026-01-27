# Changelog

All notable changes to llm.energy will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-01-16

### Added

#### Infrastructure
- **Caching**: LRU cache with TTL support for extraction results
  - Reduces redundant fetches for frequently accessed sites
  - Configurable TTL (default: 5 minutes)
  - Cache statistics endpoint for monitoring
  
- **Rate Limiting**: IP-based rate limiting for API protection
  - Sliding window algorithm
  - Default: 30 requests per minute
  - Proper HTTP headers (X-RateLimit-*)
  - 429 responses with Retry-After header

- **Validation Endpoint**: `/api/validate` to check if a site has llms.txt
  - Quick HEAD request validation
  - Separate cache with shorter TTL

#### Features
- **Site Directory**: Browse known llms.txt-compatible sites
  - Categorized by type (AI, Developer Tools, Documentation, Cloud)
  - Search and filter functionality
  - Site suggestion form

- **Batch Processing**: Process multiple URLs at once
  - `/api/batch` endpoint
  - Parallel processing with concurrency limits
  - Progress tracking
  - Combined ZIP download

- **Export Formats**: Support for multiple output formats
  - Markdown (default)
  - JSON with structured metadata
  - YAML export

- **llms.txt Generator**: Tool to create llms.txt files
  - Wizard-based UI
  - Section editor with drag-and-drop
  - Live preview
  - Download generated file

#### Developer Experience
- **Shared Core Package**: `@llm-energy/core` 
  - Deduplicated parser code between web app and MCP server
  - Shared types for consistency
  - Reusable generator functions

- **Testing**: Comprehensive test suite with Vitest
  - Unit tests for parser, cache, rate limiter, generators
  - 80%+ code coverage target
  - Test commands: `pnpm test`, `pnpm test:coverage`

#### UI Improvements
- **Syntax Highlighting**: Code blocks in preview
- **Mobile Responsiveness**: Improved download experience on mobile
- **Icon Cleanup**: Replaced emojis with Lucide icons throughout

### Changed
- Updated Stats component to show real metrics (removed fake numbers)
- Improved error messages with more helpful guidance
- Enhanced loading states with skeleton components

### Fixed
- Mobile layout issues in OutputSection
- Accessibility improvements (focus states, aria-labels)
- TypeScript strict mode compliance

### Technical Debt
- Consolidated duplicate code into shared package
- Added JSDoc comments to public functions
- Removed unused dependencies

## [1.0.0] - 2026-01-01

### Added
- Initial release of llm.energy
- Extract documentation from llms.txt files
- Parse into organized markdown sections
- Generate AGENT-GUIDE.md for AI assistants
- ZIP download functionality
- MCP Server for programmatic access
- Dark theme with cyber-green accents
- Particle background animations
