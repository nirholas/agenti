# Visual Feature Guide

A visual walkthrough of the new web UI enhancements. (Screenshots to be added)

## 🎮 Interactive Playground

### Overview
![Playground Overview](docs/images/playground-overview.png)

The playground provides a split-panel interface for testing MCP tools:
- **Left Panel (30%)**: Tool list with search and filtering
- **Right Panel (70%)**: Interactive tool tester with dynamic forms
- **Resizable**: Drag the center gripper to adjust panel widths

### Tool Selection
![Tool Selection](docs/images/tool-selection.png)

Features visible in this view:
- Tool search bar at the top
- Tool count indicator
- Source type badges (purple=OpenAPI, pink=GraphQL, cyan=README)
- Parameter count for each tool
- Selected tool highlighted with white border

### Dynamic Form Generation
![Dynamic Forms](docs/images/dynamic-forms.png)

The form automatically adapts based on the tool's schema:
- **String fields**: Text input or textarea
- **Number fields**: Number input with validation
- **Boolean fields**: Checkbox
- **Enum fields**: Dropdown select
- **Array fields**: Add/remove items dynamically
- **Object fields**: Nested property groups
- **Required indicators**: Red asterisk on required fields

### Execution Results
![Execution Results](docs/images/execution-results.png)

After executing a tool:
- Success/error indicator at the top
- JSON-formatted response with syntax highlighting
- Copy button to clipboard
- Reset button to clear and start over

### Demo Mode
![Demo Mode](docs/images/demo-mode.png)

When no conversion has been performed:
- Yellow banner explaining demo mode
- Link to convert page
- Sample tools to explore the interface
- Same functionality as with real tools

---

## 📊 Generation Progress Indicator

### Progress Display
![Progress Indicator](docs/images/progress-indicator.png)

Visual elements:
1. **Circular Progress Ring**: Animated SVG showing 0-100% completion
2. **Step Cards**: 4 steps with icons and descriptions
   - Fetching Repository (10% weight)
   - Classifying Sources (20% weight)
   - Extracting Tools (40% weight)
   - Generating Server (30% weight)
3. **Tools Found Counter**: Real-time count of discovered tools
4. **Status Icons**: 
   - Yellow loader for active step
   - Green check for completed
   - Red X for errors

### Step States
![Step States](docs/images/step-states.png)

Each step shows its current state:
- **Pending**: Gray with waiting icon
- **Active**: Yellow with spinner animation
- **Complete**: Green with checkmark
- **Error**: Red with error icon and message

---

## 🎯 Branch/Tag/Commit Selection

### Branch Selector
![Branch Selector](docs/images/branch-selector.png)

Interface components:
1. **Three Tabs**: Branches, Tags, Commit
2. **Search Bar**: Filter refs by name
3. **Default Branch Badge**: Highlights repository default
4. **Ref List**: Scrollable list of available references
5. **Selected State**: Blue background on selected ref

### Branch Tab
![Branches Tab](docs/images/branches-tab.png)

Shows:
- Active development branches
- Default branch marked with badge
- Search to filter by name
- Recent branches appear first

### Tags Tab
![Tags Tab](docs/images/tags-tab.png)

Shows:
- Released versions/tags
- Semantic version sorting (if applicable)
- Search to find specific releases
- Useful for converting stable versions

### Commit Tab
![Commit Tab](docs/images/commit-tab.png)

Features:
- Text input for commit SHA
- Supports full or short SHA
- No API requests needed
- Direct commit reference

---

## 📋 Claude Config Export

### Config Overview
![Config Export](docs/images/config-export.png)

Three configuration methods with tabs:
1. **NPX Method** (Zero-install)
2. **Local Method** (Clone and build)
3. **Python Method** (Python-based)

### NPX Configuration
![NPX Config](docs/images/npx-config.png)

Shows:
- JSON configuration snippet
- Copy button with animation
- Download JSON button
- Step-by-step setup instructions
- Platform-specific paths

### Copy Animation
![Copy Animation](docs/images/copy-animation.png)

Visual feedback:
- Button changes to "Copied!" with checkmark
- Green color on success
- Animated transition
- Returns to normal after 2 seconds

### Setup Instructions
![Setup Instructions](docs/images/setup-instructions.png)

Includes:
1. Where to find Claude Desktop config file (by platform)
2. How to paste the configuration
3. How to restart Claude
4. How to verify the server is working

---

## 🔍 Tool Filtering & Search

### Filter Interface
![Filter Interface](docs/images/filter-interface.png)

Components:
1. **Search Bar**: Real-time text search
2. **Category Chips**: OpenAPI, GraphQL, README filters
3. **Sort Buttons**: Alphabetical, Source, Confidence
4. **Results Counter**: Shows X of Y tools

### Search in Action
![Search Example](docs/images/search-example.png)

Demonstrates:
- Search query "get repo"
- Filtered results highlighting matches
- Updated results counter
- Other filters remain active

### Category Filtering
![Category Filter](docs/images/category-filter.png)

Shows:
- Selected categories have colored backgrounds
- Multiple categories can be selected
- Results update in real-time
- Clear indication of active filters

### Sort Options
![Sort Options](docs/images/sort-options.png)

Three sorting modes:
- **Alphabetical**: A-Z by tool name
- **By Source**: Grouped by OpenAPI, GraphQL, README
- **By Confidence**: Highest confidence first

---

## ✨ Enhanced Tool Display

### Tool Cards
![Tool Cards](docs/images/tool-cards.png)

Card components:
- Tool name and description
- Source type badge with color
- Parameter count
- Expand/collapse chevron
- Hover effects

### Expanded Tool
![Expanded Tool](docs/images/expanded-tool.png)

Shows when expanded:
- Full description
- Input schema (JSON formatted)
- Output schema (if available)
- Required parameters highlighted
- Copy schema button

### Grouped View
![Grouped View](docs/images/grouped-view.png)

When sorting by source:
- Tools grouped under headers
- OpenAPI, GraphQL, README sections
- Color-coded section headers
- Collapsible groups

### Expand All
![Expand All](docs/images/expand-all.png)

Toolbar buttons:
- "Expand All" - Opens all tool details
- "Collapse All" - Closes all tool details
- Quick way to scan through all schemas

---

## 🎨 SplitView Component

### Resizing
![Resizing](docs/images/split-resize.png)

Interaction:
- Drag the center gripper left/right
- Respects minimum widths (250px left, 400px right)
- Smooth transition during drag
- Gripper highlights on hover

### Maximize/Minimize
![Maximize Buttons](docs/images/maximize-buttons.png)

Each panel has buttons:
- **Maximize Left**: Expand left panel to 80%
- **Maximize Right**: Expand right panel to 80%
- **Minimize**: Return to default split
- Icons change based on state

### Responsive Behavior
![Responsive](docs/images/responsive-split.png)

On smaller screens:
- Maintains minimum widths
- Vertical stacking on mobile
- Touch-friendly gripper
- Preserves functionality

---

## 🎨 Design System

### Color Palette
![Color Palette](docs/images/color-palette.png)

Source type colors:
- **OpenAPI**: Purple (`#a855f7`)
- **GraphQL**: Pink (`#ec4899`)
- **README**: Cyan (`#06b6d4`)
- **Universal**: Blue (`#3b82f6`)

### Typography
![Typography](docs/images/typography.png)

Font scales:
- Headings: `text-2xl` to `text-5xl`, bold
- Body: `text-sm` to `text-base`
- Labels: `text-xs`, neutral color
- Monospace: Code and JSON

### Glass Effects
![Glass Morphism](docs/images/glass-effects.png)

UI pattern:
- Semi-transparent backgrounds (`bg-neutral-900/50`)
- Backdrop blur (`backdrop-blur-sm`)
- Subtle borders (`border-neutral-800`)
- Layered depth

---

## 📱 Responsive Design

### Desktop View (1920x1080)
![Desktop View](docs/images/desktop-view.png)

Full features visible:
- Side-by-side panels
- All toolbars expanded
- Maximum information density

### Tablet View (768x1024)
![Tablet View](docs/images/tablet-view.png)

Adapted layout:
- Narrower panels
- Compact toolbars
- Touch-friendly targets

### Mobile View (375x667)
![Mobile View](docs/images/mobile-view.png)

Mobile optimizations:
- Vertical stacking
- Full-width panels
- Simplified navigation
- Hamburger menu

---

## 🎬 Animations

### Page Transitions
![Page Transitions](docs/images/page-transitions.png)

Framer Motion effects:
- Fade in on mount
- Slide up for cards
- Stagger children
- Exit animations

### Loading States
![Loading States](docs/images/loading-states.png)

Various loaders:
- Spinning circle for async operations
- Skeleton screens for content
- Progress bars for steps
- Shimmer effects

### Micro-interactions
![Micro-interactions](docs/images/micro-interactions.png)

Subtle feedback:
- Button hover states
- Focus outlines
- Active states
- Success checkmarks
- Error shakes

---

## 🔗 Navigation Flow

### User Journey Map
```
Home Page
    ↓
Convert Page → Enter URL
    ↓
    ├─→ Select Branch (optional)
    ↓
Click Convert → Progress Display
    ↓
Results Page
    ├─→ Tools Tab (with filtering)
    ├─→ Config Tab (copy/download)
    ├─→ Code Tab (view generated)
    └─→ Install Tab (instructions)
    ↓
Playground Link → Test Tools
    ↓
Select Tool → Fill Form → Execute → View Results
```

---

## 📖 Notes for Screenshot Creation

When capturing screenshots, ensure:

1. **High Resolution**: 2x retina (e.g., 2880x1800 for desktop)
2. **Clean State**: No Lorem Ipsum, use real examples
3. **Annotations**: Add callouts for important features
4. **Consistency**: Same theme/colors across all screenshots
5. **Focus**: Highlight the feature being demonstrated
6. **Context**: Show enough surrounding UI for orientation

### Recommended Tools

- **macOS**: `Cmd + Shift + 4` for selection capture
- **Windows**: `Windows + Shift + S` for Snipping Tool
- **Annotation**: Skitch, Monosnap, or Snagit
- **GIF Recording**: LICEcap or Kap for animations

### Example Repositories for Screenshots

Use these well-known repos for demonstration:
- **OpenAPI**: `stripe/stripe-node`, `twilio/twilio-node`
- **GraphQL**: `apollographql/apollo-client`
- **MCP Server**: `modelcontextprotocol/servers`
- **CLI Tool**: `vercel/vercel`

---

## 🎯 Key Messages to Convey

When creating visuals, emphasize:

1. **Ease of Use**: Simple, intuitive interfaces
2. **Power**: Comprehensive feature set
3. **Speed**: Real-time feedback and updates
4. **Flexibility**: Multiple workflows supported
5. **Professional**: Polished, production-ready UI

---

**Status**: Placeholder document - Screenshots to be added  
**Last Updated**: January 17, 2026  
**Format**: PNG or GIF recommended, max 2MB per image
