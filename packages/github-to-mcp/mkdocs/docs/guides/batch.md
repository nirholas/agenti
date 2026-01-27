# Batch Conversion

Convert multiple GitHub repositories to MCP servers at once.

## Web UI Batch Mode

Visit [github-to-mcp.vercel.app/batch](https://github-to-mcp.vercel.app/batch) to convert multiple repos:

1. Enter one URL per line
2. Configure shared options
3. Click "Generate All"
4. Download as a single ZIP

## CLI Batch Processing

### Using a File List

Create a file with URLs (one per line):

```text title="repos.txt"
https://github.com/stripe/stripe-node
https://github.com/openai/openai-node
https://github.com/vercel/next.js
https://github.com/prisma/prisma
```

Then process:

```bash
while read url; do
  npx @nirholas/github-to-mcp "$url" -o "./mcp-servers/$(basename $url)"
done < repos.txt
```

### Parallel Processing

For faster conversion, use parallel processing:

```bash
# Using GNU parallel
cat repos.txt | parallel -j4 \
  'npx @nirholas/github-to-mcp {} -o ./mcp-servers/$(basename {})'
```

### With xargs

```bash
cat repos.txt | xargs -I {} -P 4 \
  npx @nirholas/github-to-mcp {} -o ./mcp-servers/$(basename {})
```

## Programmatic Batch

### Basic Batch

```typescript
import { generateFromGithub } from '@nirholas/github-to-mcp';

const repos = [
  'https://github.com/stripe/stripe-node',
  'https://github.com/openai/openai-node',
  'https://github.com/vercel/next.js',
];

async function batchGenerate() {
  for (const repo of repos) {
    const name = repo.split('/').pop();
    console.log(`Generating: ${name}`);
    
    const result = await generateFromGithub(repo);
    await result.save(`./mcp-servers/${name}`);
    
    console.log(`✓ Generated ${result.tools.length} tools for ${name}`);
  }
}

batchGenerate();
```

### Parallel Batch

```typescript
import { generateFromGithub } from '@nirholas/github-to-mcp';

const repos = [
  'https://github.com/stripe/stripe-node',
  'https://github.com/openai/openai-node',
  'https://github.com/vercel/next.js',
];

async function parallelBatch() {
  const results = await Promise.all(
    repos.map(async (repo) => {
      const name = repo.split('/').pop();
      try {
        const result = await generateFromGithub(repo);
        await result.save(`./mcp-servers/${name}`);
        return { repo, success: true, tools: result.tools.length };
      } catch (error) {
        return { repo, success: false, error: error.message };
      }
    })
  );
  
  console.log('Results:', results);
}

parallelBatch();
```

### With Concurrency Control

```typescript
import { generateFromGithub } from '@nirholas/github-to-mcp';
import pLimit from 'p-limit';

const repos = [/* ... */];
const limit = pLimit(3); // Max 3 concurrent

async function controlledBatch() {
  const tasks = repos.map(repo =>
    limit(async () => {
      const name = repo.split('/').pop();
      const result = await generateFromGithub(repo);
      await result.save(`./mcp-servers/${name}`);
      return { name, tools: result.tools.length };
    })
  );
  
  const results = await Promise.all(tasks);
  console.log('Completed:', results);
}

controlledBatch();
```

## Batch Configuration

### Shared Options

Apply the same options to all repos:

```typescript
const sharedOptions = {
  language: 'typescript',
  includeUniversalTools: true,
  extractFromOpenAPI: true,
  token: process.env.GITHUB_TOKEN,
};

for (const repo of repos) {
  await generateFromGithub(repo, sharedOptions);
}
```

### Per-Repo Options

Customize options per repository:

```typescript
const repoConfigs = [
  {
    url: 'https://github.com/stripe/stripe-node',
    options: { extractFromOpenAPI: true }
  },
  {
    url: 'https://github.com/facebook/react',
    options: { maxDepth: 2 }  // Large repo, limit depth
  },
  {
    url: 'https://github.com/my-org/private-repo',
    options: { token: process.env.PRIVATE_TOKEN }
  },
];

for (const { url, options } of repoConfigs) {
  await generateFromGithub(url, options);
}
```

## Output Organization

### By Category

```bash
mcp-servers/
├── apis/
│   ├── stripe/
│   └── openai/
├── frameworks/
│   ├── nextjs/
│   └── react/
└── tools/
    ├── prisma/
    └── typescript/
```

### By Organization

```bash
mcp-servers/
├── stripe/
│   └── stripe-node/
├── openai/
│   └── openai-node/
└── vercel/
    └── next.js/
```

### Script for Organization

```typescript
import { generateFromGithub } from '@nirholas/github-to-mcp';
import { mkdir } from 'fs/promises';
import { join } from 'path';

async function organizedBatch(repos: string[], baseDir: string) {
  for (const repo of repos) {
    const [, owner, name] = repo.match(/github\.com\/([^/]+)\/([^/]+)/) || [];
    
    const outputDir = join(baseDir, owner, name);
    await mkdir(outputDir, { recursive: true });
    
    const result = await generateFromGithub(repo);
    await result.save(outputDir);
    
    console.log(`✓ ${owner}/${name} → ${outputDir}`);
  }
}
```

## Error Handling

### Retry Failed Repos

```typescript
async function batchWithRetry(repos: string[], maxRetries = 3) {
  const results = { success: [], failed: [] };
  
  for (const repo of repos) {
    let attempt = 0;
    let success = false;
    
    while (attempt < maxRetries && !success) {
      try {
        const result = await generateFromGithub(repo);
        await result.save(`./mcp-servers/${repo.split('/').pop()}`);
        results.success.push(repo);
        success = true;
      } catch (error) {
        attempt++;
        console.log(`Retry ${attempt}/${maxRetries} for ${repo}`);
        
        if (attempt === maxRetries) {
          results.failed.push({ repo, error: error.message });
        } else {
          await new Promise(r => setTimeout(r, 1000 * attempt)); // Backoff
        }
      }
    }
  }
  
  return results;
}
```

### Generate Report

```typescript
async function batchWithReport(repos: string[]) {
  const report = {
    timestamp: new Date().toISOString(),
    total: repos.length,
    results: []
  };
  
  for (const repo of repos) {
    const start = Date.now();
    try {
      const result = await generateFromGithub(repo);
      await result.save(`./mcp-servers/${repo.split('/').pop()}`);
      
      report.results.push({
        repo,
        status: 'success',
        tools: result.tools.length,
        duration: Date.now() - start
      });
    } catch (error) {
      report.results.push({
        repo,
        status: 'failed',
        error: error.message,
        duration: Date.now() - start
      });
    }
  }
  
  // Save report
  await writeFile(
    './batch-report.json',
    JSON.stringify(report, null, 2)
  );
  
  return report;
}
```

## Automation

### GitHub Action

```yaml title=".github/workflows/generate-mcp.yml"
name: Generate MCP Servers

on:
  schedule:
    - cron: '0 0 * * 0'  # Weekly on Sunday
  workflow_dispatch:

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Generate MCP Servers
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          npm install -g @nirholas/github-to-mcp
          
          while read url; do
            github-to-mcp "$url" -o "./mcp-servers/$(basename $url)"
          done < repos.txt
      
      - name: Upload Artifacts
        uses: actions/upload-artifact@v4
        with:
          name: mcp-servers
          path: mcp-servers/
```

### Cron Job

```bash title="update-mcp-servers.sh"
#!/bin/bash
set -e

cd ~/mcp-servers

# Update each server
for repo in stripe/stripe-node openai/openai-node; do
  name=$(basename $repo)
  npx @nirholas/github-to-mcp "https://github.com/$repo" -o "./$name" --force
  echo "Updated $name"
done

# Restart Claude Desktop to pick up changes
osascript -e 'quit app "Claude"'
sleep 2
open -a "Claude"
```

---

## Next Steps

- [Configuration](../getting-started/configuration.md) - All generation options
- [CLI Reference](../cli/index.md) - Command-line details
- [API Reference](../api/index.md) - Programmatic API
