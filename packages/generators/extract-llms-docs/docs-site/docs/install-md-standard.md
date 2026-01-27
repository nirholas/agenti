# The install.md Standard

Understanding the install.md standard for LLM-executable installation instructions.

---

## What is install.md?

The [install.md standard](https://installmd.org/) is a convention for providing installation instructions in a format designed for AI agents to execute autonomously.

Similar to how `llms.txt` provides documentation context for LLMs, `install.md` provides structured installation instructions that LLMs can follow step-by-step.

---

## Why install.md?

**The Problem:**

Traditional installation documentation is written for humans. It uses prose, assumes context, and often requires interpretation. AI agents need explicit, step-by-step instructions with clear success criteria.

**The Solution:**

install.md provides:

- **Clear objectives** - What the installation should achieve
- **Success criteria** - How to verify installation worked
- **TODO checklist** - Steps the agent should complete
- **Structured steps** - Detailed instructions with code blocks
- **Environment adaptation** - The LLM adapts to the user's setup

---

## File Location

| File | Location |
|------|----------|
| `/install.md` | Root of documentation or project |
| `/docs/install.md` | Documentation subdirectory |

---

## Format

install.md uses a specific format with keywords that guide LLM execution:

```markdown
# product-name

> Description of the product

I want you to install [Product] for me. Execute all the steps below autonomously.

OBJECTIVE: What the installation should achieve.

DONE WHEN: Specific verification criteria.

## TODO

- [ ] First step to complete
- [ ] Second step to complete
- [ ] Verify installation

## Prerequisites

Instructions for prerequisites...

```bash
node --version
```

## Install

Installation instructions...

```bash
npm install -g product-name
```

## Verify

Verification instructions...

```bash
product-name --version
```

EXECUTE NOW: Complete the above TODO list to achieve: [objective].
```

---

## Required Elements

| Element | Purpose |
|---------|---------|
| `# product-name` | H1 header with lowercase-hyphenated product name |
| `OBJECTIVE:` | What the installation should achieve |
| `DONE WHEN:` | Specific verification criteria |
| `## TODO` | Markdown checkbox list of steps |
| `EXECUTE NOW:` | Final call-to-action referencing TODO and objective |

---

## Optional Elements

| Element | Purpose |
|---------|---------|
| `> description` | Blockquote describing the product |
| Action prompt | "I want you to install..." instruction |
| Step sections | `## Prerequisites`, `## Install`, etc. |
| Code blocks | Commands in fenced code blocks |
| Platform variants | Multiple options for different environments |

---

## Usage

Users can pipe install.md directly to an AI agent:

```bash
# Using Claude
curl -fsSL https://docs.example.com/install.md | claude

# Using other AI tools
curl -fsSL https://docs.example.com/install.md | ai-agent
```

Or paste the contents into any LLM conversation.

---

## Relationship to llms.txt

| File | Purpose |
|------|---------|
| `llms.txt` | Helps LLMs **understand** your software |
| `install.md` | Tells LLMs **how to install** your software |

Your install.md can link to llms.txt for troubleshooting, configuration details, or additional context during installation.

---

## Best Practices

**1. Be Explicit**

Write for an agent that has no prior context. State exactly what needs to happen.

**2. Include Verification**

Every installation should have a way to verify success. Include commands that return expected output.

**3. Handle Alternatives**

Provide options for different package managers, operating systems, or configurations.

**4. Keep TODO Focused**

Each TODO item should be a clear, completable task.

**5. Use Code Blocks**

Always use fenced code blocks with language hints for commands.

---

## llm.energy Support

llm.energy automatically:

- **Detects** install.md at `/install.md` and `/docs/install.md`
- **Extracts** and includes it in your download bundle
- **Validates** the format and structure
- **Generates** install.md files with the wizard

---

## Learn More

- [installmd.org](https://installmd.org/) - Official specification
- [GitHub: mintlify/install-md](https://github.com/mintlify/install-md) - Open source spec
- [Mintlify Blog](https://www.mintlify.com/blog/install-md-standard-for-llm-executable-installation) - Announcement post
