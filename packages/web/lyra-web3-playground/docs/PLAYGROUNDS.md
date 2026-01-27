<!--
  ✨ built by nich
  🌐 GitHub: github.com/nirholas
  💫 All the interactive playground components documented
-->

# Playgrounds & Interactive Components Guide

This document covers all the playground components available for building interactive learning and development experiences.

---

## Component Locations

| Component | Location | Purpose |
|-----------|----------|---------|
| FullStackPlayground | `src/components/FullStackPlayground/` | Complete dApp builder |
| InteractiveCodePlayground | `src/components/CodePlayground/` | Tutorial code runner |
| Playground components | `src/components/Playground/` | Multi-file editors with preview |
| LivePreview | `src/components/Playground/` | Sandboxed iframe preview |

---

## FullStackPlayground

**Location:** `src/components/FullStackPlayground/FullStackPlayground.tsx`  
**Access:** [lyra.works/fullstack-demo](https://lyra.works/fullstack-demo)

A complete full-stack dApp development environment combining:
- Smart contract code
- Frontend HTML/CSS/JavaScript
- Live preview
- Console output

### Props

```typescript
interface FullStackPlaygroundProps {
  title: string;
  description: string;
  files: PlaygroundFile[];
  scope?: Record<string, any>;
  previewStyles?: string;
}

interface PlaygroundFile {
  id: string;
  name: string;
  language: string;
  content: string;
}
```

### Features

- **Multi-file tabs**: Switch between contract and frontend files
- **Monaco Editor**: Full code editing experience
- **Live preview**: Renders HTML/CSS/JS in real-time
- **Console panel**: Shows logs, errors, warnings
- **Layout options**: Editor only, preview only, or split view
- **Reset button**: Restore original code
- **Download**: Export all files

### Usage

```tsx
import { FullStackPlayground } from '@/components/FullStackPlayground';

<FullStackPlayground
  title="Token Dashboard"
  description="A simple ERC20 token dashboard"
  files={[
    {
      id: 'contract',
      name: 'Token.sol',
      language: 'solidity',
      content: solidityCode
    },
    {
      id: 'html',
      name: 'index.html',
      language: 'html',
      content: htmlCode
    },
    {
      id: 'css',
      name: 'styles.css',
      language: 'css',
      content: cssCode
    },
    {
      id: 'js',
      name: 'app.js',
      language: 'javascript',
      content: jsCode
    }
  ]}
/>
```

---

## InteractiveCodePlayground

**Location:** `src/components/CodePlayground/InteractiveCodePlayground.tsx`

A tab-based code playground for tutorials with optional live preview.

### Props

```typescript
interface InteractiveCodePlaygroundProps {
  title: string;
  description: string;
  tabs: CodeTab[];
  tutorial?: TutorialStep[];
  challenges?: Challenge[];
  livePreview?: boolean;
  previewComponent?: React.ReactNode;
  onRun?: (code: string, language: string) => Promise<void>;
}

interface CodeTab {
  id: string;
  label: string;
  language: string;
  defaultCode: string;
}
```

### Features

- **Multiple code tabs**: Switch between different files/languages
- **Tutorial mode**: Step-by-step guidance
- **Challenges**: Built-in coding challenges
- **Live preview**: Optional preview component
- **Run button**: Execute code with custom handler
- **Copy button**: Copy current code

---

## LivePreview

**Location:** `src/components/Playground/LivePreview.tsx`

A sandboxed iframe for rendering HTML/CSS/JavaScript with security.

### Features

- **Sandboxed execution**: Safe iframe isolation
- **Responsive viewports**: Mobile, tablet, desktop presets
- **Auto-refresh**: Updates on code change
- **Full-screen mode**: Expand preview
- **Open in new tab**: Test in full browser
- **Console capture**: Logs appear in parent

### Props

```typescript
interface LivePreviewProps {
  html?: string;
  css?: string;
  javascript?: string;
  title?: string;
  allowFullscreen?: boolean;
}
```

### Usage

```tsx
<LivePreview
  html={htmlCode}
  css={cssCode}
  javascript={jsCode}
  title="My Preview"
  allowFullscreen={true}
/>
```

---

## Playground/FullStackPlayground (Alternative)

**Location:** `src/components/Playground/FullStackPlayground.tsx`

Similar to the main FullStackPlayground but with additional features:

### Features

- Contract deployment simulation
- Contract function interaction
- State management
- Console with deployment logs
- Viewport size controls

### Props

```typescript
interface FullStackPlaygroundProps {
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  files: CodeFile[];
  contractFunctions?: ContractFunction[];
  initialState?: Record<string, any>;
  onDeploy?: () => Promise<void>;
}
```

---

## InteractiveLearningPlayground

**Location:** `src/pages/InteractiveLearningPlayground.tsx`  
**Access:** [lyra.works/learn](https://lyra.works/learn)

The main learning page with guided tutorials.

### Features

- Tutorial browser
- Progress tracking
- Interactive examples
- Step-by-step guidance
- Challenge mode

---

## ExampleWithPlayground

**Location:** `src/components/ExampleWithPlayground.tsx`

Wrapper component that adds a code playground to any example.

### Props

```typescript
interface ExampleWithPlaygroundProps {
  children: React.ReactNode;
  title: string;
  description: string;
  contractCode: string;
  contractName?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  tags?: string[];
}
```

### Features

- **Content + Code**: Shows explanation alongside editable code
- **Syntax highlighting**: Monaco editor
- **Link to sandbox**: "Open in Sandbox" button
- **Difficulty badges**: Visual difficulty indicator
- **Tags**: Categorization

---

## Component Hierarchy

```
ExamplePage
└── ExampleWithPlayground
    └── Monaco Editor
        └── Contract Code

FullStackDemoPage  
└── FullStackPlayground
    ├── File Tabs
    ├── Monaco Editor
    ├── LivePreview (iframe)
    └── Console Panel

TutorialPage
└── InteractiveCodePlayground
    ├── Code Tabs
    ├── Monaco Editor
    ├── Tutorial Steps
    └── Challenges

SandboxPage
├── WebSandbox
│   ├── File Tree
│   ├── Monaco Editor
│   └── LivePreview
└── SoliditySandbox
    ├── File Tree
    ├── Monaco Editor
    └── Contract Panel

InteractiveSandbox (Legacy)
├── File Tree
├── Monaco Editor
├── Contract Panel
├── AI Assistant
└── Innovation Features
    ├── AI Whisperer
    ├── Time Machine
    ├── Exploit Lab
    ├── Collaborative Arena
    ├── Neural Gas Oracle
    └── Cross-Chain Weaver
```

---

## Comparison: Playground vs Sandbox

| Feature | Playgrounds | Sandboxes |
|---------|-------------|-----------|
| Purpose | Learning & tutorials | Full development |
| Complexity | Simpler | Feature-rich |
| File management | Limited | Full file tree |
| Deployment | Simulated | Real networks |
| AI features | None | AI Assistant |
| Use case | Demos, examples | Building dApps |

---

## When to Use Each

| Scenario | Use This |
|----------|----------|
| Teaching a concept | InteractiveCodePlayground |
| Showing a complete dApp | FullStackPlayground |
| Embedding in tutorials | ExampleWithPlayground |
| Full development | WebSandbox or SoliditySandbox |
| Learning security | InteractiveSandbox + Exploit Lab |
| Quick prototyping | ContractPlayground |

---

## Creating New Playgrounds

### Basic Template

```tsx
import { useState } from 'react';
import Editor from '@monaco-editor/react';

export default function MyPlayground() {
  const [code, setCode] = useState('// Your code here');
  const [output, setOutput] = useState('');

  const runCode = async () => {
    // Execute code logic
    setOutput('Executed!');
  };

  return (
    <div className="flex h-screen">
      {/* Editor */}
      <div className="w-1/2">
        <Editor
          height="100%"
          language="solidity"
          value={code}
          onChange={(value) => setCode(value || '')}
          theme="vs-dark"
        />
      </div>
      
      {/* Output */}
      <div className="w-1/2 bg-gray-900 p-4">
        <button onClick={runCode}>Run</button>
        <pre>{output}</pre>
      </div>
    </div>
  );
}
```

---

## Related Documentation

- [IDE_GUIDE.md](IDE_GUIDE.md) - Full IDE documentation
- [SANDBOX_GUIDE.md](SANDBOX_GUIDE.md) - Sandbox-specific features
- [INNOVATION_LAB.md](INNOVATION_LAB.md) - Experimental AI features
- [src/components/Playground/README.md](../src/components/Playground/README.md) - Component-level docs
