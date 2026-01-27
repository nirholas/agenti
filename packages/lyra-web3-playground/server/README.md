<!--
  ✨ built by nich
  🌐 GitHub: github.com/nirholas
  💫 Passion fuels progress ⚡
-->

# Lyra Web3 Playground Server

Backend API server for the Lyra Web3 Playground platform. Provides compilation, deployment, AI, faucet, and IPFS services.

## Features

- **Smart Contract Compilation**: Compile Solidity contracts with multiple versions
- **Contract Deployment**: Deploy contracts to test networks  
- **AI Services**: Generate contracts, explain code, create tests
- **Testnet Faucet**: Fund addresses on Sepolia/Mumbai
- **IPFS Integration**: Upload and pin files to IPFS

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
cd server
npm install
```

### Configuration

Create a `.env` file in the server directory:

```env
# Server
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

# Blockchain
VITE_ALCHEMY_API_KEY=your_alchemy_key
VITE_INFURA_API_KEY=your_infura_key

# Faucet (optional)
FUNDER_PRIVATE_KEY=your_private_key_for_faucet

# AI Services (optional)
OPENAI_API_KEY=your_openai_key

# IPFS (optional)
PINATA_API_KEY=your_pinata_key
PINATA_SECRET_KEY=your_pinata_secret
```

### Development

```bash
npm run dev
```

Server will run on `http://localhost:3001`

### Production

```bash
npm run build
npm start
```

## API Endpoints

### Health Check
```
GET /health
```

### Compilation
```
POST /api/compile
Body: {
  code: string,
  version?: string,  // default: '0.8.20'
  optimize?: boolean // default: true
}
```

### Deployment
```
POST /api/deploy
Body: {
  bytecode: string,
  abi: array,
  network?: string,      // default: 'sepolia'
  constructorArgs?: array
}
```

### AI - Generate Contract
```
POST /api/ai/generate
Body: {
  prompt: string
}
```

### AI - Explain Code
```
POST /api/ai/explain
Body: {
  code: string,
  question?: string
}
```

### AI - Generate Tests
```
POST /api/ai/tests
Body: {
  code: string,
  framework?: string // default: 'hardhat'
}
```

### Faucet
```
POST /api/faucet/request
Body: {
  address: string,
  network?: string // default: 'sepolia'
}
```

### IPFS Upload
```
POST /api/ipfs/upload
Body: {
  content: string | buffer,
  name?: string,
  metadata?: object
}
```

### IPFS Pin
```
POST /api/ipfs/pin
Body: {
  cid: string,
  name?: string
}
```

## Rate Limits

- General API: 100 requests per 15 minutes
- Compilation/Deployment: 5 requests per minute
- AI Services: 20 requests per hour
- Faucet: 5 requests per 24 hours

## Security

- All sensitive operations require server-side API keys
- Rate limiting on all endpoints
- CORS configured for specific origins
- Helmet security headers
- Input validation with Zod schemas

## Docker

Build and run with Docker:

```bash
docker build -t lyra-web3-server .
docker run -p 3001:3001 --env-file .env lyra-web3-server
```

Or use docker-compose from the root directory:

```bash
docker-compose up server
```

## License

MIT
