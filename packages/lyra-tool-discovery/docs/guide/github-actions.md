# GitHub Actions

Automate tool discovery with GitHub Actions to continuously find and register new MCP tools.

## Basic Workflow

Create `.github/workflows/discovery.yml`:

```yaml
name: Tool Discovery

on:
  schedule:
    - cron: '0 0 * * *'  # Run daily at midnight UTC
  workflow_dispatch:     # Allow manual trigger
    inputs:
      limit:
        description: 'Number of tools to discover'
        required: false
        default: '20'

jobs:
  discover:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      
      - name: Setup pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 9
      
      - name: Install Lyra
        run: pnpm add -g @nirholas/lyra-tool-discovery
      
      - name: Run Discovery
        id: discover
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          lyra-discover discover \
            --sources github,npm \
            --limit ${{ github.event.inputs.limit || '20' }} \
            > discovery-results.json
          
          # Count results
          COUNT=$(jq length discovery-results.json)
          echo "count=$COUNT" >> $GITHUB_OUTPUT
      
      - name: Upload Results
        uses: actions/upload-artifact@v4
        with:
          name: discovery-results-${{ github.run_number }}
          path: discovery-results.json
          retention-days: 30
      
      - name: Summary
        run: |
          echo "## Discovery Results" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "Discovered **${{ steps.discover.outputs.count }}** tools" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "### Tools Found" >> $GITHUB_STEP_SUMMARY
          jq -r '.[] | "- **\(.tool.name)** → `\(.decision.template)`"' discovery-results.json >> $GITHUB_STEP_SUMMARY
```

## Advanced Workflow with Auto-PR

```yaml
name: Discovery and Registry Update

on:
  schedule:
    - cron: '0 0 * * 1'  # Weekly on Monday
  workflow_dispatch:

permissions:
  contents: write
  pull-requests: write

jobs:
  discover:
    runs-on: ubuntu-latest
    outputs:
      has_new_tools: ${{ steps.check.outputs.has_new }}
      
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install Dependencies
        run: npm install -g @nirholas/lyra-tool-discovery
      
      - name: Load Existing Registry
        id: existing
        run: |
          if [ -f registry/tools.json ]; then
            echo "existing=$(cat registry/tools.json | jq -c '[.[].id]')" >> $GITHUB_OUTPUT
          else
            echo "existing=[]" >> $GITHUB_OUTPUT
          fi
      
      - name: Run Discovery
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          lyra-discover discover \
            --sources github,npm \
            --limit 50 \
            > all-discovered.json
      
      - name: Filter New Tools
        id: check
        run: |
          # Filter out already-known tools
          EXISTING='${{ steps.existing.outputs.existing }}'
          jq --argjson existing "$EXISTING" \
            '[.[] | select(.tool.id as $id | $existing | index($id) | not)]' \
            all-discovered.json > new-tools.json
          
          NEW_COUNT=$(jq length new-tools.json)
          echo "count=$NEW_COUNT" >> $GITHUB_OUTPUT
          
          if [ "$NEW_COUNT" -gt "0" ]; then
            echo "has_new=true" >> $GITHUB_OUTPUT
          else
            echo "has_new=false" >> $GITHUB_OUTPUT
          fi
      
      - name: Upload New Tools
        if: steps.check.outputs.has_new == 'true'
        uses: actions/upload-artifact@v4
        with:
          name: new-tools
          path: new-tools.json

  create-pr:
    needs: discover
    if: needs.discover.outputs.has_new_tools == 'true'
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Download New Tools
        uses: actions/download-artifact@v4
        with:
          name: new-tools
      
      - name: Update Registry
        run: |
          mkdir -p registry
          
          # Load or create registry
          if [ -f registry/tools.json ]; then
            EXISTING=$(cat registry/tools.json)
          else
            EXISTING="[]"
          fi
          
          # Merge new tools
          echo "$EXISTING" | jq --slurpfile new new-tools.json \
            '. + $new[0]' > registry/tools.json
          
          # Generate configs for each new tool
          mkdir -p registry/configs
          jq -c '.[]' new-tools.json | while read tool; do
            ID=$(echo "$tool" | jq -r '.tool.id' | tr '/:' '-')
            echo "$tool" | jq '.generated.pluginConfig' > "registry/configs/${ID}.json"
          done
      
      - name: Create Pull Request
        uses: peter-evans/create-pull-request@v6
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          commit-message: 'feat: add newly discovered tools'
          title: '🔍 New tools discovered'
          body: |
            ## Automated Tool Discovery
            
            This PR adds newly discovered MCP tools to the registry.
            
            ### New Tools
            $(jq -r '.[] | "- **\(.tool.name)**: \(.tool.description)"' new-tools.json)
            
            ### Review Checklist
            - [ ] Verify tool legitimacy
            - [ ] Check generated configs
            - [ ] Test tool functionality
          branch: discovery/new-tools-${{ github.run_number }}
          delete-branch: true
          labels: |
            discovery
            automated
```

## Secrets Configuration

Required secrets in your repository:

| Secret | Description | Required |
|--------|-------------|----------|
| `ANTHROPIC_API_KEY` | Anthropic API key | Yes (if using Anthropic) |
| `OPENAI_API_KEY` | OpenAI API key | Yes (if using OpenAI) |
| `GITHUB_TOKEN` | Auto-provided | No (built-in) |

Set secrets at: `Settings → Secrets and variables → Actions → New repository secret`

## Caching Strategies

### Cache pnpm Dependencies

```yaml
- name: Setup pnpm
  uses: pnpm/action-setup@v3
  with:
    version: 9

- name: Get pnpm store
  id: pnpm-cache
  run: echo "store=$(pnpm store path)" >> $GITHUB_OUTPUT

- name: Cache pnpm
  uses: actions/cache@v4
  with:
    path: ${{ steps.pnpm-cache.outputs.store }}
    key: pnpm-${{ hashFiles('**/pnpm-lock.yaml') }}
    restore-keys: pnpm-
```

### Cache Discovery Results

```yaml
- name: Cache Previous Results
  uses: actions/cache@v4
  with:
    path: .cache/discovery
    key: discovery-${{ github.run_number }}
    restore-keys: |
      discovery-

- name: Run Discovery with Cache
  run: |
    mkdir -p .cache/discovery
    
    # Load cached known tools
    if [ -f .cache/discovery/known-ids.txt ]; then
      KNOWN=$(cat .cache/discovery/known-ids.txt)
    else
      KNOWN=""
    fi
    
    # Run discovery
    lyra-discover discover --limit 30 > results.json
    
    # Update cache
    jq -r '.[].tool.id' results.json >> .cache/discovery/known-ids.txt
    sort -u .cache/discovery/known-ids.txt -o .cache/discovery/known-ids.txt
```

## Workflow Triggers

### On Schedule

```yaml
on:
  schedule:
    - cron: '0 0 * * *'     # Daily
    - cron: '0 0 * * 0'     # Weekly (Sunday)
    - cron: '0 0 1 * *'     # Monthly
```

### On Push to Main

```yaml
on:
  push:
    branches: [main]
    paths:
      - 'discovery.config.json'
      - '.github/workflows/discovery.yml'
```

### On Issue Creation

```yaml
on:
  issues:
    types: [opened]

jobs:
  discover:
    if: contains(github.event.issue.labels.*.name, 'discovery-request')
    runs-on: ubuntu-latest
    steps:
      - name: Parse Issue
        id: parse
        run: |
          # Extract tool name from issue body
          TOOL=$(echo "${{ github.event.issue.body }}" | grep -oP 'Tool: \K.*')
          echo "tool=$TOOL" >> $GITHUB_OUTPUT
      
      - name: Analyze Tool
        run: |
          lyra-discover analyze-npm ${{ steps.parse.outputs.tool }}
```

## Matrix Strategy for Multiple Sources

```yaml
jobs:
  discover:
    strategy:
      matrix:
        source: [github, npm]
        limit: [25]
    
    runs-on: ubuntu-latest
    
    steps:
      - name: Discover from ${{ matrix.source }}
        run: |
          lyra-discover discover \
            --sources ${{ matrix.source }} \
            --limit ${{ matrix.limit }} \
            > results-${{ matrix.source }}.json
      
      - name: Upload
        uses: actions/upload-artifact@v4
        with:
          name: results-${{ matrix.source }}
          path: results-${{ matrix.source }}.json

  merge:
    needs: discover
    runs-on: ubuntu-latest
    
    steps:
      - name: Download All Results
        uses: actions/download-artifact@v4
      
      - name: Merge Results
        run: |
          jq -s 'add' results-*/results-*.json > combined.json
```

## Error Handling

```yaml
- name: Run Discovery
  id: discover
  continue-on-error: true
  run: |
    lyra-discover discover --limit 10 > results.json 2> errors.log
    
- name: Handle Errors
  if: steps.discover.outcome == 'failure'
  run: |
    echo "## Discovery Failed" >> $GITHUB_STEP_SUMMARY
    echo '```' >> $GITHUB_STEP_SUMMARY
    cat errors.log >> $GITHUB_STEP_SUMMARY
    echo '```' >> $GITHUB_STEP_SUMMARY
    
    # Still upload partial results if any
    if [ -f results.json ]; then
      echo "Partial results saved"
    fi
```

## Next Steps

- [Examples](/examples/) - More example workflows
- [Batch Processing](/examples/batch-processing) - Process many tools
- [Pipeline Integration](/guide/pipeline) - Full pipeline setup
