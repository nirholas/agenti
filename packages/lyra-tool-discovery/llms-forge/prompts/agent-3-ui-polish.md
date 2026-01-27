# Agent 3: UI Polish, Icons & Landing Page

You are a UI/UX engineer working on llms-forge, a Next.js 14 app for extracting documentation.

## Project Location
`/workspaces/lyra-tool-discovery/llms-forge`

## Your Mission
Polish the UI, replace all emojis with professional Lucide icons, and ensure the landing page effectively communicates what the tool does.

## Current State
The landing page has components that use emojis and make exaggerated claims about "1,600+ AI models" and "quantum extraction". We need to make it honest and professional while keeping it visually appealing.

## Tasks

### 1. Icon Audit
Search all files in `src/components/` for emoji usage and replace with Lucide icons:
- Search for emoji patterns in the codebase
- Map each emoji to an appropriate Lucide icon
- Ensure consistent sizing: `w-5 h-5` for inline, `w-6 h-6` for feature cards

Common replacements:
- Lightning/zap emoji -> `<Zap />`
- Document emoji -> `<FileText />`
- Checkmark emoji -> `<Check />`
- Star emoji -> `<Star />`
- Rocket emoji -> `<Rocket />`
- Warning emoji -> `<AlertTriangle />`
- Fire emoji -> `<Flame />`
- Robot emoji -> `<Bot />`

### 2. Update Hero.tsx
Current: Exaggerated AI claims
New: Honest, clear value proposition

```tsx
// Headline
"Extract Documentation for AI Agents"

// Subtitle  
"Instantly fetch and organize llms.txt files into downloadable markdown documents ready for Claude, ChatGPT, and other AI assistants."

// Optional badge
<span className="...">Free & Open Source</span>
```

Keep the gradient text effect but make the message honest.

### 3. Update Features.tsx
Replace fake features with real ones:

**Feature 1: Smart Discovery**
- Icon: `<Search />`
- Title: "Smart Discovery"
- Description: "Automatically finds llms.txt or llms-full.txt on any documentation site"

**Feature 2: Document Parsing**
- Icon: `<Scissors />`
- Title: "Organized Sections"  
- Description: "Splits documentation into individual markdown files by section"

**Feature 3: Agent-Ready Output**
- Icon: `<Bot />`
- Title: "Agent-Ready Output"
- Description: "Includes AGENT-GUIDE.md with instructions for AI assistants"

**Feature 4: Bulk Download**
- Icon: `<Archive />`
- Title: "One-Click Download"
- Description: "Download individual files or everything bundled as a ZIP"

### 4. Update HowItWorks.tsx
Simple, honest 3-step process:

**Step 1**
- Icon: `<Link />` or `<Globe />`
- Title: "Paste URL"
- Description: "Enter any documentation site URL"

**Step 2**
- Icon: `<Download />`
- Title: "Extract"
- Description: "We fetch and parse the llms.txt file"

**Step 3**
- Icon: `<Files />`
- Title: "Download"
- Description: "Get organized markdown files"

### 5. Update or Remove Stats.tsx
Current: Fake stats like "1,600+ Models", "12.4B Parameters"
Options:
1. Remove entirely
2. Replace with honest stats like:
   - "Works with any llms.txt site"
   - "100% Free"
   - "Open Source"
   - Or just show logos of compatible sites

### 6. Update ExtractionProcess.tsx
Current: Fake "quantum" processing stages
New: Honest processing steps

```tsx
const stages = [
  { id: 'fetch', label: 'Fetching llms.txt...', icon: Download },
  { id: 'parse', label: 'Parsing sections...', icon: FileText },
  { id: 'generate', label: 'Generating documents...', icon: Files },
  { id: 'complete', label: 'Complete!', icon: Check },
]
```

Keep the terminal-style animation and progress bar, just make the messages honest.

### 7. Update Header.tsx
- Logo/brand name: "LLMs Forge" (text or simple icon)
- Navigation: minimal - maybe just "Docs" link and GitHub icon
- GitHub link to: github.com/nirholas/lyra-tool-discovery
- Keep the glass/blur effect

### 8. Update Footer.tsx
Simple, professional footer:
```tsx
<footer className="...">
  <div className="...">
    <p className="text-gray-500 text-sm">
      Created by{' '}
      <a href="https://x.com/nichxbt" className="text-cyber-green hover:underline">
        nich
      </a>
    </p>
    <div className="flex gap-4">
      <a href="https://x.com/nichxbt" aria-label="X (Twitter)">
        {/* X/Twitter icon */}
      </a>
      <a href="https://github.com/nirholas" aria-label="GitHub">
        <Github className="w-5 h-5" />
      </a>
    </div>
  </div>
</footer>
```

### 9. Color & Theme Consistency
Verify these CSS classes are used consistently:
- `text-cyber-green` for primary accent
- `text-cyber-blue` for secondary accent
- `bg-dark-800`, `bg-dark-900` for backgrounds
- `border-gray-800` for borders
- Gradients: `from-cyber-green to-cyber-blue`

Check `tailwind.config.ts` for the exact color values.

## Lucide Icons Reference
Common icons you'll need:
```tsx
import {
  Search, FileText, Scissors, Bot, Archive, Download,
  Link, Globe, Files, Check, Zap, Star, Rocket,
  AlertTriangle, Github, ExternalLink, ArrowRight,
  Lightbulb, Info, Copy, RefreshCw
} from 'lucide-react'
```

## Files to Modify
- `src/components/Hero.tsx`
- `src/components/Features.tsx`
- `src/components/HowItWorks.tsx`
- `src/components/Stats.tsx`
- `src/components/ExtractionProcess.tsx`
- `src/components/Header.tsx`
- `src/components/Footer.tsx`
- `src/components/UrlInput.tsx` (check for emojis)
- Any other component with emojis

## Quality Requirements
- Zero emojis in the entire codebase
- Consistent icon sizing
- Professional but not boring
- Mobile responsive
- Accessible (aria-labels on icon-only buttons)

## Do Not
- Use any emojis
- Make fake claims about AI capabilities
- Use overly technical jargon
- Remove the visual appeal - keep the cyber aesthetic

Read each component, identify emojis and fake claims, then update systematically.
