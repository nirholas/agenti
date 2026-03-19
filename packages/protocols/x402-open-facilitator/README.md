<p align="center">
  <img src=".github/banner.png" alt="OpenFacilitator" width="100%" />
</p>

<p align="center">
  <strong>Deploy your own branded x402 payment facilitator in minutes.</strong>
</p>

<p align="center">
  <a href="https://opensource.org/licenses/Apache-2.0"><img src="https://img.shields.io/badge/License-Apache%202.0-blue.svg" alt="License" /></a>
  <a href="https://github.com/rawgroundbeef/openfacilitator"><img src="https://img.shields.io/github/stars/rawgroundbeef/openfacilitator?style=social" alt="GitHub stars" /></a>
</p>

<p align="center">
  <a href="https://openfacilitator.io">Website</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="https://openfacilitator.io/docs">Documentation</a> •
  <a href="#-contributing">Contributing</a>
</p>

---

OpenFacilitator is an open source platform that lets anyone deploy their own x402 payment facilitator. Self-host for free or use our managed service for instant setup.

## 🚀 Quick Start

### Self-Hosted (Free)

```bash
# Clone the repository
git clone https://github.com/rawgroundbeef/openfacilitator.git
cd openfacilitator

# Start with Docker
docker compose up -d
```

Your facilitator will be running at `http://localhost:3001`

### Managed Service

Visit [openfacilitator.io](https://openfacilitator.io) to deploy your own facilitator:
- **$5/mo**: Bring your own domain with auto-SSL

## 📦 Project Structure

```
openfacilitator/
├── apps/
│   └── dashboard/       # Next.js dashboard UI
├── packages/
│   ├── core/            # Facilitator logic (verify, settle, supported)
│   ├── server/          # Multi-tenant Express server
│   └── sdk/             # TypeScript SDK for integrating x402 payments
├── docker-compose.yml
├── LICENSE
└── README.md
```

## 🔐 Authentication

OpenFacilitator uses [Better Auth](https://better-auth.com) - a fully open source, self-contained authentication solution:

- **Email/Password** - Traditional signup and signin
- **Session Management** - Secure cookie-based sessions
- **SQLite/Postgres** - Works with the same database
- **Zero External Services** - No third-party auth providers needed

```typescript
import { betterAuth } from 'better-auth';

export const auth = betterAuth({
  database: db,
  emailAndPassword: { enabled: true }
});
```

## 🛠️ Development

### Prerequisites

- Node.js 20+
- pnpm 9+

### Setup

```bash
# Install dependencies
pnpm install

# Start development servers
pnpm dev
```

This starts:
- Dashboard: http://localhost:3002
- API Server: http://localhost:3001

### Building

```bash
# Build all packages
pnpm build

# Build specific package
pnpm turbo build --filter=@openfacilitator/server
```

## 📡 API Endpoints

### Facilitator Endpoints (x402-compatible)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/supported` | GET | List supported payment networks and tokens |
| `/verify` | POST | Verify a payment authorization |
| `/settle` | POST | Execute a payment settlement |
| `/discovery/resources` | GET | List available resources (products/links) |
| `/health` | GET | Health check |

### Auth Endpoints (Better Auth)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/sign-up/email` | POST | Create new account |
| `/api/auth/sign-in/email` | POST | Sign in with email/password |
| `/api/auth/sign-out` | POST | Sign out |
| `/api/auth/session` | GET | Get current session |

### Admin Endpoints (Protected)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/me` | GET | Get current user info |
| `/api/admin/facilitators` | GET | List user's facilitators |
| `/api/admin/facilitators` | POST | Create new facilitator |
| `/api/admin/facilitators/:id` | GET | Get facilitator details |
| `/api/admin/facilitators/:id` | PATCH | Update facilitator |
| `/api/admin/facilitators/:id` | DELETE | Delete facilitator |
| `/api/admin/facilitators/:id/export` | POST | Export self-host config |

### Example: Check Supported Networks

```bash
curl https://yourdomain.com/supported
```

```json
{
  "kinds": [
    {
      "x402Version": 1,
      "scheme": "exact",
      "network": "base"
    },
    {
      "x402Version": 2,
      "scheme": "exact",
      "network": "eip155:8453"
    }
  ]
}
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `HOST` | Server host | `0.0.0.0` |
| `DATABASE_PATH` | SQLite database path | `./data/openfacilitator.db` |
| `NODE_ENV` | Environment | `development` |

### Custom RPC Endpoints

```env
BASE_RPC_URL=https://mainnet.base.org
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
ETHEREUM_RPC_URL=https://eth.llamarpc.com
```

## 🚀 Deployment

### Option 1: Vercel + Railway (Recommended for Production)

**Dashboard on Vercel:**
```bash
# Deploy from the apps/dashboard directory
vercel --prod
```

**API Server on Railway:**
1. Connect your GitHub repo to Railway
2. Set the root directory to the repo root
3. Railway will detect the Dockerfile.server
4. Add a volume mounted at `/data` for the database
5. Set environment variables (see below)

**DNS Setup:**
- `openfacilitator.io` → Vercel
- `api.openfacilitator.io` → Railway
- `*.openfacilitator.io` → Railway (wildcard for tenant subdomains)
- `custom.openfacilitator.io` → Railway (CNAME target)

### Option 2: Docker Compose (Self-Hosted)

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

### Option 3: Docker Directly

```bash
# Build server image
docker build -f Dockerfile.server -t openfacilitator-server .

# Run server
docker run -d \
  -p 3001:3001 \
  -v openfacilitator-data:/data \
  openfacilitator-server
```

### Environment Variables

**Server (.env):**
```env
NODE_ENV=production
PORT=3001
HOST=0.0.0.0
DATABASE_PATH=/data/openfacilitator.db
BETTER_AUTH_SECRET=your-secret-key-min-32-chars
DASHBOARD_URL=https://dashboard.openfacilitator.io
```

**Dashboard:**
```env
NEXT_PUBLIC_API_URL=https://api.openfacilitator.io
```

## 🏗️ Architecture

OpenFacilitator uses a multi-tenant architecture:

```
                    ┌─────────────────────────────────────┐
                    │           Load Balancer             │
                    │    (subdomain/custom domain routing) │
                    └─────────────────────────────────────┘
                                      │
                    ┌─────────────────────────────────────┐
                    │        OpenFacilitator Server       │
                    │                                     │
                    │  ┌─────────┐  ┌─────────────────┐   │
                    │  │ Tenant  │  │   Facilitator   │   │
                    │  │Resolver │──│     Router      │   │
                    │  └─────────┘  └─────────────────┘   │
                    │                      │              │
                    │  ┌───────────────────▼───────────┐  │
                    │  │         Core Logic           │  │
                    │  │  (verify, settle, supported) │  │
                    │  └───────────────────────────────┘  │
                    │                      │              │
                    │  ┌───────────────────▼───────────┐  │
                    │  │      SQLite Database          │  │
                    │  │   (facilitators, transactions) │  │
                    │  └───────────────────────────────┘  │
                    └─────────────────────────────────────┘
```

## 🔐 Security

- **Key Management**: Private keys can be encrypted at rest or brought externally
- **Non-Custodial**: Keys never leave your infrastructure when self-hosting
- **SSL/TLS**: Auto-provisioned via Let's Encrypt for custom domains

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- [Website](https://openfacilitator.io)
- [Documentation](https://docs.openfacilitator.io)
- [x402 Protocol](https://x402.org)

---

Built with ❤️ for the x402 ecosystem

