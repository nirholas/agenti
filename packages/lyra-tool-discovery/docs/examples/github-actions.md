# GitHub Actions Example

Complete workflow files for automated discovery with GitHub Actions.

## Basic Scheduled Discovery

```yaml
# .github/workflows/discovery.yml
name: Scheduled Discovery

on:
  schedule:
    - cron: '0 0 * * *'  # Daily at midnight
  workflow_dispatch:
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
      
      - name: Setup pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 9
      
      - name: Install Lyra
        run: pnpm add -g @nirholas/lyra-tool-discovery
      
      - name: Run Discovery
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          lyra-discover discover \
            --sources github,npm \
            --limit ${{ github.event.inputs.limit || '20' }} \
            > results.json 2> logs.txt
      
      - name: Generate Summary
        run: |
          echo "## 🔍 Discovery Results" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          
          COUNT=$(jq length results.json)
          echo "Discovered **$COUNT** tools" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          
          echo "### Tools by Template" >> $GITHUB_STEP_SUMMARY
          jq -r 'group_by(.decision.template) | .[] | "- **\(.[0].decision.template)**: \(length) tools"' results.json >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          
          echo "### Tool List" >> $GITHUB_STEP_SUMMARY
          jq -r '.[] | "- [\(.tool.name)](\(.tool.sourceUrl)) → `\(.decision.template)`"' results.json >> $GITHUB_STEP_SUMMARY
      
      - name: Upload Results
        uses: actions/upload-artifact@v4
        with:
          name: discovery-${{ github.run_number }}
          path: |
            results.json
            logs.txt
          retention-days: 30
```

## Auto-PR to Registry

```yaml
# .github/workflows/registry-update.yml
name: Update Registry

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
      new_count: ${{ steps.filter.outputs.count }}
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      
      - name: Install
        run: pnpm add -g @nirholas/lyra-tool-discovery
      
      - name: Discover
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          lyra-discover discover \
            --sources github,npm \
            --limit 50 \
            > all-tools.json 2>/dev/null
      
      - name: Filter New
        id: filter
        run: |
          # Load existing registry
          if [ -f registry/index.json ]; then
            EXISTING=$(jq -r '.[].id' registry/index.json | sort)
          else
            EXISTING=""
          fi
          
          # Filter new tools
          jq --arg existing "$EXISTING" '
            [.[] | select(.tool.id as $id | ($existing | split("\n") | index($id)) | not)]
          ' all-tools.json > new-tools.json
          
          COUNT=$(jq length new-tools.json)
          echo "count=$COUNT" >> $GITHUB_OUTPUT
          echo "Found $COUNT new tools"
      
      - name: Upload
        uses: actions/upload-artifact@v4
        with:
          name: new-tools
          path: new-tools.json

  update:
    needs: discover
    if: needs.discover.outputs.new_count > 0
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Download
        uses: actions/download-artifact@v4
        with:
          name: new-tools
      
      - name: Update Registry
        run: |
          mkdir -p registry
          
          # Update index
          if [ -f registry/index.json ]; then
            jq -s '.[0] + [.[1][] | {
              id: .tool.id,
              name: .tool.name,
              template: .decision.template,
              source: .tool.source,
              url: .tool.sourceUrl,
              addedAt: now | todate
            }]' registry/index.json new-tools.json > registry/index.tmp.json
            mv registry/index.tmp.json registry/index.json
          else
            jq '[.[] | {
              id: .tool.id,
              name: .tool.name,
              template: .decision.template,
              source: .tool.source,
              url: .tool.sourceUrl,
              addedAt: now | todate
            }]' new-tools.json > registry/index.json
          fi
          
          # Create individual configs
          mkdir -p registry/configs
          jq -c '.[]' new-tools.json | while read tool; do
            ID=$(echo "$tool" | jq -r '.tool.id' | tr '/:' '-')
            echo "$tool" | jq '.generated.pluginConfig' > "registry/configs/${ID}.json"
          done
      
      - name: Create PR
        uses: peter-evans/create-pull-request@v6
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          commit-message: 'chore: add ${{ needs.discover.outputs.new_count }} new tools'
          title: '🔍 ${{ needs.discover.outputs.new_count }} new tools discovered'
          body: |
            ## Automated Discovery
            
            This PR adds **${{ needs.discover.outputs.new_count }}** newly discovered tools.
            
            ### New Tools
            
            $(jq -r '.[] | "- **\(.tool.name)** (\(.decision.template)): \(.tool.description | .[0:100])"' new-tools.json)
            
            ---
            
            _Generated by [Lyra Tool Discovery](https://github.com/nirholas/lyra-tool-discovery)_
          branch: discovery/week-${{ github.run_number }}
          delete-branch: true
          labels: |
            discovery
            automated
```

## Matrix Build for Sources

```yaml
# .github/workflows/matrix-discovery.yml
name: Multi-Source Discovery

on:
  workflow_dispatch:
    inputs:
      limit_per_source:
        description: 'Tools per source'
        default: '25'

jobs:
  discover:
    strategy:
      fail-fast: false
      matrix:
        source: [github, npm]
    
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install
        run: npm i -g @nirholas/lyra-tool-discovery
      
      - name: Discover ${{ matrix.source }}
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          lyra-discover discover \
            --sources ${{ matrix.source }} \
            --limit ${{ inputs.limit_per_source }} \
            > results-${{ matrix.source }}.json 2>/dev/null
      
      - uses: actions/upload-artifact@v4
        with:
          name: results-${{ matrix.source }}
          path: results-${{ matrix.source }}.json

  merge:
    needs: discover
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/download-artifact@v4
        with:
          path: artifacts
      
      - name: Merge
        run: |
          jq -s 'add' artifacts/results-*/results-*.json > combined.json
          echo "Total tools: $(jq length combined.json)"
      
      - uses: actions/upload-artifact@v4
        with:
          name: combined-results
          path: combined.json
```

## Caching Dependencies

```yaml
# .github/workflows/cached-discovery.yml
name: Cached Discovery

on:
  workflow_dispatch:

jobs:
  discover:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      
      - name: Get pnpm store
        id: pnpm-cache
        shell: bash
        run: echo "store=$(pnpm store path)" >> $GITHUB_OUTPUT
      
      - name: Cache pnpm
        uses: actions/cache@v4
        with:
          path: ${{ steps.pnpm-cache.outputs.store }}
          key: pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
          restore-keys: |
            pnpm-store-
      
      - name: Cache previous results
        uses: actions/cache@v4
        with:
          path: .cache
          key: discovery-cache-${{ github.run_number }}
          restore-keys: |
            discovery-cache-
      
      - name: Install
        run: pnpm add -g @nirholas/lyra-tool-discovery
      
      - name: Discover
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          mkdir -p .cache
          lyra-discover discover --limit 20 > results.json 2>/dev/null
          
          # Save tool IDs to cache
          jq -r '.[].tool.id' results.json >> .cache/known-tools.txt
          sort -u .cache/known-tools.txt -o .cache/known-tools.txt
```

## Secrets Required

| Secret | Description | Where to get it |
|--------|-------------|-----------------|
| `ANTHROPIC_API_KEY` | Anthropic API key | [console.anthropic.com](https://console.anthropic.com) |
| `OPENAI_API_KEY` | OpenAI API key | [platform.openai.com](https://platform.openai.com) |
| `GITHUB_TOKEN` | Auto-provided | Built-in |

Set secrets at: **Settings → Secrets and variables → Actions → New repository secret**

## Workflow Tips

### Reduce API Costs

```yaml
- name: Cheap Model Discovery
  env:
    AI_MODEL: claude-3-haiku-20240307  # Cheapest
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  run: lyra-discover discover --limit 100 > results.json
```

### Error Notifications

```yaml
- name: Notify on Failure
  if: failure()
  uses: actions/github-script@v7
  with:
    script: |
      github.rest.issues.create({
        owner: context.repo.owner,
        repo: context.repo.repo,
        title: '❌ Discovery workflow failed',
        body: `Workflow run failed: ${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`,
        labels: ['bug', 'ci']
      })
```

### Schedule Variations

```yaml
on:
  schedule:
    - cron: '0 0 * * *'     # Daily
    - cron: '0 0 * * 0'     # Weekly (Sunday)
    - cron: '0 0 1 * *'     # Monthly (1st)
    - cron: '0 */6 * * *'   # Every 6 hours
```

## Next Steps

- [Pipeline Integration](/guide/pipeline) - Build complete pipelines
- [Batch Processing](/examples/batch-processing) - Local batch processing
- [GitHub Actions Guide](/guide/github-actions) - More workflow patterns
