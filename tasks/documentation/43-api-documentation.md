# Task: Generate Comprehensive API Documentation

## Priority: HIGH

## Context
With 380+ tools, discoverability and documentation are critical for enterprise adoption. AI agents and developers need searchable, up-to-date documentation.

## Requirements
1. Auto-generate API documentation from Zod schemas:
   - Tool name, description, version
   - Input parameters with types, descriptions, defaults, constraints
   - Response schema with examples
   - Error codes and their meanings
2. Generate OpenAPI 3.1 spec for the HTTP transport
3. Generate MCP tool catalog in machine-readable format (JSON)
4. Create interactive documentation site (Mintlify, Docusaurus, or similar):
   - Searchable tool index
   - Category navigation (DeFi, tokens, swaps, etc.)
   - Code examples per tool (TypeScript, Python, curl)
   - Try-it-out playground for read-only tools
5. Add `GET /docs` endpoint serving documentation
6. Auto-rebuild docs on every release
7. Include rate limits, authentication, and error handling guides
8. Add migration guides for breaking changes

## Acceptance Criteria
- [ ] OpenAPI spec generated from Zod schemas
- [ ] Documentation site deployed
- [ ] All 380+ tools documented
- [ ] Code examples for top 50 tools
- [ ] Auto-rebuild in CI/CD
