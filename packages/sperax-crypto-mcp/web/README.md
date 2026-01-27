# Sperax MCP Web

**[mcp.sperax.io](https://mcp.sperax.io)** — Web interface for Sperax MCP Server configuration and documentation.

## Features

- 🪙 **Sperax DeFi Gateway** — AI access to USDs, veSPA, Demeter farms, Vault
- 📊 **54 Tools** — Comprehensive coverage of Sperax protocol
- 🌙 **Dark/Light Mode** — Toggle between themes
- ⚡ **Arbitrum One** — Native support for Sperax chain
- 📖 **Documentation** — Protocol docs and MCP usage guides
- 🔗 **Quick Setup** — One-click configuration for Claude Desktop & Cursor

## Tech Stack

- **Next.js 16** (App Router, Turbopack)
- **Tailwind CSS v4** + **shadcn/ui**
- **RainbowKit** + **wagmi** + **viem** (wallet connection)
- **next-themes** (dark/light mode)
- **sonner** (toast notifications)

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/
├── app/
│   ├── api/            # API routes
│   ├── layout.tsx      # Root layout with Toaster
│   └── page.tsx        # Main UI
├── components/
│   ├── providers.tsx   # Theme + Wallet providers
│   └── ui/             # shadcn/ui components
└── lib/
    ├── generator.ts    # Configuration generator
    ├── networks.ts     # Arbitrum chain config
    └── utils.ts        # Utility functions
```

## Deployment

Deploy to Vercel:

```bash
npm run build
vercel --prod
```

Or set up automatic deployments from the `main` branch.

## Links

- [Sperax Protocol](https://sperax.io)
- [Protocol Docs](https://docs.sperax.io)
- [Sperax App](https://app.sperax.io)
- [GitHub](https://github.com/Sperax)

## License

MIT — see [LICENSE](../LICENSE).
