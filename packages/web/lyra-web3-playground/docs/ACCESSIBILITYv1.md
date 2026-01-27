<!--
  ✨ built by nich
  🌐 GitHub: github.com/nirholas
  💫 Technology for everyone ♿
-->

# Accessibility Documentation

Lyra Web3 Playground is committed to being accessible to all users, including those who are blind, deaf, or have other disabilities. This document outlines our accessibility features and how to use them.

## Overview

We follow **WCAG 2.1 Level AA** guidelines and implement features for:
- **Blind users** - Full screen reader support
- **Deaf users** - Visual feedback for all audio cues
- **Motor impairments** - Full keyboard navigation
- **Cognitive disabilities** - Clear layouts and reduced motion options

## Table of Contents

1. [Screen Reader Support](#screen-reader-support)
2. [Visual Feedback System](#visual-feedback-system)
3. [Keyboard Navigation](#keyboard-navigation)
4. [Reduced Motion](#reduced-motion)
5. [High Contrast Mode](#high-contrast-mode)
6. [Developer Guide](#developer-guide)

---

## Screen Reader Support

### Skip Link

A skip link appears when users press `Tab` on page load, allowing them to bypass the navigation and jump directly to main content.

```
[Tab] → "Skip to main content" link appears
[Enter] → Focus moves to main content
```

### ARIA Landmarks

The site uses semantic HTML and ARIA landmarks for easy navigation:

| Landmark | Description |
|----------|-------------|
| `<nav role="navigation">` | Main navigation and mobile nav |
| `<main role="main">` | Primary page content |
| `<footer role="contentinfo">` | Footer with links and info |
| `role="dialog"` | Modal dialogs (wallet, auth) |

### Live Announcements

Dynamic content changes are announced to screen readers using ARIA live regions:

- **Polite announcements** - Non-urgent updates (e.g., "File saved")
- **Assertive announcements** - Important alerts (e.g., "Error: Transaction failed")

### Form Accessibility

All forms include:
- `<label>` elements properly associated with inputs via `htmlFor`
- `aria-required="true"` for required fields
- `aria-describedby` linking inputs to help text
- `role="alert"` for error messages
- Proper `autocomplete` attributes

---

## Visual Feedback System

For deaf users and anyone who may miss audio cues, we provide comprehensive visual feedback.

### Toast Notifications

All status updates display as toast notifications in the top-right corner:

| Type | Color | Icon | Use Case |
|------|-------|------|----------|
| Success | Green | ✓ | Successful actions |
| Error | Red | ✕ | Failed operations |
| Warning | Yellow | ⚠ | Caution notices |
| Info | Blue | ℹ | General information |

### Status Indicators

Visual indicators show connection and loading states:

```css
/* Connected state - pulsing green dot */
.status-indicator.status-success.status-active

/* Error state - static red dot */
.status-indicator.status-error

/* Loading state - animated progress bar */
.loading-indicator
```

### Wallet Connection Status

The wallet button and mobile nav show visual indicators:
- **Not connected**: Gray icon
- **Connected**: Green icon with pulsing dot

---

## Keyboard Navigation

### Focus Management

All interactive elements are keyboard accessible with visible focus indicators:
- **Focus outline**: 3px solid blue (#0284c7)
- **Dark mode**: Lighter blue (#38bdf8)
- **Offset**: 2px for visibility

### Navigation Shortcuts

| Key | Action |
|-----|--------|
| `Tab` | Move to next interactive element |
| `Shift + Tab` | Move to previous element |
| `Enter` | Activate buttons/links |
| `Space` | Toggle buttons |
| `Escape` | Close modals |

### Mobile Menu

The mobile menu is fully keyboard accessible:
1. `Tab` to hamburger menu button
2. `Enter` to open menu
3. `Tab` through menu items
4. `Escape` to close

---

## Reduced Motion

Users who prefer reduced motion (set in OS preferences) will experience:
- No animations
- No transitions
- Instant state changes
- Static status indicators

This is detected via:
```css
@media (prefers-reduced-motion: reduce) {
  /* All animations disabled */
}
```

---

## High Contrast Mode

For users with `prefers-contrast: high` enabled:
- Thicker borders (2px)
- Underlined links
- Improved text contrast
- Bolder visual separation

---

## Developer Guide

### Using the Feedback System

Import and use the unified feedback hook for accessible notifications:

```tsx
import { useFeedback } from '@/components/Accessibility';

function MyComponent() {
  const { success, error, info, warning } = useFeedback();
  
  const handleSave = async () => {
    try {
      await saveData();
      // Announces to screen readers AND shows visual toast
      success('Data saved successfully!');
    } catch (e) {
      // Assertive announcement + red toast
      error('Failed to save data');
    }
  };
  
  return <button onClick={handleSave}>Save</button>;
}
```

### Available Hooks

#### `useFeedback()`

Combined hook for screen reader + visual feedback:

```tsx
const { notify, success, error, info, warning } = useFeedback();

// Full control
notify('Message', 'success', {
  announceToScreenReader: true,
  showVisualToast: true,
  toastDuration: 5000,
  priority: 'polite'
});

// Convenience methods
success('Saved!');
error('Failed!');  // Uses assertive priority
info('FYI...');
warning('Careful!');
```

#### `useAnnounce()`

Screen reader only announcements:

```tsx
import { useAnnounce } from '@/components/Accessibility';

const { announce } = useAnnounce();

announce('Page loaded', 'polite');
announce('Critical error!', 'assertive');
```

#### `useVisualFeedback()`

Visual toast only:

```tsx
import { useVisualFeedback } from '@/components/Accessibility';

const { showToast } = useVisualFeedback();

showToast('Hello!', 'info', 3000);
```

### Adding ARIA to Components

#### Icon Buttons

```tsx
// ✓ Correct - icon button with label
<button aria-label="Close dialog">
  <X className="w-5 h-5" aria-hidden="true" />
</button>

// ✗ Wrong - no accessible name
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

#### Status Updates

```tsx
// For errors
<div role="alert" aria-live="assertive">
  {error}
</div>

// For status updates
<div role="status" aria-live="polite">
  {status}
</div>
```

### CSS Utilities

#### Screen Reader Only

```tsx
<span className="sr-only">Opens in new tab</span>
```

#### Status Indicators

```tsx
<span className="status-indicator status-success status-active">
  Connected
</span>
```

#### Skip Link (auto-included)

The `<SkipLink />` component is already included in `App.tsx`.

---

## Component Reference

### Accessibility Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `SkipLink` | `Accessibility/SkipLink.tsx` | Skip to main content |
| `LiveAnnouncerProvider` | `Accessibility/LiveAnnouncer.tsx` | Screen reader announcements |
| `VisualFeedbackProvider` | `Accessibility/VisualFeedback.tsx` | Toast notifications |

### CSS Classes

| Class | Purpose |
|-------|---------|
| `.sr-only` | Visually hidden, screen reader accessible |
| `.skip-link` | Skip to content link |
| `.status-indicator` | Visual status dot |
| `.loading-indicator` | Loading progress bar |

---

## Testing Accessibility

### Manual Testing

1. **Screen Reader**: Test with NVDA (Windows), VoiceOver (Mac), or Orca (Linux)
2. **Keyboard**: Navigate entire site using only keyboard
3. **Zoom**: Test at 200% and 400% zoom levels
4. **Contrast**: Test with high contrast mode enabled
5. **Motion**: Test with `prefers-reduced-motion` enabled

### Automated Testing

```bash
# Run accessibility audit
npm run test:a11y

# Or use browser DevTools
# Chrome: Lighthouse > Accessibility
# Firefox: Accessibility Inspector
```

### Browser Extensions

- [axe DevTools](https://www.deque.com/axe/devtools/)
- [WAVE](https://wave.webaim.org/extension/)
- [Accessibility Insights](https://accessibilityinsights.io/)

---

## Reporting Issues

Found an accessibility issue? Please report it:

1. **GitHub Issues**: Open an issue with the `accessibility` label
2. **Include**: Browser, screen reader (if applicable), steps to reproduce

We take accessibility issues seriously and prioritize fixes.

---

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM](https://webaim.org/)
- [A11y Project](https://www.a11yproject.com/)

---

*Last updated: December 2025*
