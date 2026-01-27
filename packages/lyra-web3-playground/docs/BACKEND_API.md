<!--
  ✨ built by nich
  🌐 GitHub: github.com/nirholas
  💫 Keep pushing boundaries 🚧
-->

# Backend Server API

Lyra Web3 Playground includes a powerful backend server that provides essential services for smart contract development.

## Features

### 1. Smart Contract Compilation

Compile Solidity contracts with multiple compiler versions:

```typescript
import { compileContract } from '@/services/api';

const result = await compileContract({
  code: solidityCode,
  version: '0.8.20',
  optimize: true
});

console.log(result.bytecode);
console.log(result.abi);
```

**Supported Versions:**
- 0.8.24
- 0.8.20
- 0.8.19
- 0.8.17
- 0.8.0
- 0.7.6
- 0.6.12

### 2. Contract Deployment

Deploy compiled contracts to testnets:

```typescript
import { deployContract } from '@/services/api';

const result = await deployContract({
  bytecode: compiledBytecode,
  abi: compiledAbi,
  network: 'sepolia',
  constructorArgs: ['Initial Supply', 1000000]
});

console.log('Deployed at:', result.address);
console.log('Explorer:', result.explorerUrl);
```

**Supported Networks:**
- Sepolia (Ethereum testnet)
- Mumbai (Polygon testnet)

### 3. AI Services

#### Generate Contracts from Natural Language

```typescript
import { generateContract } from '@/services/api';

const result = await generateContract({
  prompt: 'Create an ERC20 token with minting and burning'
});

console.log(result.code);
console.log(result.explanation);
```

#### Explain Code

```typescript
import { explainCode } from '@/services/api';

const result = await explainCode({
  code: solidityCode,
  question: 'What does this function do?'
});

console.log(result.explanation);
```

#### Generate Tests

```typescript
import { generateTests } from '@/services/api';

const result = await generateTests({
  code: solidityCode,
  framework: 'hardhat'
});

console.log(result.tests);
```

### 4. Testnet Faucet

Request testnet funds for development:

```typescript
import { requestFaucetFunds } from '@/services/api';

const result = await requestFaucetFunds({
  address: '0x...',
  network: 'sepolia'
});

console.log('Funded:', result.amount);
console.log('TX Hash:', result.transactionHash);
```

**Rate Limits:**
- 5 requests per 24 hours per IP address
- 0.1 ETH per request

### 5. IPFS Integration

Upload and pin files to IPFS:

```typescript
import { uploadToIPFS, pinToIPFS } from '@/services/api';

// Upload new content
const upload = await uploadToIPFS({
  content: JSON.stringify(nftMetadata),
  name: 'NFT Metadata',
  metadata: { type: 'nft' }
});

console.log('IPFS URL:', upload.url);
console.log('Gateway:', upload.gateway);

// Pin existing CID
const pin = await pinToIPFS({
  cid: 'QmXyz...',
  name: 'Important File'
});
```

## Rate Limits

To prevent abuse, the API enforces rate limits:

| Endpoint | Limit | Window |
|----------|-------|--------|
| General API | 100 requests | 15 minutes |
| Compilation/Deployment | 5 requests | 1 minute |
| AI Services | 20 requests | 1 hour |
| Faucet | 5 requests | 24 hours |

## Error Handling

All API calls return structured errors:

```typescript
try {
  const result = await compileContract({ code });
} catch (error) {
  console.error(error.message);
  // Handle specific errors:
  // - 'Compilation failed: ...'
  // - 'Rate limit exceeded'
  // - 'API request failed'
}
```

## Configuration

Set the API URL in your `.env`:

```env
VITE_API_URL=http://localhost:3001/api
```

For production, point to your deployed server:

```env
VITE_API_URL=https://api.yourplatform.com/api
```

## Server Setup

See [server/README.md](../server/README.md) for server installation and configuration.

## Security

- All sensitive operations use server-side API keys
- Rate limiting prevents abuse
- CORS configured for specific origins
- Input validation on all endpoints
- No client-side secrets exposed

## Examples

### Complete Workflow

```typescript
import {
  generateContract,
  compileContract,
  deployContract
} from '@/services/api';

// 1. Generate contract from AI
const generated = await generateContract({
  prompt: 'Create an ERC721 NFT with max supply'
});

// 2. Compile the generated code
const compiled = await compileContract({
  code: generated.code,
  version: '0.8.20'
});

// 3. Deploy to testnet
const deployed = await deployContract({
  bytecode: compiled.bytecode,
  abi: compiled.abi,
  network: 'sepolia'
});

console.log('Contract deployed at:', deployed.address);
console.log('View on explorer:', deployed.explorerUrl);
```

## Troubleshooting

### "API request failed"
- Check that the server is running
- Verify VITE_API_URL is correct
- Check network connectivity

### "Rate limit exceeded"
- Wait for the rate limit window to reset
- Reduce request frequency
- Consider implementing client-side caching

### "Service not configured"
- The requested service requires API keys
- Check server environment variables
- See server/README.md for configuration

## Support

For API issues or questions:
- Check server logs: `docker-compose logs server`
- Review [server/README.md](../server/README.md)
- Open an issue on GitHub
