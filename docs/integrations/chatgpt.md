# ChatGPT Integration

Guide for using Agenti with ChatGPT Developer Mode via HTTP transport.

## Overview

ChatGPT supports external tool servers via HTTP. Agenti's HTTP mode provides a compatible endpoint for ChatGPT Developer Mode.

## Setup

### 1. Start Agenti in HTTP Mode

```bash
npx @nirholas/agenti --http
```

This starts the server at `http://localhost:3000`.

### 2. Expose to Internet

For ChatGPT to access your server, it needs a public URL. Options:

#### ngrok (Development)
```bash
ngrok http 3000
```
Provides a temporary public URL like `https://abc123.ngrok.io`.

#### Cloud Deployment (Production)
Deploy to Railway, Render, Fly.io, or any cloud provider with a public URL.

### 3. Configure ChatGPT

In ChatGPT Developer Mode, configure your tool server with the public URL endpoint.

## Server Configuration

```env
# Server
PORT=3000
HOST=0.0.0.0

# Security (recommended for public endpoints)
AUTH_TOKEN=your_secret_token
CORS_ORIGINS=https://chat.openai.com
RATE_LIMIT_MAX=60
RATE_LIMIT_WINDOW=60000

# Wallet
PRIVATE_KEY=0x...
```

## API Endpoint

ChatGPT will send requests to:

```
POST https://your-server.com/mcp
Content-Type: application/json
Authorization: Bearer your_secret_token

{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "market_data_price",
    "arguments": { "coinId": "bitcoin" }
  },
  "id": 1
}
```

## Security Considerations

When exposing Agenti to the internet:

1. **Always use AUTH_TOKEN** - Prevents unauthorized access
2. **Restrict CORS** - Limit to ChatGPT's origin
3. **Enable rate limiting** - Prevent abuse
4. **Use HTTPS** - Encrypt traffic (ngrok provides this automatically)
5. **Limit wallet funds** - Only keep what's needed for operations
6. **Monitor logs** - Watch for unusual activity
7. **Set X402_MAX_PAYMENT** - Cap autonomous payment amounts

## Limitations

- HTTP mode is stateless (no persistent sessions)
- Higher latency than stdio mode
- Requires public URL exposure
- ChatGPT Developer Mode availability may vary

## Troubleshooting

### ChatGPT can't reach server
- Verify public URL is accessible: `curl https://your-url.com/health`
- Check firewall/security group rules
- Ensure CORS allows ChatGPT's origin

### Authentication errors
- Verify AUTH_TOKEN matches in both server and ChatGPT config
- Check Bearer token format in headers

### Timeout errors
- Increase server timeout for slow blockchain operations
- Use a deployment region close to OpenAI's servers
