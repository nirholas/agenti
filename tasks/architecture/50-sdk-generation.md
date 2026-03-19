# Task: Generate Client SDKs from Tool Definitions

## Priority: MEDIUM

## Context
Enterprise customers need type-safe client SDKs to integrate with Agenti. Auto-generating SDKs from tool definitions ensures they stay in sync.

## Requirements
1. Create an SDK generator that produces typed clients from Zod schemas:
   - **TypeScript SDK**: Full type safety, async/await, error handling
   - **Python SDK**: Pydantic models, async support
2. SDK features:
   - Auto-generated from tool registry (single source of truth)
   - Typed request/response for every tool
   - Built-in retry with exponential backoff
   - Built-in rate limit handling (respect `Retry-After`)
   - Authentication helpers (API key, HMAC)
   - Connection pooling and keep-alive
3. SDK publishing:
   - TypeScript: publish to npm as `@agenti/sdk`
   - Python: publish to PyPI as `agenti-sdk`
   - Auto-publish on release
4. Include in SDK:
   - Getting started guide
   - Code examples for common workflows
   - Error handling best practices
   - Migration guide for version upgrades
5. Add SDK compatibility tests: verify SDK works against live server
6. Generate SDK changelog from tool definition diffs

## Acceptance Criteria
- [ ] TypeScript SDK generated and published to npm
- [ ] Python SDK generated and published to PyPI
- [ ] All tools have typed client methods
- [ ] Retry and rate limit handling built in
- [ ] SDK compatibility tests pass against server
