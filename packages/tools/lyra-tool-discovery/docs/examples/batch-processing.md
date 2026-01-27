# Batch Processing

Process large numbers of tools with proper rate limiting, progress tracking, and error handling.

## Goal

Discover and analyze hundreds of tools efficiently while handling API limits and errors gracefully.

## Basic Batch Processing

```typescript
import { ToolDiscovery } from '@nirholas/lyra-tool-discovery';

async function batchProcess(totalLimit: number, batchSize: number = 10) {
  const discovery = new ToolDiscovery({
    provider: 'anthropic',
    model: 'claude-3-haiku-20240307'  // Use cheap model for batch
  });
  
  const allResults = [];
  let processed = 0;
  
  while (processed < totalLimit) {
    const limit = Math.min(batchSize, totalLimit - processed);
    
    console.log(`\n📦 Processing batch: ${processed + 1} to ${processed + limit}`);
    
    const results = await discovery.discover({
      sources: ['github', 'npm'],
      limit
    });
    
    allResults.push(...results);
    processed += limit;
    
    console.log(`✅ Completed: ${processed}/${totalLimit}`);
    
    // Rate limit: wait between batches
    if (processed < totalLimit) {
      console.log('⏳ Waiting 5 seconds...');
      await sleep(5000);
    }
  }
  
  return allResults;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Usage
const results = await batchProcess(100, 10);
console.log(`\n🎉 Total processed: ${results.length}`);
```

## Async Generator Pattern

Process tools as an async stream:

```typescript
import { GitHubSource, NpmSource, AIAnalyzer } from '@nirholas/lyra-tool-discovery';
import type { DiscoveredTool, TemplateDecision } from '@nirholas/lyra-tool-discovery';

interface BatchResult {
  tool: DiscoveredTool;
  decision: TemplateDecision;
}

async function* batchDiscover(
  totalLimit: number,
  batchSize: number = 10
): AsyncGenerator<BatchResult[], void, unknown> {
  const github = new GitHubSource();
  const npm = new NpmSource();
  const analyzer = new AIAnalyzer({ 
    provider: 'anthropic',
    model: 'claude-3-haiku-20240307'
  });
  
  // Get all tools first
  const githubTools = await github.searchMCPServers(Math.ceil(totalLimit / 2));
  const npmTools = await npm.searchMCPServers(Math.ceil(totalLimit / 2));
  
  const allTools = [...githubTools, ...npmTools]
    .filter(t => t.hasMCPSupport)
    .slice(0, totalLimit);
  
  console.log(`📊 Total tools to process: ${allTools.length}`);
  
  // Process in batches
  for (let i = 0; i < allTools.length; i += batchSize) {
    const batch = allTools.slice(i, i + batchSize);
    const results: BatchResult[] = [];
    
    for (const tool of batch) {
      try {
        const decision = await analyzer.analyzeAndDecide(tool);
        results.push({ tool, decision });
      } catch (error) {
        console.error(`Failed: ${tool.name} - ${error}`);
      }
      
      // Small delay between individual calls
      await sleep(500);
    }
    
    yield results;
    
    // Larger delay between batches
    if (i + batchSize < allTools.length) {
      await sleep(2000);
    }
  }
}

// Usage
async function main() {
  const allResults: BatchResult[] = [];
  let batchNum = 0;
  
  for await (const batch of batchDiscover(50, 5)) {
    batchNum++;
    console.log(`\n📦 Batch ${batchNum}: ${batch.length} tools`);
    
    for (const { tool, decision } of batch) {
      console.log(`  ✅ ${tool.name} → ${decision.template}`);
    }
    
    allResults.push(...batch);
  }
  
  console.log(`\n🎉 Total: ${allResults.length} tools processed`);
}
```

## Progress Tracking

```typescript
interface ProgressInfo {
  current: number;
  total: number;
  percent: number;
  elapsed: number;
  eta: number;
  currentTool: string;
}

class ProgressTracker {
  private startTime: number;
  private current = 0;
  private total: number;
  private callback: (info: ProgressInfo) => void;
  
  constructor(total: number, callback: (info: ProgressInfo) => void) {
    this.total = total;
    this.callback = callback;
    this.startTime = Date.now();
  }
  
  update(toolName: string) {
    this.current++;
    const elapsed = Date.now() - this.startTime;
    const rate = this.current / elapsed;
    const remaining = this.total - this.current;
    const eta = remaining / rate;
    
    this.callback({
      current: this.current,
      total: this.total,
      percent: Math.round((this.current / this.total) * 100),
      elapsed,
      eta: Math.round(eta),
      currentTool: toolName
    });
  }
}

// Usage
const tracker = new ProgressTracker(100, (info) => {
  process.stdout.write(
    `\r[${info.percent}%] ${info.current}/${info.total} - ${info.currentTool} (ETA: ${info.eta}ms)`
  );
});

for (const tool of tools) {
  await processToolAsync(tool);
  tracker.update(tool.name);
}
```

## Error Handling and Retry

```typescript
interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
}

async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = { maxRetries: 3, baseDelay: 1000, maxDelay: 30000 }
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt < config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Don't retry on non-retryable errors
      if (error.message?.includes('not found')) {
        throw error;
      }
      
      if (attempt < config.maxRetries - 1) {
        const delay = Math.min(
          config.baseDelay * Math.pow(2, attempt),
          config.maxDelay
        );
        
        console.log(`⚠️ Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }
  
  throw lastError;
}

// Usage in batch processing
async function processBatchWithRetry(tools: DiscoveredTool[]) {
  const analyzer = new AIAnalyzer();
  const results = [];
  const errors = [];
  
  for (const tool of tools) {
    try {
      const decision = await withRetry(
        () => analyzer.analyzeAndDecide(tool),
        { maxRetries: 3, baseDelay: 1000, maxDelay: 30000 }
      );
      results.push({ tool, decision });
    } catch (error) {
      errors.push({ tool, error });
    }
  }
  
  return { results, errors };
}
```

## Concurrent Processing

Process multiple tools concurrently (with limits):

```typescript
async function processConcurrently(
  tools: DiscoveredTool[],
  concurrency: number = 3
): Promise<BatchResult[]> {
  const analyzer = new AIAnalyzer();
  const results: BatchResult[] = [];
  const queue = [...tools];
  
  async function worker() {
    while (queue.length > 0) {
      const tool = queue.shift()!;
      
      try {
        const decision = await analyzer.analyzeAndDecide(tool);
        results.push({ tool, decision });
        console.log(`✅ ${tool.name} → ${decision.template}`);
      } catch (error) {
        console.error(`❌ ${tool.name}: ${error}`);
      }
      
      // Small delay to avoid bursts
      await sleep(200);
    }
  }
  
  // Start workers
  const workers = Array(concurrency).fill(null).map(() => worker());
  await Promise.all(workers);
  
  return results;
}
```

## Saving Progress

Resume from failures:

```typescript
import { existsSync, readFileSync, writeFileSync } from 'fs';

interface CheckpointData {
  processedIds: string[];
  results: BatchResult[];
  lastUpdate: string;
}

class CheckpointManager {
  private filepath: string;
  private data: CheckpointData;
  
  constructor(filepath: string) {
    this.filepath = filepath;
    this.data = this.load();
  }
  
  private load(): CheckpointData {
    if (existsSync(this.filepath)) {
      return JSON.parse(readFileSync(this.filepath, 'utf-8'));
    }
    return { processedIds: [], results: [], lastUpdate: new Date().toISOString() };
  }
  
  save() {
    this.data.lastUpdate = new Date().toISOString();
    writeFileSync(this.filepath, JSON.stringify(this.data, null, 2));
  }
  
  isProcessed(id: string): boolean {
    return this.data.processedIds.includes(id);
  }
  
  addResult(result: BatchResult) {
    this.data.processedIds.push(result.tool.id);
    this.data.results.push(result);
  }
  
  getResults(): BatchResult[] {
    return this.data.results;
  }
}

// Usage
async function resumableProcessing(tools: DiscoveredTool[]) {
  const checkpoint = new CheckpointManager('checkpoint.json');
  const analyzer = new AIAnalyzer();
  
  const pending = tools.filter(t => !checkpoint.isProcessed(t.id));
  console.log(`📊 ${pending.length} tools pending (${tools.length - pending.length} already done)`);
  
  for (const tool of pending) {
    try {
      const decision = await analyzer.analyzeAndDecide(tool);
      checkpoint.addResult({ tool, decision });
      checkpoint.save();  // Save after each success
      console.log(`✅ ${tool.name}`);
    } catch (error) {
      console.error(`❌ ${tool.name}: ${error}`);
    }
  }
  
  return checkpoint.getResults();
}
```

## Complete Example

```typescript
// batch-processing.ts
import { 
  GitHubSource, 
  NpmSource, 
  AIAnalyzer,
  getAvailableProviders
} from '@nirholas/lyra-tool-discovery';

async function main() {
  // Check providers
  const providers = getAvailableProviders();
  if (providers.length === 0) {
    console.error('❌ No AI providers configured');
    process.exit(1);
  }
  
  console.log(`🤖 Using: ${providers[0]}`);
  
  // Collect tools
  const github = new GitHubSource();
  const npm = new NpmSource();
  
  console.log('\n🔍 Collecting tools...');
  const [githubTools, npmTools] = await Promise.all([
    github.searchMCPServers(25),
    npm.searchMCPServers(25)
  ]);
  
  const tools = [...githubTools, ...npmTools]
    .filter(t => t.hasMCPSupport);
  
  console.log(`📊 Found ${tools.length} MCP tools`);
  
  // Process with progress
  const analyzer = new AIAnalyzer({
    provider: providers[0],
    model: providers[0] === 'anthropic' ? 'claude-3-haiku-20240307' : 'gpt-3.5-turbo'
  });
  
  const results = [];
  const errors = [];
  
  for (let i = 0; i < tools.length; i++) {
    const tool = tools[i];
    process.stdout.write(`\r[${i + 1}/${tools.length}] Processing: ${tool.name.padEnd(40)}`);
    
    try {
      const decision = await analyzer.analyzeAndDecide(tool);
      results.push({ tool, decision });
    } catch (error) {
      errors.push({ tool, error });
    }
    
    // Rate limiting
    await new Promise(r => setTimeout(r, 500));
  }
  
  // Summary
  console.log('\n\n📊 Summary');
  console.log(`✅ Success: ${results.length}`);
  console.log(`❌ Errors: ${errors.length}`);
  
  // Group by template
  const byTemplate = new Map<string, number>();
  for (const { decision } of results) {
    byTemplate.set(
      decision.template, 
      (byTemplate.get(decision.template) || 0) + 1
    );
  }
  
  console.log('\n📦 By Template:');
  for (const [template, count] of byTemplate) {
    console.log(`  ${template}: ${count}`);
  }
}

main().catch(console.error);
```

## Next Steps

- [GitHub Actions](/examples/github-actions) - Automated batch processing
- [Pipeline Integration](/guide/pipeline) - Build processing pipelines
- [API Reference](/api/) - Full API documentation
