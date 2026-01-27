<!--
  ✨ built by nich
  🌐 GitHub: github.com/nirholas
  💫 Technology for everyone ♿
-->

# Accessibility Documentation

Lyra Web3 Playground is committed to being **truly accessible to all users**. We go beyond WCAG 2.1 Level AA compliance to implement cutting-edge, futuristic accessibility features that make Web3 development accessible to everyone.

## Overview

Our accessibility system includes features for:
- **Blind users** - Full screen reader support, text-to-speech, code-to-natural-language
- **Low vision** - High contrast, large text, color blind filters, reading guides
- **Deaf users** - Visual feedback for all audio cues, captions
- **Motor impairments** - Dwell click, large targets, full keyboard navigation
- **Cognitive disabilities** - Simplified UI, focus mode, reduced motion, extended timeouts

## Table of Contents

1. [Quick Start](#quick-start)
2. [One-Click Profiles](#one-click-profiles)
3. [Vision Features](#vision-features)
4. [Motor Accessibility](#motor-accessibility)
5. [Cognitive Support](#cognitive-support)
6. [Audio & Speech](#audio--speech)
7. [Keyboard Shortcuts](#keyboard-shortcuts)
8. [Developer Guide](#developer-guide)
9. [Component Reference](#component-reference)

---

## Quick Start

### Accessing Accessibility Settings

**Method 1: Floating Button**
- Look for the ♿ button in the bottom-left corner (draggable)
- Click to open quick menu or full settings panel

**Method 2: Keyboard Shortcut**
- Press `Alt + A` anywhere to open/close the accessibility panel

**Method 3: Quick Menu**
- The floating button shows a quick menu with common toggles:
  - Dark Mode
  - High Contrast
  - Large Text
  - Text-to-Speech

---

## One-Click Profiles

Apply optimized settings instantly with our accessibility profiles:

| Profile | Icon | What It Enables |
|---------|------|-----------------|
| **Low Vision** | 👓 | High contrast, 150% text, reading guide, enhanced focus |
| **Blind** | 🦯 | Screen reader optimized, text-to-speech, reduced motion |
| **Deaf** | 🦻 | Visual notifications only, captions, sign language info |
| **Motor Impaired** | 🖐️ | Large click targets (64px), dwell click, sticky keys |
| **Cognitive** | 🧠 | Simplified UI, focus mode, extended timeouts, reduced motion |

### Applying a Profile

1. Open the Accessibility Panel (`Alt + A`)
2. Click on a profile card
3. Settings are applied immediately
4. Customize further as needed

---

## Vision Features

### High Contrast Mode

Enables maximum contrast for better visibility:
- Pure black backgrounds
- Bright white text
- Thick, visible borders
- No subtle gradients or shadows

```css
/* Automatically applied */
body.high-contrast {
  background: #000 !important;
  color: #fff !important;
}
```

### Text Size Adjustment

Scale text from 100% to 200%:

| Setting | Size | Best For |
|---------|------|----------|
| 100% | Default | Normal vision |
| 125% | Large | Mild vision issues |
| 150% | Larger | Low vision |
| 175% | Very Large | Significant low vision |
| 200% | Maximum | Severe low vision |

### Color Blind Filters

We provide SVG-based color blind simulation and correction:

| Filter | Affects | Description |
|--------|---------|-------------|
| **Protanopia** | Red | Red-blind, no red cones |
| **Deuteranopia** | Green | Green-blind, no green cones |
| **Tritanopia** | Blue | Blue-blind, no blue cones |
| **Protanomaly** | Red | Weak red perception |
| **Deuteranomaly** | Green | Weak green perception |
| **Tritanomaly** | Blue | Weak blue perception |

### Reading Guide

A horizontal highlight bar that follows your mouse cursor:
- Helps track the current line while reading
- Customizable color and opacity
- Height adjusts based on text size setting

### Dyslexia-Friendly Font

Toggle OpenDyslexic font for easier reading:
- Weighted bottoms help anchor letters
- Unique letter shapes reduce confusion
- Applied site-wide when enabled

### Custom Colors

Personalize your experience:
- **Text Color**: Choose your preferred text color
- **Background Color**: Set a comfortable background
- **Link Color**: Make links stand out

---

## Motor Accessibility

### Dwell Click

**Click without clicking** - activate elements by hovering:

1. Enable in Accessibility Panel → Motor tab
2. Hover over any clickable element
3. A circular progress indicator appears
4. After the dwell time (configurable), click is triggered

**Settings:**
- Dwell Time: 500ms - 3000ms
- Works on buttons, links, and interactive elements

### Large Click Targets

Increase the size of clickable areas:

| Setting | Size | Description |
|---------|------|-------------|
| Normal | Default | Standard sizing |
| Large | 48px min | Easier to hit |
| Extra Large | 64px min | Maximum touch area |

### Sticky Keys Simulation

For users who cannot hold multiple keys:
- Modifier keys (Ctrl, Alt, Shift) stay "pressed"
- Helps with keyboard shortcuts
- Visual indicator shows active modifiers

### Full Keyboard Navigation

Navigate the entire site without a mouse:
- **Tab**: Move to next element
- **Shift + Tab**: Move to previous element
- **Enter/Space**: Activate buttons
- **Escape**: Close modals
- **Arrow keys**: Navigate menus

---

## Cognitive Support

### Simplified UI

Reduces visual complexity:
- Hides non-essential decorative elements
- Straightforward layouts
- Clear, consistent navigation

### Focus Mode

Highlights only the current task:
- Dims surrounding content
- Reduces distractions
- Centered attention on active area

### Reduced Motion

Disables animations and transitions:
- Respects `prefers-reduced-motion` by default
- Can be manually enabled
- Instant state changes

### Extended Timeouts

Gives more time for:
- Toast notifications (longer display)
- Session timeouts
- Auto-save delays
- Reading content

### Reading Speed

Adjusts text-to-speech rate for comfortable listening:
- Range: 50% to 200% of normal speed
- Useful for processing information

---

## Audio & Speech

### Text-to-Speech

Have any content read aloud:
- Uses Web Speech API
- Adjustable **speech rate** (0.5x - 2x)
- Adjustable **pitch** (0.5 - 2)
- Voice selection (system voices)

### Code-to-Natural-Language

**Revolutionary feature**: Translates code into plain English!

Example:
```solidity
function transfer(address to, uint256 amount) public returns (bool)
```

Becomes:
> "A public function called 'transfer' that takes an address named 'to' and a number named 'amount', and returns a boolean"

This makes code accessible to:
- Blind developers using screen readers
- Beginners learning to code
- Anyone who prefers natural language

### Screen Reader Optimization

- All dynamic content announced via ARIA live regions
- Proper heading hierarchy
- Descriptive link text
- Form field labels and descriptions

### Visual Captions

For deaf users:
- All audio cues have visual equivalents
- Toast notifications for status changes
- Visual indicators for connection states

---

## Keyboard Shortcuts

### Global Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt + A` | Open/close Accessibility Panel |
| `Tab` | Navigate forward |
| `Shift + Tab` | Navigate backward |
| `Escape` | Close modals/menus |
| `Enter` | Activate focused element |
| `Space` | Toggle buttons |

### Skip Links

Press `Tab` on page load to reveal skip links:
- **Skip to main content**
- **Skip to navigation**
- **Skip to search**

---

## Developer Guide

### Using the Accessibility Store

```tsx
import { useAccessibilityStore } from '@/stores/accessibilityStore';

function MyComponent() {
  const { 
    highContrast,
    textSize,
    textToSpeech,
    speak 
  } = useAccessibilityStore();
  
  // Read content aloud
  const handleSpeak = () => {
    if (textToSpeech) {
      speak('Hello, this is being read aloud!');
    }
  };
  
  return (
    <div style={{ fontSize: `${textSize}%` }}>
      <button onClick={handleSpeak}>Read Aloud</button>
    </div>
  );
}
```

### Announcing to Screen Readers

```tsx
import { useAnnouncer } from '@/components/Accessibility';

function MyComponent() {
  const { announce } = useAnnouncer();
  
  const handleSave = async () => {
    await saveData();
    // Announced to screen readers
    announce('Document saved successfully');
  };
  
  return <button onClick={handleSave}>Save</button>;
}
```

### Adding Accessible Components

#### Icon Buttons

```tsx
// ✅ Correct
<button aria-label="Close dialog">
  <X className="w-5 h-5" aria-hidden="true" />
</button>

// ❌ Wrong - no accessible name
<button>
  <X className="w-5 h-5" />
</button>
```

#### Modals

```tsx
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
  aria-describedby="modal-description"
>
  <h2 id="modal-title">Dialog Title</h2>
  <p id="modal-description">Description text</p>
</div>
```

#### Forms

```tsx
<div>
  <label htmlFor="email">Email</label>
  <input
    id="email"
    type="email"
    aria-required="true"
    aria-describedby="email-hint"
    autoComplete="email"
  />
  <p id="email-hint">We'll never share your email</p>
</div>
```

---

## Component Reference

### Core Components

| Component | File | Purpose |
|-----------|------|---------|
| `AccessibilityButton` | `Accessibility/AccessibilityButton.tsx` | Floating button + quick menu |
| `AccessibilityPanel` | `Accessibility/AccessibilityPanel.tsx` | Full settings panel |
| `SkipLinks` | `Accessibility/SkipLinks.tsx` | Skip navigation links |
| `AnnouncerProvider` | `Accessibility/Announcer.tsx` | Screen reader announcements |
| `DwellClick` | `Accessibility/DwellClick.tsx` | Click-by-hovering |
| `ReadingGuide` | `Accessibility/ReadingGuide.tsx` | Line highlighter |
| `ColorBlindFilters` | `Accessibility/ColorBlindFilters.tsx` | SVG color filters |

### Zustand Store

| Store | File | Purpose |
|-------|------|---------|
| `accessibilityStore` | `stores/accessibilityStore.ts` | All accessibility settings |

### CSS

| File | Purpose |
|------|---------|
| `styles/accessibility.css` | All accessibility styles |

### CSS Classes

| Class | Purpose |
|-------|---------|
| `.sr-only` | Visually hidden, screen reader accessible |
| `.skip-link` | Skip to content link |
| `.high-contrast` | High contrast mode styles |
| `.large-text` | Large text mode |
| `.dyslexic-font` | OpenDyslexic font |
| `.dwell-click-enabled` | Dwell click mode |
| `.reading-guide` | Reading guide line |

---

## Settings Persistence

All accessibility settings are **automatically saved** to localStorage and persist across sessions:

```typescript
// Settings auto-persist via Zustand persist middleware
const useAccessibilityStore = create(
  persist(
    (set, get) => ({
      // ... settings
    }),
    { name: 'accessibility-settings' }
  )
);
```

### Export/Import Settings

Users can export their settings as JSON and import them on other devices:

1. Open Accessibility Panel → Advanced tab
2. Click "Export Settings"
3. Save the JSON file
4. On another device: "Import Settings" and select the file

---

## Testing Accessibility

### Manual Testing

1. **Screen Reader**: Test with NVDA (Windows), VoiceOver (Mac), or Orca (Linux)
2. **Keyboard Only**: Navigate entire site without mouse
3. **Zoom**: Test at 200% and 400% browser zoom
4. **High Contrast**: Enable Windows High Contrast or macOS Increase Contrast
5. **Reduced Motion**: Enable in OS settings and verify animations stop

### Automated Testing

```bash
# Run accessibility audit
npm run test:a11y
```

### Browser Extensions

- [axe DevTools](https://www.deque.com/axe/devtools/)
- [WAVE](https://wave.webaim.org/extension/)
- [Accessibility Insights](https://accessibilityinsights.io/)

---

## Reporting Issues

Found an accessibility barrier? We take this seriously!

1. **GitHub Issues**: Open an issue with the `accessibility` label
2. **Include**:
   - Browser and version
   - Assistive technology used (if any)
   - Steps to reproduce
   - Expected vs actual behavior
3. **Priority**: Accessibility issues are treated as high priority

---

## Standards Compliance

| Standard | Level | Status |
|----------|-------|--------|
| WCAG 2.1 | AA | ✅ Compliant |
| WCAG 2.1 | AAA | ✅ Many criteria met |
| Section 508 | - | ✅ Compliant |
| EN 301 549 | - | ✅ Compliant |

---

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM](https://webaim.org/)
- [A11y Project](https://www.a11yproject.com/)
- [Inclusive Components](https://inclusive-components.design/)
- [Deque University](https://dequeuniversity.com/)

---

*Last updated: December 2025*
