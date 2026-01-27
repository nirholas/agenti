<!--
  ✨ built by nich
  🌐 GitHub: github.com/nirholas
  💫 Your potential is limitless 🌌
-->

# 🎮 Interactive Learning Playground Components

A comprehensive set of React components for creating interactive, tutorial-driven coding experiences with live previews, multi-language support, and gamified learning.

## 🚀 Components

### Core Components

#### `SplitView`
Resizable split panel layout for side-by-side views.

```tsx
<SplitView
  left={<CodeEditor />}
  right={<LivePreview />}
  defaultSplit={50}
  orientation="horizontal"
/>
```

**Props:**
- `left`, `right`: React nodes for each panel
- `defaultSplit`: Initial split percentage (0-100)
- `minLeftWidth`, `minRightWidth`: Minimum panel widths
- `orientation`: 'horizontal' | 'vertical'
- `showResizer`: Enable/disable resizing

---

#### `MultiLanguageTabs`
Tabbed code editor with support for multiple languages.

```tsx
<MultiLanguageTabs
  tabs={[
    { id: 'html', label: 'HTML', language: 'html', code: '...' },
    { id: 'js', label: 'JavaScript', language: 'javascript', code: '...' },
    { id: 'solidity', label: 'Solidity', language: 'solidity', code: '...' }
  ]}
  onCodeChange={(tabId, code) => console.log(tabId, code)}
/>
```

**Supported Languages:**
- HTML, CSS, JavaScript, TypeScript
- Solidity, Rust, Python
- JSON, YAML, Markdown

---

#### `LivePreview`
Sandboxed iframe preview with responsive viewport controls.

```tsx
<LivePreview
  html={htmlCode}
  css={cssCode}
  javascript={jsCode}
  title="Live Demo"
  allowFullscreen={true}
/>
```

**Features:**
- 📱 Responsive viewport sizes (mobile, tablet, desktop)
- 🔄 Auto-refresh on code change
- 🚀 Open in new tab
- 🛡️ Sandboxed execution
- 📊 Console capture

---

#### `InteractiveTutorial`
Step-by-step guided tutorial system with checkpoints.

```tsx
<InteractiveTutorial
  steps={[
    {
      id: 'step1',
      title: 'Connect Wallet',
      description: 'Learn how to detect MetaMask',
      code: '// Step code here',
      language: 'javascript',
      explanation: 'MetaMask injects window.ethereum...',
      checkpoints: [
        {
          label: 'Check for window.ethereum',
          check: (code) => code.includes('window.ethereum')
        }
      ],
      hints: ['Use typeof to check', 'Show error if not found'],
      challenge: {
        task: 'Add error handling',
        solution: 'if (!window.ethereum) throw new Error(...)',
        validation: (code) => code.includes('throw new Error')
      }
    }
  ]}
  currentCode={code}
  onCodeChange={setCode}
  onStepChange={setStep}
  onComplete={() => alert('Done!')}
/>
```

**Features:**
- ✅ Automatic checkpoint validation
- 💡 Progressive hint system
- 🎯 Step-by-step guidance
- 🏆 Challenge mode
- 📊 Progress tracking

---

#### `ChallengeSystem`
Gamified coding challenges with tests and scoring.

```tsx
<ChallengeSystem
  challenge={{
    id: 'challenge1',
    title: 'Add Batch Minting',
    description: 'Implement multi-NFT minting',
    difficulty: 'medium',
    points: 200,
    initialCode: '...',
    solution: '...',
    tests: [
      {
        id: 'test1',
        description: 'Function accepts array parameter',
        validate: (code) => code.includes('string[]')
      }
    ],
    hints: ['Use a loop', 'Calculate total cost']
  }}
  currentCode={code}
  onCodeChange={setCode}
  onComplete={(points) => console.log('Earned:', points)}
/>
```

**Features:**
- 🎮 Point-based scoring
- 📝 Multiple test cases
- 💡 Progressive hints (with point penalties)
- 🏆 Difficulty levels
- 🔄 Reset functionality
- 📊 Attempt tracking

---

#### `ProgressiveLevels`
Difficulty progression system with locked/unlocked levels.

```tsx
<ProgressiveLevels
  levels={[
    {
      level: 'beginner',
      title: 'Getting Started',
      description: 'Learn the basics',
      estimatedTime: '30 min',
      unlocked: true,
      topics: ['Wallets', 'Transactions', 'Balances'],
      prerequisites: []
    }
  ]}
  currentLevel="beginner"
  onLevelChange={setLevel}
  userProgress={{
    completedLevels: ['beginner'],
    currentStreak: 5,
    totalPoints: 450
  }}
/>
```

**Levels:**
- 🟢 Beginner
- 🔵 Intermediate
- 🟣 Advanced
- 🟠 Expert

---

#### `InlineAnnotations` & `AnnotationsPanel`
Code explanations with line-specific annotations.

```tsx
// Inline (appears next to code)
<InlineAnnotations
  annotations={[
    {
      lineStart: 10,
      type: 'concept',
      title: 'EIP-1193 Provider',
      content: 'window.ethereum is the standard...',
      code: 'if (typeof window.ethereum !== "undefined")'
    }
  ]}
  lineHeight={19}
  codeLines={code.split('\n')}
/>

// Panel (sidebar list)
<AnnotationsPanel annotations={annotations} />
```

**Annotation Types:**
- 💡 `info` - General information
- ⚠️ `warning` - Important cautions
- ✨ `tip` - Best practices
- 📚 `concept` - Core concepts

---

## 🎨 Complete Example

```tsx
import {
  SplitView,
  MultiLanguageTabs,
  LivePreview,
  InteractiveTutorial,
  ChallengeSystem,
  ProgressiveLevels
} from '@/components/Playground';

export default function WalletTutorial() {
  const [tabs, setTabs] = useState([
    { id: 'html', label: 'HTML', language: 'html', code: '...' },
    { id: 'js', label: 'JavaScript', language: 'javascript', code: '...' }
  ]);

  return (
    <div className="h-screen flex">
      {/* Left: Levels */}
      <div className="w-80">
        <ProgressiveLevels
          levels={levels}
          currentLevel="beginner"
          onLevelChange={setLevel}
        />
      </div>

      {/* Center: Split Editor/Preview */}
      <div className="flex-1">
        <SplitView
          left={
            <MultiLanguageTabs
              tabs={tabs}
              onCodeChange={handleCodeChange}
            />
          }
          right={
            <LivePreview
              html={tabs[0].code}
              javascript={tabs[1].code}
            />
          }
        />
      </div>

      {/* Right: Tutorial/Challenge */}
      <div className="w-96">
        <InteractiveTutorial
          steps={tutorialSteps}
          currentCode={tabs[1].code}
          onCodeChange={setCode}
          onComplete={() => alert('Complete!')}
        />
      </div>
    </div>
  );
}
```

## 🎯 Features

### Learning Features
- ✅ **Checkpoint Validation** - Auto-validate learning objectives
- 💡 **Progressive Hints** - Reveal hints with point penalties
- 🎯 **Challenges** - Test knowledge with coding challenges
- 📊 **Progress Tracking** - Track completions, streaks, points
- 🏆 **Gamification** - Points, badges, levels

### Editor Features
- 🎨 **Syntax Highlighting** - Monaco editor with themes
- 🔄 **Multi-Language** - Support for 10+ languages
- 📋 **Copy-Paste** - One-click code copying
- 🔍 **Line Numbers** - Professional code display
- 🎨 **Dark/Light Mode** - Follows system theme

### Preview Features
- 📱 **Responsive Viewports** - Mobile, tablet, desktop
- 🔄 **Live Updates** - Auto-refresh on changes
- 🚀 **Open in New Tab** - Full-screen preview
- 🛡️ **Sandboxed** - Safe code execution
- 📊 **Console Capture** - See console output

## 📚 Interactive Examples

Created interactive tutorials for:
1. ✅ **Wallet Connect** - 5 steps with live preview
2. ✅ **NFT Minting** - 6 steps + batch mint challenge
3. ✅ **Token Swap** - 5 steps with DeFi concepts
4. 🔄 **Smart Contracts** - Coming soon
5. 🔄 **DeFi Lending** - Coming soon

## 🚀 Usage

### Basic Tutorial
```tsx
import { InteractiveTutorial } from '@/components/Playground';

const steps = [
  {
    id: '1',
    title: 'Setup',
    description: 'Import libraries',
    code: 'import { ethers } from "ethers";',
    language: 'javascript',
    explanation: 'Ethers.js is the standard library...',
    checkpoints: [
      { label: 'Import ethers', check: (c) => c.includes('ethers') }
    ]
  }
];

<InteractiveTutorial
  steps={steps}
  currentCode={code}
  onCodeChange={setCode}
  onStepChange={setStep}
/>
```

### With Split View
```tsx
<SplitView
  left={<MultiLanguageTabs tabs={tabs} />}
  right={<LivePreview html={html} css={css} javascript={js} />}
/>
```

## 🎮 Gamification System

- **Points**: Earn points by completing tutorials and challenges
- **Streaks**: Track consecutive days of learning
- **Levels**: Progress from Beginner → Expert
- **Badges**: Unlock achievements
- **Leaderboard**: Coming soon

## 🛠️ Tech Stack

- **React** - UI components
- **TypeScript** - Type safety
- **Monaco Editor** - Code editing
- **Tailwind CSS** - Styling
- **Lucide Icons** - Icons

## 📖 Documentation

Each component is fully typed with TypeScript interfaces. See component files for detailed prop types and examples.

## 🎯 Roadmap

- [ ] Add more interactive examples (10+ more)
- [ ] Implement user authentication
- [ ] Add progress persistence (localStorage/database)
- [ ] Create shareable tutorial links
- [ ] Add video explanations
- [ ] Implement AI-powered hints
- [ ] Add collaborative coding
- [ ] Create mobile app version

## 🤝 Contributing

This is a revolutionary learning platform. Contributions welcome!

## 📄 License

MIT License - Build amazing learning experiences!
