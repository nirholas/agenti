# Output Formats

The Lyra CLI outputs structured JSON that can be piped to other tools or saved to files.

## JSON Output Structure

Each discovery result is a JSON object:

```json
{
  "tool": {
    "id": "github:modelcontextprotocol/servers",
    "name": "servers",
    "description": "MCP servers maintained by Anthropic",
    "source": "github",
    "sourceUrl": "https://github.com/modelcontextprotocol/servers",
    "license": "MIT",
    "author": "modelcontextprotocol",
    "homepage": "https://modelcontextprotocol.io",
    "repository": "https://github.com/modelcontextprotocol/servers",
    "hasMCPSupport": true,
    "hasNpmPackage": true
  },
  "decision": {
    "template": "mcp-stdio",
    "reasoning": "npm package with bin entry, uses @modelcontextprotocol/sdk",
    "config": {
      "identifier": "mcp-servers",
      "customParams": {
        "mcp": {
          "type": "stdio",
          "command": "npx",
          "args": ["-y", "@modelcontextprotocol/server-everything"]
        },
        "description": "Official MCP servers collection",
        "avatar": "🔧"
      }
    }
  },
  "generated": {
    "pluginConfig": {
      "identifier": "mcp-servers",
      "customParams": {
        "mcp": {
          "type": "stdio",
          "command": "npx",
          "args": ["-y", "@modelcontextprotocol/server-everything"]
        }
      }
    }
  }
}
```

## Capturing Output

### Save to File

```bash
lyra-discover discover --sources github --limit 10 > results.json
```

### Append to File

```bash
lyra-discover discover --sources npm --limit 5 >> results.json
```

### Redirect Errors

```bash
lyra-discover discover --limit 10 > results.json 2> errors.log
```

## Working with jq

[jq](https://stedolan.github.io/jq/) is essential for processing JSON output.

### Install jq

```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt install jq

# Windows (chocolatey)
choco install jq
```

### Common Queries

#### List tool names

```bash
lyra-discover discover --limit 10 2>/dev/null | jq -r '.[].tool.name'
```

Output:
```
mcp-server-github
mcp-server-filesystem
mcp-server-sqlite
```

#### Filter by template

```bash
lyra-discover discover --limit 20 2>/dev/null \
  | jq '[.[] | select(.decision.template == "mcp-stdio")]'
```

#### Extract Quick Import configs

```bash
lyra-discover discover --limit 10 2>/dev/null \
  | jq '.[].generated.pluginConfig'
```

#### Count by template

```bash
lyra-discover discover --limit 50 2>/dev/null \
  | jq 'group_by(.decision.template) | map({template: .[0].decision.template, count: length})'
```

Output:
```json
[
  {"template": "mcp-stdio", "count": 35},
  {"template": "mcp-http", "count": 10},
  {"template": "openapi", "count": 5}
]
```

#### Get specific fields

```bash
lyra-discover discover --limit 10 2>/dev/null \
  | jq '[.[] | {name: .tool.name, template: .decision.template, url: .tool.sourceUrl}]'
```

Output:
```json
[
  {
    "name": "mcp-server-github",
    "template": "mcp-stdio",
    "url": "https://github.com/modelcontextprotocol/servers"
  }
]
```

### Advanced jq Examples

#### Generate MCP config for all STDIO tools

```bash
lyra-discover discover --limit 20 2>/dev/null \
  | jq '{
      mcpServers: [
        .[] 
        | select(.decision.template == "mcp-stdio") 
        | {
            (.tool.name): .generated.pluginConfig.customParams.mcp
          }
      ] | add
    }'
```

Output:
```json
{
  "mcpServers": {
    "mcp-server-github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"]
    },
    "mcp-server-filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem"]
    }
  }
}
```

#### Create CSV output

```bash
lyra-discover discover --limit 10 2>/dev/null \
  | jq -r '["Name","Template","Source","URL"], (.[] | [.tool.name, .decision.template, .tool.source, .tool.sourceUrl]) | @csv'
```

Output:
```csv
"Name","Template","Source","URL"
"mcp-server-github","mcp-stdio","github","https://github.com/..."
```

## Piping to Other Tools

### To github-to-mcp

```bash
lyra-discover discover --limit 5 2>/dev/null \
  | jq '.[] | select(.decision.template | startswith("mcp-"))' \
  | github-to-mcp register
```

### To a web API

```bash
lyra-discover discover --limit 5 2>/dev/null \
  | jq -c '.[]' \
  | while read tool; do
      curl -X POST https://api.plugin.delivery/register \
        -H "Content-Type: application/json" \
        -d "$tool"
    done
```

### To clipboard (macOS)

```bash
lyra-discover analyze-repo owner repo 2>/dev/null \
  | jq '.generated.pluginConfig' \
  | pbcopy
```

### To clipboard (Linux)

```bash
lyra-discover analyze-repo owner repo 2>/dev/null \
  | jq '.generated.pluginConfig' \
  | xclip -selection clipboard
```

## Separating Output from Logs

The CLI writes:
- **stdout**: JSON results
- **stderr**: Progress messages and logs

### Get only JSON

```bash
lyra-discover discover --limit 5 2>/dev/null
```

### Get only logs

```bash
lyra-discover discover --limit 5 >/dev/null
```

### Save both separately

```bash
lyra-discover discover --limit 5 > results.json 2> logs.txt
```

## Formatting Options

### Pretty Print (default)

JSON is pretty-printed by default when output to terminal.

### Compact JSON

Use jq for compact output:

```bash
lyra-discover discover --limit 5 2>/dev/null | jq -c '.'
```

### Sorted Keys

```bash
lyra-discover discover --limit 5 2>/dev/null | jq -S '.'
```

## Integration Examples

### Shell Script

```bash
#!/bin/bash

# Discover and process tools
results=$(lyra-discover discover --limit 10 2>/dev/null)

# Count results
count=$(echo "$results" | jq length)
echo "Found $count tools"

# Process each tool
echo "$results" | jq -c '.[]' | while read tool; do
  name=$(echo "$tool" | jq -r '.tool.name')
  template=$(echo "$tool" | jq -r '.decision.template')
  echo "Processing: $name ($template)"
done
```

### Node.js Script

```javascript
import { execSync } from 'child_process';

const output = execSync('lyra-discover discover --limit 5', {
  encoding: 'utf-8',
  stdio: ['pipe', 'pipe', 'ignore'] // Ignore stderr
});

const results = JSON.parse(output);

for (const result of results) {
  console.log(`${result.tool.name}: ${result.decision.template}`);
}
```

### Python Script

```python
import subprocess
import json

result = subprocess.run(
    ['lyra-discover', 'discover', '--limit', '5'],
    capture_output=True,
    text=True
)

tools = json.loads(result.stdout)

for tool in tools:
    print(f"{tool['tool']['name']}: {tool['decision']['template']}")
```

## Next Steps

- [Examples](/examples/) - Real-world usage examples
- [API Reference](/api/) - Programmatic usage
- [Pipeline Integration](/guide/pipeline) - Build pipelines
