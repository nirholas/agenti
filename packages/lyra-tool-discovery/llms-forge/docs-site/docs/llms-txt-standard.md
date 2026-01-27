# The llms.txt Standard

Understanding the llms.txt standard for AI-readable documentation.

---

## What is llms.txt?

The [llms.txt standard](https://llmstxt.org/) is a convention for providing documentation in a format optimized for Large Language Models (LLMs).

Similar to how `robots.txt` tells search engines how to crawl a site, `llms.txt` provides AI assistants with structured documentation.

---

## File Locations

| File | Purpose |
|------|---------|
| `/llms.txt` | Concise overview and key information |
| `/llms-full.txt` | Complete documentation |

---

## Format

llms.txt files are plain markdown:

```markdown
# Project Name

> Brief description

## Section 1

Content...

## Section 2

Content...
```

---

## Why It Matters

**For AI Assistants:**

- Structured content that's easy to parse
- No HTML/CSS/JS to filter out
- Complete documentation in one request

**For Developers:**

- AI assistants give better answers about your product
- Reduces hallucination by providing accurate source material
- One source of truth for AI-consumed docs

---

## Adoption

Sites with llms.txt support include:

- [Anthropic](https://docs.anthropic.com)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [Stripe](https://docs.stripe.com)
- [Vercel](https://vercel.com/docs)
- [Mintlify](https://mintlify.com/docs)

---

## Adding llms.txt to Your Site

**Option 1: Manual**

Create `/public/llms.txt` or `/public/llms-full.txt` with your documentation in markdown format.

**Option 2: Automated**

Documentation platforms like Mintlify automatically generate llms.txt from your docs.

**Best Practices:**

- Include all essential documentation
- Use clear markdown headers
- Keep content up to date with your main docs
- Provide both concise (`llms.txt`) and full (`llms-full.txt`) versions

---

## Learn More

- [llmstxt.org](https://llmstxt.org/) - Official standard
- [Anthropic's llms.txt](https://docs.anthropic.com/llms-full.txt) - Example implementation
