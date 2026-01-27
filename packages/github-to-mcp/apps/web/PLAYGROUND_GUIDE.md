# Playground Developer Guide

Quick reference for working with the github-to-mcp playground components.

## Quick Start

### Running the Playground

```bash
cd apps/web
pnpm dev
```

Navigate to `http://localhost:3000/playground`

## Component API Reference

### Playground Component

```typescript
import Playground from '@/components/Playground';

<Playground 
  initialResult={conversionResult}  // Optional: Pre-load tools
  className="custom-styles"          // Optional: Additional classes
/>
```

**Props:**
- `initialResult?: ConversionResult | null` - Pre-loaded conversion result with tools
- `className?: string` - Additional CSS classes

**Features:**
- Automatically uses localStorage to persist last conversion
- Falls back to demo tools if no result available
- Integrates SplitView for resizable layout

### PlaygroundToolTester Component

```typescript
import PlaygroundToolTester from '@/components/PlaygroundToolTester';

<PlaygroundToolTester
  tool={selectedTool}
  onExecute={handleExecute}
  className="h-full"
/>
```

**Props:**
- `tool: Tool` - The tool to test (required)
- `onExecute: (toolName: string, args: Record<string, any>) => Promise<any>` - Execution handler
- `className?: string` - Additional CSS classes

**Schema Support:**
- ✅ String inputs with textarea for long text
- ✅ Number inputs with validation
- ✅ Boolean inputs with checkbox
- ✅ Array inputs with add/remove items
- ✅ Object inputs with nested properties
- ✅ Enum inputs with dropdown select
- ✅ Required field validation

### SplitView Component

```typescript
import SplitView from '@/components/SplitView';

<SplitView
  left={<LeftPanel />}
  right={<RightPanel />}
  defaultSplit={30}          // 30% left, 70% right
  minLeftWidth={250}         // Minimum left panel width
  minRightWidth={400}        // Minimum right panel width
  orientation="horizontal"   // 'horizontal' | 'vertical'
/>
```

**Props:**
- `left: React.ReactNode` - Left panel content
- `right: React.ReactNode` - Right panel content
- `defaultSplit?: number` - Initial split percentage (default: 50)
- `minLeftWidth?: number` - Min left panel width in px (default: 200)
- `minRightWidth?: number` - Min right panel width in px (default: 200)
- `orientation?: 'horizontal' | 'vertical'` - Split direction (default: horizontal)

**Features:**
- Drag to resize
- Maximize/minimize buttons
- Respects minimum widths
- Smooth transitions

### BranchSelector Component

```typescript
import BranchSelector from '@/components/BranchSelector';
import type { GitRef } from '@/components/BranchSelector';

<BranchSelector
  repoUrl="https://github.com/owner/repo"
  onSelect={(ref: GitRef) => console.log(ref)}
  defaultRef={{ type: 'branch', ref: 'main' }}
/>
```

**Props:**
- `repoUrl: string` - GitHub repository URL (required)
- `onSelect: (ref: GitRef | null) => void` - Selection callback
- `defaultRef?: GitRef` - Pre-selected reference
- `className?: string` - Additional CSS classes

**GitRef Interface:**
```typescript
interface GitRef {
  type: 'branch' | 'tag' | 'commit';
  ref: string;           // Branch name, tag name, or commit SHA
  isDefault?: boolean;   // True for repository default branch
}
```

### GenerationProgress Component

```typescript
import GenerationProgress from '@/components/GenerationProgress';
import { useGenerationProgress } from '@/hooks/use-generation-progress';

function MyComponent() {
  const progress = useGenerationProgress();

  // Start step
  progress.startStep('fetching', 'Fetching repository...');
  
  // Complete step
  progress.completeStep('fetching', 'Repository fetched');
  
  // Error handling
  progress.errorStep('extracting', 'Failed to extract tools');
  
  // Add tools found
  progress.addToolsFound(5);

  return <GenerationProgress progress={progress} />;
}
```

**Hook Methods:**
- `startStep(step, message)` - Mark step as active
- `completeStep(step, message)` - Mark step as completed
- `errorStep(step, message)` - Mark step as errored
- `addToolsFound(count)` - Increment tools counter
- `reset()` - Reset all progress

**Progress Steps:**
1. `fetching` - Fetching Repository (10% weight)
2. `classifying` - Classifying Sources (20% weight)
3. `extracting` - Extracting Tools (40% weight)
4. `generating` - Generating Server (30% weight)

### ClaudeConfigExport Component

```typescript
import ClaudeConfigExport from '@/components/ClaudeConfigExport';

<ClaudeConfigExport
  repoUrl="https://github.com/owner/repo"
  repoName="owner/repo"
  configName="my-mcp-server"
/>
```

**Props:**
- `repoUrl: string` - GitHub repository URL
- `repoName: string` - Repository name (owner/repo)
- `configName?: string` - Custom server name (default: repo name)

**Config Types:**
1. **NPX** - Zero-install with npx
2. **Local** - Clone and build from source
3. **Python** - Python-based server

### ToolFilter Component

```typescript
import ToolFilter from '@/components/ToolFilter';
import type { ToolFilterState } from '@/components/ToolFilter';

<ToolFilter
  filters={filterState}
  onFilterChange={setFilterState}
  totalCount={100}
  filteredCount={42}
/>
```

**ToolFilterState Interface:**
```typescript
interface ToolFilterState {
  searchQuery: string;
  selectedCategories: string[];  // 'openapi', 'graphql', 'readme'
  sortBy: 'alphabetical' | 'source' | 'confidence';
}
```

### ToolList Component

```typescript
import ToolList from '@/components/ToolList';

<ToolList
  tools={toolsArray}
  showFilter={true}
  defaultExpanded={false}
/>
```

**Props:**
- `tools: Tool[]` - Array of tools to display
- `showFilter?: boolean` - Show filter UI (default: false)
- `defaultExpanded?: boolean` - Expand all tools by default (default: false)
- `className?: string` - Additional CSS classes

## Custom Hooks

### useGenerationProgress

```typescript
import { useGenerationProgress } from '@/hooks/use-generation-progress';

const progress = useGenerationProgress();

// Access properties
progress.progress;      // 0-100
progress.isComplete;    // boolean
progress.hasError;      // boolean
progress.toolsFound;    // number
progress.steps;         // Array of step objects
```

### useLocalStorage

```typescript
import { useLocalStorage } from '@/hooks/use-local-storage';

const [value, setValue] = useLocalStorage<ConversionResult>(
  'playground-result',  // key
  null                  // default value
);
```

## Types Reference

### Tool

```typescript
interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, SchemaProperty>;
    required?: string[];
  };
  source?: {
    type: 'openapi' | 'graphql' | 'readme' | 'universal';
    file: string;
    confidence?: number;
  };
}
```

### SchemaProperty

```typescript
interface SchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  default?: any;
  enum?: any[];
  items?: SchemaProperty;
  properties?: Record<string, SchemaProperty>;
  required?: string[];
}
```

### ConversionResult

```typescript
interface ConversionResult {
  success: boolean;
  tools: Tool[];
  repository: {
    url: string;
    name: string;
    owner: string;
    ref?: string;
  };
  stats: {
    totalTools: number;
    openApiTools: number;
    graphqlTools: number;
    readmeTools: number;
  };
}
```

## Styling Guide

### Color Coding

```typescript
const SOURCE_COLORS = {
  openapi: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  graphql: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  readme: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  universal: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
};
```

### Common Patterns

**Glass Card:**
```tsx
<div className="rounded-xl border border-neutral-800 bg-neutral-900/50 backdrop-blur-sm">
  {/* Content */}
</div>
```

**Action Button:**
```tsx
<Button className="bg-white hover:bg-neutral-200 text-black">
  Execute
</Button>
```

**Input Field:**
```tsx
<Input 
  className="bg-neutral-900 border-neutral-800 text-white"
  placeholder="Enter value..."
/>
```

## Best Practices

### 1. Error Handling

Always handle errors gracefully:

```typescript
try {
  const result = await executeTool(toolName, args);
  // Handle success
} catch (error) {
  console.error('Tool execution failed:', error);
  // Show user-friendly error message
}
```

### 2. Loading States

Show loading indicators for async operations:

```typescript
const [isLoading, setIsLoading] = useState(false);

async function handleAction() {
  setIsLoading(true);
  try {
    await performAction();
  } finally {
    setIsLoading(false);
  }
}
```

### 3. Validation

Validate required fields before execution:

```typescript
const isValid = tool.inputSchema.required?.every(
  field => args[field] !== undefined && args[field] !== ''
);

if (!isValid) {
  // Show validation error
  return;
}
```

### 4. Memoization

Use `useMemo` for expensive computations:

```typescript
const filteredTools = useMemo(() => {
  return tools.filter(tool => 
    tool.name.toLowerCase().includes(query.toLowerCase())
  );
}, [tools, query]);
```

### 5. Cleanup

Clean up event listeners and timers:

```typescript
useEffect(() => {
  const handleResize = () => { /* ... */ };
  window.addEventListener('resize', handleResize);
  
  return () => {
    window.removeEventListener('resize', handleResize);
  };
}, []);
```

## Testing

### Component Tests

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import Playground from '@/components/Playground';

describe('Playground', () => {
  it('renders demo tools by default', () => {
    render(<Playground />);
    expect(screen.getByText(/demo mode/i)).toBeInTheDocument();
  });

  it('filters tools by search query', () => {
    render(<Playground />);
    const searchInput = screen.getByPlaceholderText(/search tools/i);
    fireEvent.change(searchInput, { target: { value: 'get_repo' } });
    // Assert filtered results
  });
});
```

### Integration Tests

```typescript
describe('Playground Integration', () => {
  it('executes tool and displays result', async () => {
    render(<Playground />);
    
    // Select tool
    fireEvent.click(screen.getByText('get_repository'));
    
    // Fill form
    const ownerInput = screen.getByLabelText(/owner/i);
    fireEvent.change(ownerInput, { target: { value: 'github' } });
    
    // Execute
    fireEvent.click(screen.getByText(/execute/i));
    
    // Wait for result
    await screen.findByText(/result/i);
  });
});
```

## Common Issues

### Issue: Tools not appearing
**Solution:** Check localStorage for cached result or ensure demo tools are loaded.

### Issue: Split view not resizing
**Solution:** Ensure parent container has defined height (`h-full` or specific height).

### Issue: Form validation not working
**Solution:** Verify `required` array in tool's inputSchema is populated.

### Issue: GitHub API rate limit
**Solution:** Use authenticated requests with GITHUB_TOKEN environment variable.

### Issue: TypeScript errors
**Solution:** Run `pnpm typecheck` and ensure all types are imported correctly.

## Performance Tips

1. **Lazy Load Monaco Editor**: Only load code editor when needed
2. **Virtualize Long Lists**: Use `react-window` for 100+ tools
3. **Debounce Search**: Delay filter execution for better UX
4. **Memoize Computations**: Use `useMemo` for filtering/sorting
5. **Code Split**: Dynamic import heavy components

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Framer Motion API](https://www.framer.com/motion/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Radix UI](https://www.radix-ui.com/)
- [GitHub REST API](https://docs.github.com/en/rest)

---

**Need Help?** Check the main [WEB_UI_ENHANCEMENTS.md](/WEB_UI_ENHANCEMENTS.md) for comprehensive documentation.
