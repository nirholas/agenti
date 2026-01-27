# Examples

Real-world examples of using llm.energy.

---

## Extracting Anthropic Docs

```bash
# Web App
https://llm.energy

# Enter URL
docs.anthropic.com
```

**Result:** 15+ markdown files covering Claude API, prompt engineering, and more.

---

## Extracting MCP Docs

```bash
# URL
modelcontextprotocol.io
```

**Result:** Complete MCP specification, server implementation guides, and client examples.

---

## Extracting Stripe Docs

```bash
# URL
docs.stripe.com
```

**Result:** API reference, integration guides, and webhook documentation.

---

## Using with Claude

1. Extract documentation using llm.energy
2. Download the ZIP archive
3. In Claude, start a new conversation
4. Upload `llms-full.md` or individual files
5. Ask questions about the documentation

**Example prompt:**

> "Based on the uploaded documentation, how do I implement streaming responses?"

---

## Using with ChatGPT

1. Extract documentation
2. Download files
3. Upload to ChatGPT (GPT-4 with file upload)
4. Reference the docs in your prompts

---

## Using the MCP Server

With the MCP server, AI assistants can extract docs programmatically:

**Claude Desktop**

```
You: "Extract the Vercel documentation and tell me about edge functions"

Claude: [Uses extract_documentation tool]
        [Reads relevant sections]
        "Based on the Vercel docs, edge functions are..."
```

**Example conversation:**

```
You: "What MCP tools do you have for documentation?"

Claude: "I have access to llm-energy with these tools:
        - extract_documentation: Extract docs from a URL
        - fetch_llms_txt: Get raw llms.txt content
        - get_document: Retrieve a cached document
        - list_documents: List all cached docs"

You: "Extract docs from docs.anthropic.com"

Claude: [Extracts and summarizes the documentation]
```

---

## Supported Sites

Sites known to have llms.txt support:

| Site | URL |
|------|-----|
| Anthropic | docs.anthropic.com |
| MCP | modelcontextprotocol.io |
| Stripe | docs.stripe.com |
| Vercel | vercel.com/docs |
| Supabase | supabase.com/docs |
| Mintlify | mintlify.com/docs |

!!! tip "Check any site"
    Try adding `/llms.txt` or `/llms-full.txt` to any documentation URL to see if it's supported.
