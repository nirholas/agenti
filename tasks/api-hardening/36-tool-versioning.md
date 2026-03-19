# Task: Implement Tool Versioning Strategy

## Priority: MEDIUM

## Context
With 380+ tools, breaking changes to input/output schemas can disrupt all connected AI agents. Enterprise users need versioned APIs with deprecation periods.

## Requirements
1. Add version field to tool registration:
   ```typescript
   {
     name: 'transfer_eth',
     version: '2.0',
     deprecated: false,
     deprecationDate: null,
     migrationGuide: null
   }
   ```
2. Support running multiple versions simultaneously
3. Version selection via MCP parameter or header
4. Default to latest version if not specified
5. Deprecation lifecycle:
   - Announce: add `deprecated: true` flag and `deprecationDate`
   - Warn: return deprecation warning in response metadata for 90 days
   - Remove: return error with migration guide after deprecation date
6. Generate changelog from version diffs
7. Add `list_tool_versions` meta-tool
8. Semantic versioning: major (breaking), minor (additive), patch (fix)

## Acceptance Criteria
- [ ] Tool version field supported
- [ ] Multiple versions can coexist
- [ ] Deprecation warnings in responses
- [ ] 90-day deprecation lifecycle enforced
- [ ] Changelog generation working
