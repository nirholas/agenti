# Self Hosting

Deploy llm.energy on your own infrastructure.

---

## Requirements

- Node.js 18+
- pnpm (recommended)

---

## Clone & Install

```bash
git clone https://github.com/nirholas/extract-llms-docs.git
cd extract-llms-docs
pnpm install
```

---

## Development

```bash
pnpm dev
```

Open [http://localhost:3001](http://localhost:3001)

---

## Production Build

```bash
pnpm build
pnpm start
```

---

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/nirholas/extract-llms-docs)

Or via CLI:

```bash
vercel --prod
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |

---

## MCP Server

To run the MCP server locally:

```bash
cd llms-forge/mcp-server
pnpm install
pnpm build
pnpm start
```
