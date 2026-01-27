# Quick Start

Generate your first MCP server in under 60 seconds!

## Step 1: Choose a Repository

Pick any GitHub repository you want to convert. For this example, we'll use the Stripe Node.js SDK:

```
https://github.com/stripe/stripe-node
```

## Step 2: Generate the MCP Server

### Using the Web UI

1. Go to [github-to-mcp.vercel.app](https://github-to-mcp.vercel.app)
2. Paste the repository URL
3. Click **Generate**
4. Download the generated server

### Using the CLI

```bash
npx @nirholas/github-to-mcp https://github.com/stripe/stripe-node -o ./stripe-mcp
```

This will create a complete MCP server in the `./stripe-mcp` directory.

### Using the API

```typescript
import { generateFromGithub } from '@nirholas/github-to-mcp';

const result = await generateFromGithub('https://github.com/stripe/stripe-node');

console.log(`Generated ${result.tools.length} tools`);
console.log('Tools:', result.tools.map(t => t.name));

// Save to disk
await result.save('./stripe-mcp');
```

## Step 3: Explore the Output

The generated MCP server includes:

```
stripe-mcp/
├── package.json          # Dependencies and scripts
├── server.mjs            # Main MCP server code
├── tools/                # Generated tool implementations
│   ├── read_file.mjs
│   ├── list_files.mjs
│   ├── search_code.mjs
│   └── get_readme.mjs
└── README.md             # Usage instructions
```

## Step 4: Test the Server

Start the MCP server locally:

```bash
cd stripe-mcp
npm install
npm start
```

The server is now running and ready to accept MCP connections!

## Step 5: Connect to an AI Assistant

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "stripe": {
      "command": "node",
      "args": ["/path/to/stripe-mcp/server.mjs"]
    }
  }
}
```

Restart Claude Desktop, and you'll see the tools available:

![Claude with MCP tools](https://github-to-mcp.vercel.app/docs/claude-tools.png)

### Cursor

Add to your Cursor MCP configuration:

```json
{
  "mcp": {
    "servers": {
      "stripe": {
        "command": "node",
        "args": ["/path/to/stripe-mcp/server.mjs"]
      }
    }
  }
}
```

---

## What Tools Were Generated?

For the Stripe SDK, you'll get these tools:

### Universal Tools (Always Included)

| Tool | Description |
|------|-------------|
| `get_readme` | Fetch the README content |
| `list_files` | Browse directory structure |
| `read_file` | Read any file's contents |
| `search_code` | Search for code patterns |

### Extracted Tools (From OpenAPI Spec)

Since Stripe has an OpenAPI specification, additional tools are extracted:

| Tool | Description |
|------|-------------|
| `create_customer` | Create a new customer |
| `list_charges` | List all charges |
| `create_payment_intent` | Create a payment intent |
| ... | And many more! |

---

## Example Conversations

Once connected, you can have conversations like:

> **You:** What's in the Stripe SDK readme?
>
> **Claude:** *Uses `get_readme` tool* The Stripe Node.js SDK provides access to the Stripe API...

> **You:** Show me how to create a customer
>
> **Claude:** *Uses `search_code` and `read_file` tools* Here's the code for creating a customer...

> **You:** List all the API files
>
> **Claude:** *Uses `list_files` tool* Here are the files in the `lib/resources/` directory...

---

## Next Steps

- [Configure your server](configuration.md) — Customize output options
- [Connect to Claude Desktop](../guides/claude-desktop.md) — Detailed integration guide
- [Use with private repos](../guides/private-repos.md) — Work with your own code
