# Overview

How llm.energy works.

!!! tip "Quick Start"
    Visit [llm.energy](https://llm.energy) and enter any documentation URL to get started immediately!

---

## Supported Standards

llm.energy supports two complementary standards for LLM-friendly documentation:

### llms.txt Standard

Many documentation sites provide their content in a machine-readable format at `/llms.txt` or `/llms-full.txt`. This format is designed for AI consumption.

| Endpoint | Description |
|----------|-------------|
| `/llms.txt` | Concise version |
| `/llms-full.txt` | Complete documentation |

### install.md Standard

The [install.md standard](https://installmd.org/) provides structured installation instructions that LLMs can execute autonomously.

| Endpoint | Description |
|----------|-------------|
| `/install.md` | LLM-executable installation guide |
| `/docs/install.md` | Alternative location |

install.md files include:

- **OBJECTIVE**: What the installation should achieve
- **DONE WHEN**: Success criteria
- **TODO**: Checklist of tasks
- **Steps**: Detailed instructions with code blocks

---

## How It Works

```mermaid
flowchart LR
    A[Enter URL] --> B[Fetch llms.txt]
    B --> C[Fetch install.md]
    C --> D[Parse Content]
    D --> E[Generate Files]
    E --> F[Download]
```

### 1. Fetch

!!! example "Fetch Strategy"
    llm.energy intelligently searches multiple locations:
    
    1. `{url}/llms-full.txt` (complete documentation)
    2. Falls back to `{url}/llms.txt` if full version unavailable
    3. `{url}/install.md` (installation instructions)
    4. Also checks `/docs/install.md` and `docs.{domain}/install.md`

### 2. Parse

Content is split into sections based on markdown headers:

- `##` headers become document boundaries
- Each section becomes its own `.md` file
- Filenames are generated from section titles

!!! note "Smart Parsing"
    The parser preserves code blocks, tables, and formatting while intelligently splitting content.

### 3. Generate

Four types of output:

| File | Description |
|------|-------------|
| `*.md` | Individual section files |
| `llms-full.md` | Consolidated document with TOC |
| `AGENT-GUIDE.md` | Instructions for AI assistants |
| `install.md` | Installation instructions (if available) |

!!! success "Ready for AI"
    All output files are optimized for AI consumption with clear structure and metadata.

---

## Supported Sites

Any site that provides `/llms.txt` or `/llms-full.txt` will work:

- [modelcontextprotocol.io](https://modelcontextprotocol.io)
- [docs.anthropic.com](https://docs.anthropic.com)
- [docs.stripe.com](https://docs.stripe.com)
- And many more...
