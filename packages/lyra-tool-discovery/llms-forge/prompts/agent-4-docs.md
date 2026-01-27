# Agent 4: Documentation Site (Material for MkDocs)

You are a technical writer creating documentation for llms-forge using Material for MkDocs.

## Project Location
`/workspaces/lyra-tool-discovery/llms-forge`

## Your Mission
Create a comprehensive documentation site in a `docs-site/` subdirectory using Material for MkDocs.

## Directory Structure to Create
```
llms-forge/
  docs-site/
    mkdocs.yml
    requirements.txt
    docs/
      index.md
      getting-started.md
      how-it-works.md
      api-reference.md
      self-hosting.md
      faq.md
```

## Tasks

### 1. Create `docs-site/requirements.txt`
```
mkdocs-material>=9.0.0
```

### 2. Create `docs-site/mkdocs.yml`
```yaml
site_name: LLMs Forge
site_description: Extract documentation for AI agents from any site with llms.txt support
site_author: nich
site_url: https://llms-forge.vercel.app/docs

repo_name: nirholas/lyra-tool-discovery
repo_url: https://github.com/nirholas/lyra-tool-discovery

theme:
  name: material
  palette:
    scheme: slate
    primary: custom
    accent: custom
  features:
    - navigation.instant
    - navigation.tracking
    - navigation.sections
    - navigation.expand
    - toc.follow
    - content.code.copy
  icon:
    repo: fontawesome/brands/github

extra_css:
  - stylesheets/extra.css

nav:
  - Home: index.md
  - Getting Started: getting-started.md
  - How It Works: how-it-works.md
  - API Reference: api-reference.md
  - Self-Hosting: self-hosting.md
  - FAQ: faq.md

extra:
  social:
    - icon: fontawesome/brands/x-twitter
      link: https://x.com/nichxbt
      name: nich on X
    - icon: fontawesome/brands/github
      link: https://github.com/nirholas
      name: nich on GitHub

copyright: Created by nich
```

### 3. Create `docs-site/docs/stylesheets/extra.css`
```css
:root {
  --md-primary-fg-color: #00ff88;
  --md-accent-fg-color: #00d4ff;
}

[data-md-color-scheme="slate"] {
  --md-primary-fg-color: #00ff88;
  --md-accent-fg-color: #00d4ff;
}
```

### 4. Create `docs-site/docs/index.md`
```markdown
# LLMs Forge

**Extract documentation for AI agents from any site with llms.txt support.**

LLMs Forge is a free, open-source tool that fetches documentation from websites that support the llms.txt standard and organizes it into downloadable markdown files optimized for AI assistants.

## What You Get

When you extract documentation with LLMs Forge, you receive:

- **Individual markdown files** - Each documentation section as a separate file
- **llms-full.md** - Complete documentation in one consolidated file
- **AGENT-GUIDE.md** - Instructions for AI assistants on how to use the docs

## Quick Start

1. Visit [llms-forge.vercel.app](https://llms-forge.vercel.app)
2. Paste any documentation URL
3. Click Extract
4. Download your files

That's it. No sign-up required.

## What is llms.txt?

Many documentation sites now provide their content in a machine-readable format at `/llms.txt` or `/llms-full.txt`. This makes it easy for AI assistants to access and understand the documentation.

LLMs Forge simply makes this content more accessible and organized.

## Open Source

LLMs Forge is part of the [lyra-tool-discovery](https://github.com/nirholas/lyra-tool-discovery) project.

Created by [nich](https://x.com/nichxbt).
```

### 5. Create `docs-site/docs/getting-started.md`
```markdown
# Getting Started

## Using the Web App

### Step 1: Enter a URL

Paste any documentation site URL into the input field. For example:

- `https://docs.anthropic.com`
- `https://docs.stripe.com`
- `https://modelcontextprotocol.io`

### Step 2: Extract

Click the "Extract" button. LLMs Forge will:

1. Find the llms.txt or llms-full.txt file on the site
2. Parse the content into sections
3. Generate organized markdown files

This usually takes just a few seconds.

### Step 3: Download

Once extraction is complete, you can:

- **Download individual files** - Click the download icon next to any file
- **Download all as ZIP** - Get everything in one bundle

## Using the Downloaded Files

### With Claude

1. Start a new conversation
2. Upload the files (or paste the content of llms-full.md)
3. Ask questions about the documentation

### With ChatGPT

1. Start a new conversation
2. Upload the files to the conversation
3. Reference the documentation in your prompts

### With Other AI Assistants

The markdown files work with any AI assistant that accepts text or file uploads. The AGENT-GUIDE.md file contains specific instructions that help AI assistants understand the documentation structure.

## Tips

- **llms-full.md** is best for comprehensive context
- **Individual files** are better when you need specific sections
- **AGENT-GUIDE.md** helps AI assistants navigate the documentation

## Pro Tip

You can access llms.txt content directly by adding `/llms-full.txt` to most documentation URLs. LLMs Forge just makes it easier to organize and download.
```

### 6. Create `docs-site/docs/how-it-works.md`
```markdown
# How It Works

## The llms.txt Standard

Many modern documentation sites provide their content in a machine-readable format designed for AI consumption. This is typically available at:

- `/llms.txt` - Concise version
- `/llms-full.txt` - Complete documentation

These files contain markdown-formatted documentation that AI assistants can easily process.

## What LLMs Forge Does

### 1. Discovery

When you enter a URL, LLMs Forge attempts to fetch:

1. First: `{url}/llms-full.txt` (complete documentation)
2. Fallback: `{url}/llms.txt` (concise version)

### 2. Parsing

The raw content is parsed into sections based on markdown headers:

- `##` headers become individual document boundaries
- Each section becomes its own `.md` file
- Clean filenames are generated from section titles

### 3. Generation

LLMs Forge generates three types of output:

**Individual Files**
Each major section becomes a separate markdown file. For example, a "Getting Started" section becomes `getting-started.md`.

**llms-full.md**
A consolidated document containing all sections with a table of contents for easy navigation.

**AGENT-GUIDE.md**
A special file that contains:

- What the documentation covers
- List of all included files
- Instructions for AI assistants
- Recommended reading order
- Source URL for reference

### 4. Download

You can download:

- Individual files one at a time
- Everything bundled as a ZIP archive

## The "Secret"

Here's the thing: you can get llms.txt content directly by visiting the URL yourself. Just add `/llms-full.txt` to most documentation sites.

LLMs Forge adds value by:

- Automatically finding the right file
- Splitting content into organized sections
- Creating an agent-friendly guide
- Bundling everything for easy download

It's a simple tool that does a simple thing well.

## Supported Sites

Any site that provides `/llms.txt` or `/llms-full.txt` will work. This includes many popular documentation platforms and developer tools.
```

### 7. Create `docs-site/docs/api-reference.md`
```markdown
# API Reference

LLMs Forge exposes a simple API for programmatic access.

## Extract Endpoint

### `POST /api/extract`

Extracts documentation from a given URL.

**Request Body**

```json
{
  "url": "https://docs.example.com"
}
```

**Response**

```json
{
  "url": "https://docs.example.com",
  "sourceUrl": "https://docs.example.com/llms-full.txt",
  "rawContent": "...",
  "documents": [
    {
      "filename": "getting-started.md",
      "title": "Getting Started",
      "content": "...",
      "tokens": 1234
    }
  ],
  "fullDocument": {
    "filename": "llms-full.md",
    "title": "Complete Documentation",
    "content": "...",
    "tokens": 5678
  },
  "agentGuide": {
    "filename": "AGENT-GUIDE.md",
    "title": "Agent Guide",
    "content": "...",
    "tokens": 456
  },
  "stats": {
    "totalTokens": 7368,
    "documentCount": 5,
    "processingTime": 1234
  }
}
```

**Example with curl**

```bash
curl -X POST https://llms-forge.vercel.app/api/extract \
  -H "Content-Type: application/json" \
  -d '{"url": "https://docs.anthropic.com"}'
```

## Download Endpoint

### `POST /api/download`

Generates a ZIP file containing all documents.

**Request Body**

```json
{
  "documents": [...],
  "fullDocument": {...},
  "agentGuide": {...},
  "siteName": "example-docs"
}
```

**Response**

Binary ZIP file with `Content-Type: application/zip`.

## Error Handling

Errors return appropriate HTTP status codes:

- `400` - Invalid request (missing URL)
- `404` - No llms.txt found at the given URL
- `500` - Server error during extraction

Error response format:

```json
{
  "error": "Description of what went wrong"
}
```

## Rate Limits

The public API has reasonable rate limits to prevent abuse. For high-volume usage, consider self-hosting.
```

### 8. Create `docs-site/docs/self-hosting.md`
```markdown
# Self-Hosting

LLMs Forge is open source and can be self-hosted.

## Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

## Installation

```bash
# Clone the repository
git clone https://github.com/nirholas/lyra-tool-discovery.git
cd lyra-tool-discovery/llms-forge

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

The app will be available at `http://localhost:3001`.

## Production Build

```bash
# Build for production
pnpm build

# Start production server
pnpm start
```

## Deploy to Vercel

The easiest way to deploy is with Vercel:

1. Fork the repository
2. Connect to Vercel
3. Deploy

No environment variables are required.

## Deploy to Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

## Deploy with Docker

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

EXPOSE 3001
CMD ["pnpm", "start"]
```

Build and run:

```bash
docker build -t llms-forge .
docker run -p 3001:3001 llms-forge
```

## Configuration

LLMs Forge works out of the box with no configuration required. The port can be changed in `package.json` scripts.
```

### 9. Create `docs-site/docs/faq.md`
```markdown
# FAQ

## General

### What sites work with LLMs Forge?

Any site that provides `/llms.txt` or `/llms-full.txt` endpoints. This includes many modern documentation platforms.

### Is LLMs Forge free?

Yes, completely free and open source.

### Do I need to create an account?

No, just paste a URL and extract.

### Where is my data stored?

Nowhere. LLMs Forge doesn't store any extracted content. Everything is processed in your browser session.

## Technical

### What's the difference between llms.txt and llms-full.txt?

- `llms.txt` - Typically a concise summary of documentation
- `llms-full.txt` - Complete documentation content

LLMs Forge tries the full version first.

### Why does extraction fail for some sites?

The site may not support llms.txt, or the file may be at a different path. Some sites use different conventions.

### Can I use the API programmatically?

Yes, see the [API Reference](api-reference.md).

### How are tokens counted?

Token count is estimated as `character_count / 4`, which is a rough approximation for English text.

## Usage

### What's the best way to use the downloaded files?

- **For comprehensive context**: Use `llms-full.md`
- **For specific topics**: Use individual section files
- **For AI assistants**: Include `AGENT-GUIDE.md`

### Can I extract private documentation?

LLMs Forge only fetches publicly accessible URLs. It cannot access content that requires authentication.

### Why did you build this?

To make llms.txt content more accessible and organized for people working with AI assistants.

## About

### Who made this?

Created by [nich](https://x.com/nichxbt).

### Is this open source?

Yes, part of the [lyra-tool-discovery](https://github.com/nirholas/lyra-tool-discovery) project.

### How can I contribute?

Open an issue or pull request on GitHub.

### Wait, can't I just add /llms-full.txt to URLs myself?

Yes! That's the "secret." This tool just makes it easier to organize and download the content. We even tell you this after extraction.
```

### 10. Update package.json Scripts
Add these scripts to `llms-forge/package.json`:

```json
"docs:install": "pip install -r docs-site/requirements.txt",
"docs:dev": "cd docs-site && mkdocs serve",
"docs:build": "cd docs-site && mkdocs build"
```

## Files to Create
- `docs-site/mkdocs.yml`
- `docs-site/requirements.txt`
- `docs-site/docs/index.md`
- `docs-site/docs/getting-started.md`
- `docs-site/docs/how-it-works.md`
- `docs-site/docs/api-reference.md`
- `docs-site/docs/self-hosting.md`
- `docs-site/docs/faq.md`
- `docs-site/docs/stylesheets/extra.css`

## Quality Requirements
- Professional tone
- Clear, concise writing
- Proper markdown formatting
- No emojis
- Consistent styling with main site
- Accurate technical information

## Do Not
- Use emojis
- Over-explain simple concepts
- Include placeholder text
- Leave TODO comments
