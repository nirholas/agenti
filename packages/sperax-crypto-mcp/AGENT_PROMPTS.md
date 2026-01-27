

## 📋 Prompt 5: API Documentation & Integration Guides

**Purpose:** Create comprehensive API documentation and integration guides for various platforms.

```
You are an API documentation specialist who has written docs for major developer platforms. Create comprehensive API documentation and integration guides for the Sperax MCP Server.

## Context

The Sperax MCP Server exposes:
- 85 MCP Tools (callable functions)
- 11 MCP Resources (static documentation)
- 19 MCP Prompts (conversation templates)
- HTTP/SSE server mode for web integrations

## Your Task

### 1. /docs/api/README.md
API overview and quick reference.

### 2. /docs/api/tools/
Create individual documentation for each tool category:

**usds-tools.md**
```markdown
# USDs Stablecoin Tools

## usds_get_info

Get comprehensive USDs token information.

### Parameters
None

### Response Schema
```typescript
{
  token: {
    name: string;        // "Sperax USD"
    symbol: string;      // "USDs"
    address: string;     // Contract address
    decimals: number;    // 18
  };
  supply: {
    total: string;       // Total supply formatted
    totalUSD: string;    // "$123,456,789"
    rebasing: string;    // Rebasing supply
    nonRebasing: string; // Non-rebasing supply
  };
  yield: {
    currentAPR: string;  // "5.23%"
    mechanism: string;   // Description
    distribution: string; // "70% to holders..."
  };
  lastRebase: {
    timestamp: number;
    date: string;        // ISO date
  };
}
```

### Example Usage
```typescript
// Using MCP client
const result = await client.callTool('usds_get_info', {});

// Expected response
{
  "token": {
    "name": "Sperax USD",
    "symbol": "USDs",
    ...
  }
}
```

### Related Tools
- usds_get_balance
- usds_get_yield_info
- vault_get_status
```

Create similar documentation for:
- vault-tools.md (10 tools)
- spa-tools.md (8 tools)
- demeter-tools.md (7 tools)
- dripper-tools.md (5 tools)
- oracle-tools.md (5 tools)
- analytics-tools.md (6 tools)
- governance-tools.md (5 tools)
- yield-reserve-tools.md (4 tools)
- portfolio-tools.md (2 tools)
- subgraph-tools.md (5 tools)
- supply-tools.md (3 tools)
- swap-tools.md (3 tools)
- agents-tools.md (5 tools)
- plugins-tools.md (6 tools)
- news-tools.md (7 tools)

### 3. /docs/api/resources.md
Document all 11 resources:
- URI format
- Content description
- When to use
- Example retrieval

### 4. /docs/api/prompts.md
Document all 19 prompts:
- Prompt name
- Arguments (required/optional)
- Template structure
- Example conversations

### 5. /docs/integrations/

**claude-desktop.md**
Complete Claude Desktop integration:
- Configuration file locations
- JSON configuration
- Custom RPC setup
- Troubleshooting
- Advanced options

**cursor-vscode.md**
Cursor and VS Code integration:
- Extension configuration
- Workspace settings
- Debugging

**http-server.md**
HTTP server mode documentation:
- Starting the server
- Available endpoints
- SSE subscriptions
- CORS configuration
- Load balancing

**langchain.md**
LangChain integration:
- Python setup
- Tool wrapping
- Agent configuration
- Memory management
- Complete examples

**autogen.md**
Microsoft AutoGen integration:
- Configuration
- Agent setup
- Multi-agent patterns

**custom-clients.md**
Building custom MCP clients:
- Protocol overview
- Connection handling
- Tool invocation
- Resource fetching
- Error handling

### 6. /docs/guides/

**building-defi-agent.md**
Complete guide to building a DeFi agent:
1. Planning your agent
2. Selecting tools
3. Designing prompts
4. Implementation
5. Testing
6. Deployment

**monitoring-protocol.md**
Guide for protocol monitoring:
1. Key metrics to track
2. Alert thresholds
3. Dashboard building
4. Automation

**yield-optimization.md**
Yield optimization guide:
1. Understanding yield sources
2. Risk assessment
3. Comparison methodology
4. Recommendation engine

### 7. /docs/reference/

**schemas.md**
Complete Zod schemas for all tools.

**types.md**
TypeScript type definitions.

**errors.md**
Error codes and handling:
- RPC errors
- Validation errors
- Protocol errors
- Recovery strategies

**rate-limits.md**
Rate limiting documentation:
- Default limits
- Configuration
- Best practices

## Documentation Requirements

1. **Completeness**
   - Every tool fully documented
   - All parameters explained
   - All responses typed
   - Error cases covered

2. **Examples**
   - Working code for every tool
   - Real-world use cases
   - Copy-paste ready

3. **Cross-References**
   - Links between related tools
   - Links to relevant guides
   - Links to source code

4. **Versioning**
   - API version noted
   - Breaking changes documented
   - Deprecation notices

## Output Instructions

1. Create the directory structure
2. Implement each documentation file completely
3. Use consistent formatting
4. Include navigation between files
5. Generate an index/sidebar file
```

---

## 🚀 Usage Instructions

### Running the Prompts

1. **Start with Prompt 1** (llms.txt files) - Creates foundational documentation
2. **Run Prompt 2** (SKILLS.md & AGENTS.md) - Adds AI agent marketplace docs
3. **Run Prompt 3** (Code Examples) - Generates comprehensive examples
4. **Run Prompt 4** (README Enhancement) - Transforms the main README
5. **Run Prompt 5** (API Documentation) - Creates complete API docs

### Tips for Best Results

- Run each prompt in a fresh conversation for maximum context
- Provide the prompt with access to the full codebase
- Review and iterate on outputs before committing
- Combine generated content with existing documentation

### Post-Generation Tasks

1. Review all generated content for accuracy
2. Test all code examples
3. Verify contract addresses
4. Update version numbers
5. Add any project-specific customizations
6. Run spell check and grammar review

---

## 📁 Expected Output Structure

```
sperax-crypto-mcp/
├── README.md                 # Enhanced (Prompt 4)
├── llms.txt                  # Concise (Prompt 1)
├── llms-full.txt             # Comprehensive (Prompt 1)
├── SKILLS.md                 # Skills manifest (Prompt 2)
├── AGENTS.md                 # Agent integration (Prompt 2)
├── examples/
│   ├── README.md
│   ├── basic/
│   │   ├── usds-balance-checker.ts
│   │   ├── farm-finder.ts
│   │   └── protocol-health.ts
│   ├── intermediate/
│   │   ├── portfolio-analyzer.ts
│   │   ├── yield-comparator.ts
│   │   └── governance-tracker.ts
│   ├── advanced/
│   │   ├── autonomous-agent.ts
│   │   ├── multi-chain-tracker.ts
│   │   └── webhook-integration.ts
│   ├── integrations/
│   │   ├── langchain-agent.py
│   │   ├── autogpt-plugin/
│   │   └── discord-bot.ts
│   └── tutorials/
│       ├── 01-getting-started.md
│       ├── 02-building-portfolio-dashboard.md
│       ├── 03-creating-yield-optimizer.md
│       ├── 04-governance-participation-guide.md
│       └── 05-multi-agent-system.md
└── docs/
    ├── api/
    │   ├── README.md
    │   ├── tools/
    │   │   ├── usds-tools.md
    │   │   ├── vault-tools.md
    │   │   └── ... (16 files)
    │   ├── resources.md
    │   └── prompts.md
    ├── integrations/
    │   ├── claude-desktop.md
    │   ├── cursor-vscode.md
    │   ├── http-server.md
    │   ├── langchain.md
    │   ├── autogen.md
    │   └── custom-clients.md
    ├── guides/
    │   ├── building-defi-agent.md
    │   ├── monitoring-protocol.md
    │   └── yield-optimization.md
    └── reference/
        ├── schemas.md
        ├── types.md
        ├── errors.md
        └── rate-limits.md
```

---

<p align="center">
  <strong>Generated prompts designed for Claude Opus 4.5</strong>
</p>
