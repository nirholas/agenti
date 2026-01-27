# Self Hosting

Deploy llm.energy on your own infrastructure.

---

## Requirements

- Node.js 18+
- pnpm (recommended)

---

## Clone & Install

```bash
git clone https://github.com/nirholas/lyra-tool-discovery.git
cd lyra-tool-discovery/llms-forge
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

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/nirholas/lyra-tool-discovery/tree/main/llms-forge)

Or via CLI:

```bash
cd llms-forge
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
