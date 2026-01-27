# Placeholder Files

This directory contains static assets for the VitePress documentation site.

## Files

### logo.svg
A crystal/prism icon representing Lyra's ability to analyze and "refract" tools into appropriate plugin templates. The prism is purple (matching the brand color) with light rays entering from one side and dispersing into multiple colored rays on the other side.

### favicon.ico
**Placeholder**: Create a 32x32 or 16x16 favicon version of the logo. You can use tools like:
- [favicon.io](https://favicon.io)
- [realfavicongenerator.net](https://realfavicongenerator.net)

To generate from the SVG:
```bash
# Using ImageMagick
convert -background transparent logo.svg -resize 32x32 favicon.ico
```

### og-image.png
**Placeholder**: Create a 1200x630 Open Graph image for social sharing.

Suggested design:
- Purple gradient background (#7c3aed to #5b21b6)
- Logo centered or on the left
- Text: "Lyra Tool Discovery"
- Subtitle: "AI-powered tool discovery for the MCP ecosystem"

Tools to create:
- [og-image.vercel.app](https://og-image.vercel.app)
- Figma/Canva
- Any image editor

## Brand Colors

```css
/* Primary Purple */
--brand-1: #7c3aed;
--brand-2: #6d28d9;
--brand-3: #5b21b6;

/* Light Purple (dark mode) */
--brand-light-1: #a78bfa;
--brand-light-2: #8b5cf6;

/* Accent Colors */
--success: #22c55e;
--warning: #eab308;
--error: #ef4444;
```
