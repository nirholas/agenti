# x402 AWS Enterprise Demo - API Documentation

This document provides comprehensive API documentation for the x402 payment-gated content delivery system.

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Seller API (CloudFront + Lambda@Edge)](#seller-api-cloudfront--lambdaedge)
  - [Protected Content Endpoints](#protected-content-endpoints)
  - [Request/Response Flow](#requestresponse-flow)
  - [x402 Protocol Headers](#x402-protocol-headers)
  - [Error Responses](#error-responses)
- [Payer Agent API (AgentCore Runtime)](#payer-agent-api-agentcore-runtime)
  - [Agent Invocation](#agent-invocation)
  - [Agent Tools](#agent-tools)
- [Gateway Target Configuration](#gateway-target-configuration)
  - [Overview](#gateway-target-overview)
  - [Target Types](#target-types)
  - [OpenAPI Target Configuration](#openapi-target-configuration)
  - [MCP Tool Mapping](#mcp-tool-mapping)
  - [x402 Header Passthrough](#x402-header-passthrough)
  - [Configuration Reference](#configuration-reference)
- [MCP Tool Schemas](#mcp-tool-schemas)
  - [Tool Discovery](#tool-discovery)
  - [get_premium_article](#get_premium_article)
  - [get_weather_data](#get_weather_data)
  - [get_market_analysis](#get_market_analysis)
  - [get_research_report](#get_research_report)
  - [Common Error Schemas](#common-error-schemas)
  - [MCP Tool Invocation](#mcp-tool-invocation)
- [Data Types](#data-types)

---

## Overview

The x402 AWS Enterprise Demo consists of two main API surfaces:

1. **Seller API**: CloudFront distribution with Lambda@Edge that serves payment-gated content using the x402 v2 protocol
2. **Payer Agent API**: AgentCore Runtime that provides access to the AI agent for automated payment decisions

### Base URLs

| Component | URL Pattern | Description |
|-----------|-------------|-------------|
| Seller API | `https://{distribution-id}.cloudfront.net` | CloudFront distribution URL |
| AgentCore Runtime | `https://bedrock-agentcore.{region}.amazonaws.com` | AWS Bedrock AgentCore Runtime |

---

## Authentication

### Seller API

The Seller API uses the **x402 v2 payment protocol** for authentication:

- **Initial Request**: No authentication required (returns 402 if payment needed)
- **Paid Request**: Include `X-PAYMENT-SIGNATURE` header with base64-encoded payment payload

### AgentCore Runtime

The AgentCore Runtime uses **AWS IAM SigV4** authentication:

```bash
# Example using AWS CLI credentials
aws bedrock-agentcore invoke-agent-runtime \
  --agent-runtime-arn <AGENT_RUNTIME_ARN> \
  --runtime-session-id <SESSION_ID> \
  --payload '{"prompt": "Check my wallet balance"}'
```

Required IAM permission: `bedrock-agentcore:InvokeAgentRuntime`

---

## Seller API (CloudFront + Lambda@Edge)

### Protected Content Endpoints

All endpoints return JSON content and require x402 payment for access.

#### GET /api/premium-article

Premium article content about AI and blockchain integration.

| Property | Value |
|----------|-------|
| Price | 0.001 USDC (1000 atomic units) |
| Content Type | `application/json` |
| Source | Inline (static) |

**Response (200 OK with valid payment):**
```json
{
  "title": "The Future of AI and Blockchain Integration",
  "author": "Tech Insights",
  "date": "2026-01-22",
  "content": "Artificial Intelligence and Blockchain are converging...",
  "fullText": "This is premium content that requires payment to access...",
  "tags": ["AI", "blockchain", "technology", "innovation"]
}
```

---

#### GET /api/weather-data

Real-time weather data with current conditions and 5-day forecast.

| Property | Value |
|----------|-------|
| Price | 0.0005 USDC (500 atomic units) |
| Content Type | `application/json` |
| Source | Dynamic (generated per request) |

**Response (200 OK with valid payment):**
```json
{
  "location": "San Francisco, CA",
  "timestamp": "2026-01-22T15:30:00.000Z",
  "current": {
    "temperature": 62,
    "temperatureUnit": "F",
    "conditions": "Partly Cloudy",
    "humidity": 55,
    "windSpeed": 12,
    "windUnit": "mph",
    "uvIndex": 4
  },
  "forecast": [
    {
      "day": "Fri",
      "conditions": "Sunny",
      "high": 68,
      "low": 52
    }
  ],
  "source": "x402-weather-service",
  "premium": true
}
```

---

#### GET /api/market-analysis

Cryptocurrency market analysis with real-time data.

| Property | Value |
|----------|-------|
| Price | 0.002 USDC (2000 atomic units) |
| Content Type | `application/json` |
| Source | Dynamic (generated per request) |

**Response (200 OK with valid payment):**
```json
{
  "timestamp": "2026-01-22T15:30:00.000Z",
  "date": "2026-01-22",
  "markets": {
    "BTC": {
      "name": "Bitcoin",
      "price": "98500.00",
      "change24h": "+2.35%",
      "volume24h": "25.5B",
      "marketCap": "1920750M"
    },
    "ETH": {
      "name": "Ethereum",
      "price": "3850.00",
      "change24h": "+1.82%",
      "volume24h": "18.2B",
      "marketCap": "462000M"
    }
  },
  "analysis": {
    "overallSentiment": "Bullish",
    "summary": "Market showing mixed signals...",
    "keyEvents": [
      "Federal Reserve meeting scheduled for next week",
      "Major protocol upgrade announced for Ethereum"
    ],
    "riskLevel": "Medium"
  },
  "source": "x402-market-service",
  "premium": true
}
```

---

#### GET /api/research-report

In-depth blockchain research report (stored in S3).

| Property | Value |
|----------|-------|
| Price | 0.005 USDC (5000 atomic units) |
| Content Type | `application/json` |
| Source | S3 bucket |

**Response (200 OK with valid payment):**
```json
{
  "title": "Blockchain Technology Trends 2026",
  "author": "Research Team",
  "publishDate": "2026-01-15",
  "sections": [
    {
      "title": "Executive Summary",
      "content": "..."
    }
  ],
  "premium": true
}
```

---

#### GET /api/dataset

Premium machine learning dataset.

| Property | Value |
|----------|-------|
| Price | 0.01 USDC (10000 atomic units) |
| Content Type | `application/json` |
| Source | S3 bucket |

**Response (200 OK with valid payment):**
```json
{
  "name": "Blockchain Transaction Dataset",
  "version": "1.0",
  "records": 10000,
  "features": ["timestamp", "from", "to", "value", "gas"],
  "data": [...]
}
```

---

#### GET /api/tutorial

Advanced smart contract development tutorial.

| Property | Value |
|----------|-------|
| Price | 0.003 USDC (3000 atomic units) |
| Content Type | `application/json` |
| Source | S3 bucket |

**Response (200 OK with valid payment):**
```json
{
  "title": "Advanced Smart Contract Development",
  "difficulty": "Advanced",
  "estimatedTime": "2 hours",
  "chapters": [
    {
      "title": "Introduction to EIP-3009",
      "content": "..."
    }
  ]
}
```

---

### Request/Response Flow

#### 1. Initial Request (No Payment)

```http
GET /api/premium-article HTTP/1.1
Host: d1234567890.cloudfront.net
Accept: application/json
```

**Response:**
```http
HTTP/1.1 402 Payment Required
Content-Type: application/json
X-PAYMENT-REQUIRED: <base64-encoded-payment-requirements>
Access-Control-Allow-Origin: *
Access-Control-Expose-Headers: X-PAYMENT-REQUIRED, X-PAYMENT-RESPONSE

{
  "error": "Payment Required",
  "message": "This content requires payment to access",
  "x402Version": 2
}
```

#### 2. Request with Payment

```http
GET /api/premium-article HTTP/1.1
Host: d1234567890.cloudfront.net
Accept: application/json
X-PAYMENT-SIGNATURE: <base64-encoded-payment-payload>
```

**Response (Success):**
```http
HTTP/1.1 200 OK
Content-Type: application/json
X-PAYMENT-RESPONSE: <base64-encoded-settlement-response>
X-Request-Id: req_abc123_xyz789
Access-Control-Allow-Origin: *

{
  "title": "The Future of AI and Blockchain Integration",
  ...
}
```

---

### x402 Protocol Headers

#### X-PAYMENT-REQUIRED (Response Header)

Base64-encoded JSON containing payment requirements:

```json
{
  "x402Version": 2,
  "error": "Payment required to access this resource",
  "resource": {
    "url": "/api/premium-article",
    "description": "Protected resource at /api/premium-article",
    "mimeType": "application/json"
  },
  "accepts": [
    {
      "scheme": "exact",
      "network": "eip155:84532",
      "amount": "1000",
      "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      "payTo": "<SELLER_WALLET_ADDRESS>",
      "maxTimeoutSeconds": 60,
      "extra": {
        "name": "USDC",
        "version": "2",
        "assetTransferMethod": "eip3009"
      }
    }
  ],
  "extensions": {}
}
```

#### X-PAYMENT-SIGNATURE (Request Header)

Base64-encoded JSON containing the signed payment:

```json
{
  "x402Version": 2,
  "accepted": {
    "scheme": "exact",
    "network": "eip155:84532",
    "amount": "1000",
    "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    "payTo": "<SELLER_WALLET_ADDRESS>",
    "maxTimeoutSeconds": 60
  },
  "payload": {
    "signature": "0x...",
    "authorization": {
      "from": "0x...",
      "to": "<SELLER_WALLET_ADDRESS>",
      "value": "1000",
      "validAfter": "0",
      "validBefore": "1737561600",
      "nonce": "0x..."
    }
  }
}
```

#### X-PAYMENT-RESPONSE (Response Header)

Base64-encoded JSON containing settlement confirmation:

```json
{
  "success": true,
  "transaction": "0x1234567890abcdef...",
  "network": "eip155:84532",
  "payer": "0x..."
}
```

---

### Error Responses

#### 400 Bad Request

Invalid payment payload structure:

```json
{
  "error": "Invalid Payment",
  "message": "Payment payload structure is invalid"
}
```

#### 402 Payment Required

Payment validation failed:

```json
{
  "error": "Payment Required",
  "message": "This content requires payment to access",
  "x402Version": 2
}
```

Common validation errors in the `X-PAYMENT-REQUIRED` header:
- `scheme_mismatch` - Payment scheme doesn't match requirements
- `network_mismatch` - Wrong blockchain network
- `invalid_exact_evm_payload_recipient_mismatch` - Wrong recipient address
- `invalid_exact_evm_payload_authorization_value` - Insufficient payment amount
- `invalid_exact_evm_payload_authorization_valid_before` - Payment expired
- `invalid_signature_format` - Invalid signature format
- `asset_mismatch` - Wrong payment asset

#### 500 Internal Server Error

```json
{
  "error": "Payment Processing Error",
  "message": "Failed to process payment"
}
```

---

## Payer Agent API (AgentCore Runtime)

### Agent Invocation

The payer agent is invoked through AWS Bedrock AgentCore Runtime using the `invoke_agent_runtime` API.

#### Endpoint

```
POST https://bedrock-agentcore.{region}.amazonaws.com/agentRuntimes/{agentRuntimeArn}/invoke
```

#### Request

```json
{
  "runtimeSessionId": "<session-id>",
  "payload": "{\"prompt\": \"Get me the premium article at /api/premium-article\"}"
}
```

#### Response (Streaming)

The response is streamed as chunks:

```json
{
  "completion": [
    {
      "chunk": {
        "bytes": "I'll help you get the premium article..."
      }
    }
  ]
}
```

### Agent Tools

The payer agent exposes the following tools:

#### get_wallet_balance

Check the current wallet balance.

**Returns:**
```json
{
  "success": true,
  "address": "0x...",
  "network": "base-sepolia",
  "balance": "0.05",
  "balance_wei": "50000000000000000",
  "currency": "ETH"
}
```

---

#### analyze_payment

Analyze a payment request and decide whether to approve it.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| amount | string | Payment amount (e.g., "0.001") |
| currency | string | Currency (e.g., "ETH", "USDC") |
| recipient | string | Recipient wallet address |
| description | string | Description of purchase |
| wallet_balance | string | Current wallet balance |

**Returns:**
```json
{
  "should_pay": true,
  "reasoning": "Payment of 0.001 USDC for 'premium article' is reasonable and within budget",
  "risk_level": "low"
}
```

---

#### sign_payment

Sign a payment using the AgentKit wallet (EIP-3009).

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| scheme | string | Payment scheme (e.g., "exact") |
| network | string | Blockchain network (e.g., "base-sepolia") |
| amount | string | Payment amount |
| recipient | string | Recipient wallet address |

**Returns:**
```json
{
  "success": true,
  "payload": {
    "scheme": "exact",
    "network": "base-sepolia",
    "signature": "0x...",
    "from": "0x...",
    "to": "0x...",
    "amount": "1000",
    "timestamp": 1737561600000
  }
}
```

---

#### request_content

Request content from the seller API (may return 402).

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| url | string | Content URL path (e.g., "/api/premium-article") |

**Returns (200):**
```json
{
  "status": 200,
  "content": { ... }
}
```

**Returns (402):**
```json
{
  "status": 402,
  "payment_required": {
    "scheme": "exact",
    "network": "eip155:84532",
    "amount": "1000",
    "currency": "USDC",
    "recipient": "0x...",
    "description": "Premium article content"
  }
}
```

---

#### request_content_with_payment

Request content with a signed payment.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| url | string | Content URL path |
| payment_payload | object | Signed payment from sign_payment |

**Returns:**
```json
{
  "status": 200,
  "content": { ... },
  "settlement": {
    "success": true,
    "transaction": "0x...",
    "network": "eip155:84532"
  }
}
```

---

#### request_faucet_funds

Request test tokens from the testnet faucet.

**Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| asset_id | string | "eth" | Asset to request: "eth", "usdc", "eurc", "cbbtc" |

**Returns:**
```json
{
  "success": true,
  "message": "Successfully requested ETH from faucet",
  "transaction_hash": "0x...",
  "address": "0x...",
  "network": "base-sepolia",
  "asset": "ETH"
}
```

---

#### check_faucet_eligibility

Check if the wallet is eligible for faucet funds.

**Returns:**
```json
{
  "success": true,
  "eligible": true,
  "address": "0x...",
  "network": "base-sepolia",
  "supported_assets": ["eth", "usdc", "eurc", "cbbtc"],
  "message": "Wallet is eligible for faucet on base-sepolia..."
}
```

---

## Gateway Target Configuration

This section documents how to configure AgentCore Gateway targets for the x402 demo. Gateway targets define external APIs that are exposed as MCP tools, enabling the AI agent to discover and invoke them dynamically.

### Gateway Target Overview

The AgentCore Gateway serves as a centralized MCP (Model Context Protocol) tool server:

```
┌─────────────────────────────────────────────────────────────────┐
│                    AgentCore Gateway                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                  MCP Tool Server                        │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │    │
│  │  │  Discovery  │  │  Invocation │  │  Header         │  │    │
│  │  │  Endpoint   │  │  Endpoint   │  │  Passthrough    │  │    │
│  │  │ GET /mcp/   │  │ POST /mcp/  │  │  (x402 headers) │  │    │
│  │  │   tools     │  │   invoke    │  │                 │  │    │
│  │  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘  │    │
│  └─────────┼────────────────┼──────────────────┼───────────┘    │
│            │                │                  │                │
│  ┌─────────▼────────────────▼──────────────────▼───────────┐    │
│  │                    Gateway Targets                      │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │  content_tools (OpenAPI Target)                 │    │    │
│  │  │  - get_premium_article                          │    │    │
│  │  │  - get_weather_data                             │    │    │
│  │  │  - get_market_analysis                          │    │    │
│  │  │  - get_research_report                          │    │    │
│  │  └──────────────────────┬──────────────────────────┘    │    │
│  └─────────────────────────┼───────────────────────────────┘    │
└────────────────────────────┼────────────────────────────────────┘
                             │
                             ▼
              ┌──────────────────────────────┐
              │   CloudFront Distribution    │
              │   (Seller Infrastructure)    │
              │   - x402 Payment Verification│
              │   - Content Delivery         │
              └──────────────────────────────┘
```

Key concepts:
- **Gateway Targets**: External APIs registered with the Gateway
- **OpenAPI Targets**: Targets defined via OpenAPI specification
- **MCP Tools**: Operations from OpenAPI specs exposed as discoverable tools
- **Header Passthrough**: x402 payment headers forwarded to/from targets

### Target Types

| Type | Description | Use Case |
|------|-------------|----------|
| `OPENAPI` | Target defined by OpenAPI 3.0 specification | REST APIs with well-defined schemas |
| `HTTP` | Generic HTTP endpoint | Simple endpoints without OpenAPI spec |
| `LAMBDA` | AWS Lambda function | Serverless compute targets |

For the x402 demo, we use `OPENAPI` targets to leverage automatic MCP tool generation from the OpenAPI spec.

### OpenAPI Target Configuration

The content tools target is configured in `payer-agent/gateway_config.yaml`:

```yaml
gateway:
  targets:
    content_tools:
      name: x402-content-tools
      description: "Premium content endpoints protected by x402 payment protocol"
      type: OPENAPI
      
      # OpenAPI specification reference
      openapi:
        spec_file: "openapi/content-tools.yaml"
        version: "3.0.3"
      
      # Target URL (CloudFront distribution)
      target_url: "${X402_SELLER_CLOUDFRONT_URL}"
```

#### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `X402_SELLER_CLOUDFRONT_URL` | CloudFront distribution URL | `https://d1234567890abc.cloudfront.net` |
| `X402_PAYER_AGENT_RUNTIME_ARN` | AgentCore Runtime ARN | `arn:aws:bedrock:us-west-2:123456789012:agent-runtime/...` |

#### Getting the CloudFront URL

After deploying seller-infrastructure:

```bash
# Option 1: Use helper script
./scripts/get_cloudfront_url.sh

# Option 2: Query CloudFormation
aws cloudformation describe-stacks --stack-name X402SellerStack \
  --query "Stacks[0].Outputs[?ExportName=='X402DistributionUrl'].OutputValue" \
  --output text

# Option 3: From CDK deploy output
cd seller-infrastructure && cdk deploy
# Look for: X402DistributionUrl = https://dXXXXXXXXXXXXX.cloudfront.net
```

### MCP Tool Mapping

Each OpenAPI operation is mapped to an MCP tool. The mapping is defined using the `x-mcp-tool` extension in the OpenAPI spec:

```yaml
# In openapi/content-tools.yaml
paths:
  /api/premium-article:
    get:
      operationId: get_premium_article
      x-mcp-tool:
        name: get_premium_article
        description: |
          Retrieve a premium article about AI and blockchain integration.
          Requires x402 payment: 1000 USDC units (0.001 USDC).
        category: content
        tags: [premium-content, article, x402-payment]
        priority: 1
        requires_payment: true
        payment:
          price_units: "1000"
          price_display: "0.001 USDC"
          asset: USDC
          network: Base Sepolia
```

#### MCP Tool Properties

| Property | Type | Description |
|----------|------|-------------|
| `name` | string | Tool name (snake_case, used in MCP discovery) |
| `description` | string | Human-readable description for agent context |
| `category` | string | Tool category for organization |
| `tags` | array | Tags for filtering and search |
| `priority` | integer | Priority hint for tool selection (higher = more likely) |
| `requires_payment` | boolean | Whether tool requires x402 payment |
| `payment` | object | Payment metadata (price, asset, network) |

#### Available MCP Tools

| Tool Name | Category | Price | Description |
|-----------|----------|-------|-------------|
| `get_premium_article` | content | 0.001 USDC | Premium article content |
| `get_weather_data` | market-data | 0.0005 USDC | Real-time weather data |
| `get_market_analysis` | market-data | 0.002 USDC | Crypto market analysis |
| `get_research_report` | research | 0.005 USDC | Blockchain research report |

### x402 Header Passthrough

The Gateway must pass x402 payment headers through to the target without modification. This is configured in the `authentication` section:

```yaml
authentication:
  type: PASSTHROUGH
  
  # Request headers (Agent → Target)
  passthrough_request_headers:
    - name: "X-PAYMENT-SIGNATURE"
      required: false
      description: "Base64-encoded x402 PaymentPayload"
    - name: "X-Request-Id"
      required: false
      description: "Request correlation ID"
  
  # Response headers (Target → Agent)
  passthrough_response_headers:
    - name: "X-PAYMENT-REQUIRED"
      description: "Payment requirements (402 response)"
      expose_to_client: true
    - name: "X-PAYMENT-RESPONSE"
      description: "Settlement confirmation (200 response)"
      expose_to_client: true
```

#### x402 Header Flow

```
┌─────────┐                    ┌─────────┐                    ┌────────────┐
│  Agent  │                    │ Gateway │                    │ CloudFront │
└────┬────┘                    └────┬────┘                    └─────┬──────┘
     │                              │                               │
     │ 1. GET /api/premium-article  │                               │
     ├─────────────────────────────>│                               │
     │                              │ 2. Forward request            │
     │                              ├──────────────────────────────>│
     │                              │                               │
     │                              │ 3. 402 + X-PAYMENT-REQUIRED   │
     │                              │<──────────────────────────────┤
     │ 4. 402 + X-PAYMENT-REQUIRED  │                               │
     │<─────────────────────────────┤                               │
     │                              │                               │
     │ [Agent signs payment]        │                               │
     │                              │                               │
     │ 5. GET + X-PAYMENT-SIGNATURE │                               │
     ├─────────────────────────────>│                               │
     │                              │ 6. Forward + X-PAYMENT-SIG    │
     │                              ├──────────────────────────────>│
     │                              │                               │
     │                              │ 7. 200 + X-PAYMENT-RESPONSE   │
     │                              │<──────────────────────────────┤
     │ 8. 200 + Content + X-PAY-RSP │                               │
     │<─────────────────────────────┤                               │
```

#### Status Code Handling

The Gateway must NOT retry certain status codes that require agent action:

```yaml
response:
  # Pass through to agent (don't retry)
  passthrough_status_codes:
    - 402  # Payment Required - agent must sign payment
    - 400  # Bad Request - agent must fix payload
    - 401  # Unauthorized - agent must re-authorize
  
  # Retry on transient errors only
  retry_on_status_codes:
    - 500  # Internal Server Error
    - 502  # Bad Gateway
    - 503  # Service Unavailable
    - 504  # Gateway Timeout
```

### Configuration Reference

#### Complete Target Configuration

```yaml
targets:
  content_tools:
    name: x402-content-tools
    description: "Premium content endpoints protected by x402 payment protocol"
    type: OPENAPI
    
    openapi:
      spec_file: "openapi/content-tools.yaml"
      version: "3.0.3"
      
      operations:
        - operation_id: get_premium_article
          tool_name: get_premium_article
          tool_description: "Retrieve premium article. Requires 0.001 USDC payment."
          mcp_metadata:
            category: "content"
            priority: 1
            requires_payment: true
          x402_metadata:
            price_usdc_units: "1000"
            network: "eip155:84532"
            scheme: "exact"
    
    target_url: "${X402_SELLER_CLOUDFRONT_URL}"
    
    authentication:
      type: PASSTHROUGH
      passthrough_request_headers:
        - name: "X-PAYMENT-SIGNATURE"
        - name: "X-Request-Id"
      passthrough_response_headers:
        - name: "X-PAYMENT-REQUIRED"
        - name: "X-PAYMENT-RESPONSE"
    
    request:
      headers:
        Accept: "application/json"
        Content-Type: "application/json"
      timeout_seconds: 30
      forward_headers:
        - "X-PAYMENT-SIGNATURE"
        - "X-Request-Id"
    
    response:
      expose_headers:
        - "X-PAYMENT-REQUIRED"
        - "X-PAYMENT-RESPONSE"
      passthrough_status_codes:
        - 402
        - 400
        - 401
    
    health_check:
      enabled: true
      method: OPTIONS
      path: "/api/premium-article"
      interval_seconds: 60
    
    rate_limiting:
      enabled: true
      requests_per_second: 5
      burst_capacity: 10
    
    retry:
      enabled: true
      max_retries: 2
      retry_on_status_codes: [500, 502, 503, 504]
    
    logging:
      enabled: true
      log_level: INFO
      log_request_headers: true
      log_response_headers: true
    
    metrics:
      enabled: true
      namespace: "X402PayerAgent/ContentTools"
      dimensions: ["ToolName", "StatusCode", "PaymentStatus"]
```

#### MCP Protocol Configuration

```yaml
mcp:
  enabled: true
  version: "1.0"
  
  endpoint:
    discovery_path: "/mcp/tools"
    invoke_path: "/mcp/invoke"
  
  discovery:
    include_schemas: true
    include_examples: true
    include_payment_metadata: true
    cache_ttl_seconds: 300
    
    categories:
      - id: "content"
        name: "Premium Content"
        description: "Premium articles requiring x402 payment"
      - id: "market-data"
        name: "Market Data"
        description: "Real-time market and financial data"
      - id: "research"
        name: "Research Reports"
        description: "In-depth research and analysis"
  
  invocation:
    timeout_seconds: 60
    max_concurrent: 5
    x402_handling:
      passthrough_402: true
      include_payment_metadata: true
      log_payment_flow: true
```

#### Gateway Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/agent/invoke` | POST | Invoke the AI agent |
| `/v1/mcp/tools` | GET | Discover available MCP tools |
| `/v1/mcp/invoke` | POST | Invoke an MCP tool directly |

#### Example: Discover MCP Tools

```bash
curl -X GET "https://<gateway-url>/v1/mcp/tools" \
  -H "Authorization: AWS4-HMAC-SHA256 ..." \
  -H "Accept: application/json"
```

Response:
```json
{
  "tools": [
    {
      "name": "get_premium_article",
      "description": "Retrieve premium article. Requires 0.001 USDC payment.",
      "category": "content",
      "requires_payment": true,
      "payment": {
        "price_units": "1000",
        "price_display": "0.001 USDC",
        "network": "Base Sepolia"
      },
      "input_schema": { "type": "object", "properties": {} }
    }
  ],
  "count": 4,
  "categories": ["content", "market-data", "research"]
}
```

#### Example: Invoke MCP Tool

```bash
curl -X POST "https://<gateway-url>/v1/mcp/invoke" \
  -H "Authorization: AWS4-HMAC-SHA256 ..." \
  -H "Content-Type: application/json" \
  -d '{"tool": "get_premium_article", "arguments": {}}'
```

Initial response (402):
```json
{
  "status": 402,
  "headers": {
    "X-PAYMENT-REQUIRED": "eyJ4NDAyVmVyc2lvbiI6Mi4uLn0="
  },
  "body": {
    "error": "Payment Required",
    "x402Version": 2
  }
}
```

### Troubleshooting

#### Headers Not Being Passed Through

1. Verify headers are listed in `passthrough_request_headers`
2. Check `forward_headers` includes x402 headers
3. Ensure `preserve_case: true` is set for header transformations
4. Check Gateway logs for header transformation issues

#### 402 Responses Being Retried

1. Ensure 402 is in `passthrough_status_codes`
2. Verify 402 is NOT in `retry_on_status_codes`
3. Check `no_retry_status_codes` includes 402

#### MCP Tool Discovery Fails

1. Verify OpenAPI spec is valid (use `spectral lint`)
2. Check `x-mcp-tool` extensions are properly formatted
3. Ensure `mcp.enabled: true` in Gateway config
4. Check Gateway logs for spec parsing errors

#### Payment Signature Not Reaching Target

1. Verify `X-PAYMENT-SIGNATURE` is in `forward_headers`
2. Check header is not in `exclude_headers`
3. Ensure `preserve_case: true` for header handling
4. Check CloudFront logs for incoming headers

---

## MCP Tool Schemas

This section documents the MCP (Model Context Protocol) tool schemas exposed by the AgentCore Gateway. These tools are auto-generated from the OpenAPI specification at `payer-agent/openapi/content-tools.yaml`.

### Tool Discovery

Tools are discovered via the MCP discovery endpoint:

```bash
curl -X GET "https://<gateway-url>/v1/mcp/tools" \
  -H "Authorization: AWS4-HMAC-SHA256 ..." \
  -H "Accept: application/json"
```

### Available Tools Summary

| Tool Name | Category | Price | Description |
|-----------|----------|-------|-------------|
| `get_premium_article` | content | 0.001 USDC | Premium article about AI and blockchain |
| `get_weather_data` | market-data | 0.0005 USDC | Real-time weather data and forecast |
| `get_market_analysis` | market-data | 0.002 USDC | Cryptocurrency market analysis |
| `get_research_report` | research | 0.005 USDC | Blockchain technology research report |

---

### get_premium_article

Retrieves a premium article about AI and blockchain integration.

#### MCP Tool Metadata

```json
{
  "name": "get_premium_article",
  "description": "Retrieve a premium article about AI and blockchain integration. Returns article title, author, publication date, full content, and tags. Requires x402 payment: 1000 USDC units (0.001 USDC) on Base Sepolia testnet.",
  "category": "content",
  "tags": ["premium-content", "article", "ai", "blockchain", "x402-payment"],
  "priority": 1,
  "requires_payment": true,
  "payment": {
    "price_units": "1000",
    "price_display": "0.001 USDC",
    "asset": "USDC",
    "network": "Base Sepolia"
  }
}
```

#### Input Schema

```json
{
  "type": "object",
  "properties": {},
  "required": []
}
```

No input parameters required.

#### Output Schema (200 OK)

```json
{
  "type": "object",
  "required": ["title", "author", "date", "content"],
  "properties": {
    "title": {
      "type": "string",
      "description": "Article title"
    },
    "author": {
      "type": "string",
      "description": "Article author"
    },
    "date": {
      "type": "string",
      "format": "date",
      "description": "Publication date"
    },
    "content": {
      "type": "string",
      "description": "Article summary/excerpt"
    },
    "fullText": {
      "type": "string",
      "description": "Full article content"
    },
    "tags": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Article tags/categories"
    }
  }
}
```

#### Example Response

```json
{
  "title": "The Future of AI and Blockchain Integration",
  "author": "Tech Insights",
  "date": "2026-01-26",
  "content": "Artificial Intelligence and Blockchain are converging to create new paradigms in technology...",
  "fullText": "This is premium content that requires payment to access. The full article explores how AI agents can autonomously interact with blockchain networks...",
  "tags": ["AI", "blockchain", "technology", "innovation", "x402"]
}
```

---

### get_weather_data

Retrieves real-time weather data and 5-day forecast.

#### MCP Tool Metadata

```json
{
  "name": "get_weather_data",
  "description": "Get real-time weather data and 5-day forecast for San Francisco. Returns current conditions (temperature, humidity, wind) and daily forecasts. Requires x402 payment: 500 USDC units (0.0005 USDC) on Base Sepolia testnet.",
  "category": "market-data",
  "tags": ["weather", "forecast", "real-time", "x402-payment"],
  "priority": 2,
  "requires_payment": true,
  "payment": {
    "price_units": "500",
    "price_display": "0.0005 USDC",
    "asset": "USDC",
    "network": "Base Sepolia"
  }
}
```

#### Input Schema

```json
{
  "type": "object",
  "properties": {},
  "required": []
}
```

No input parameters required.

#### Output Schema (200 OK)

```json
{
  "type": "object",
  "required": ["location", "timestamp", "current"],
  "properties": {
    "location": {
      "type": "string",
      "description": "Location name"
    },
    "timestamp": {
      "type": "string",
      "format": "date-time",
      "description": "Data timestamp"
    },
    "current": {
      "type": "object",
      "required": ["temperature", "conditions"],
      "properties": {
        "temperature": { "type": "number", "description": "Current temperature" },
        "temperatureUnit": { "type": "string", "enum": ["F", "C"] },
        "conditions": { "type": "string", "description": "Weather conditions" },
        "humidity": { "type": "integer", "description": "Humidity percentage" },
        "windSpeed": { "type": "number", "description": "Wind speed" },
        "windUnit": { "type": "string", "enum": ["mph", "kph"] },
        "uvIndex": { "type": "integer", "description": "UV index (0-11)" }
      }
    },
    "forecast": {
      "type": "array",
      "description": "5-day forecast",
      "items": {
        "type": "object",
        "properties": {
          "day": { "type": "string" },
          "conditions": { "type": "string" },
          "high": { "type": "number" },
          "low": { "type": "number" }
        }
      }
    },
    "source": { "type": "string", "description": "Data source identifier" },
    "premium": { "type": "boolean", "description": "Premium content flag" }
  }
}
```

#### Example Response

```json
{
  "location": "San Francisco, CA",
  "timestamp": "2026-01-26T12:00:00Z",
  "current": {
    "temperature": 62,
    "temperatureUnit": "F",
    "conditions": "Partly Cloudy",
    "humidity": 65,
    "windSpeed": 12,
    "windUnit": "mph",
    "uvIndex": 4
  },
  "forecast": [
    { "day": "Tue", "conditions": "Sunny", "high": 68, "low": 52 },
    { "day": "Wed", "conditions": "Partly Cloudy", "high": 65, "low": 50 }
  ],
  "source": "x402-weather-service",
  "premium": true
}
```

---

### get_market_analysis

Retrieves cryptocurrency market analysis with real-time prices and sentiment.

#### MCP Tool Metadata

```json
{
  "name": "get_market_analysis",
  "description": "Get cryptocurrency market analysis with real-time prices and sentiment. Returns prices for BTC/ETH/SOL, 24h changes, volume, sentiment analysis, and key events. Requires x402 payment: 2000 USDC units (0.002 USDC) on Base Sepolia testnet.",
  "category": "market-data",
  "tags": ["cryptocurrency", "market-analysis", "prices", "sentiment", "real-time", "x402-payment"],
  "priority": 3,
  "requires_payment": true,
  "payment": {
    "price_units": "2000",
    "price_display": "0.002 USDC",
    "asset": "USDC",
    "network": "Base Sepolia"
  }
}
```

#### Input Schema

```json
{
  "type": "object",
  "properties": {},
  "required": []
}
```

No input parameters required.

#### Output Schema (200 OK)

```json
{
  "type": "object",
  "required": ["timestamp", "markets", "analysis"],
  "properties": {
    "timestamp": { "type": "string", "format": "date-time" },
    "date": { "type": "string", "format": "date" },
    "markets": {
      "type": "object",
      "description": "Market data by cryptocurrency symbol",
      "additionalProperties": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "price": { "type": "string" },
          "change24h": { "type": "string" },
          "volume24h": { "type": "string" },
          "marketCap": { "type": "string" }
        }
      }
    },
    "analysis": {
      "type": "object",
      "properties": {
        "overallSentiment": {
          "type": "string",
          "enum": ["Bullish", "Bearish", "Neutral", "Very Bullish", "Cautiously Optimistic"]
        },
        "summary": { "type": "string" },
        "keyEvents": { "type": "array", "items": { "type": "string" } },
        "riskLevel": { "type": "string", "enum": ["Low", "Medium", "High"] }
      }
    },
    "source": { "type": "string" },
    "premium": { "type": "boolean" }
  }
}
```

#### Example Response

```json
{
  "timestamp": "2026-01-26T12:00:00Z",
  "date": "2026-01-26",
  "markets": {
    "BTC": {
      "name": "Bitcoin",
      "price": "98500.00",
      "change24h": "+2.35%",
      "volume24h": "25.5B",
      "marketCap": "1920000M"
    },
    "ETH": {
      "name": "Ethereum",
      "price": "3850.00",
      "change24h": "+1.82%",
      "volume24h": "12.3B",
      "marketCap": "462000M"
    },
    "SOL": {
      "name": "Solana",
      "price": "185.50",
      "change24h": "+4.12%",
      "volume24h": "3.8B",
      "marketCap": "82000M"
    }
  },
  "analysis": {
    "overallSentiment": "Bullish",
    "summary": "Market showing positive momentum with strong institutional inflows...",
    "keyEvents": [
      "Federal Reserve meeting scheduled for next week",
      "Major protocol upgrade announced for Ethereum"
    ],
    "riskLevel": "Medium"
  },
  "source": "x402-market-service",
  "premium": true
}
```

---

### get_research_report

Retrieves an in-depth blockchain technology research report.

#### MCP Tool Metadata

```json
{
  "name": "get_research_report",
  "description": "Get in-depth blockchain technology research report for 2026. Returns executive summary, market overview, technology trends, and strategic recommendations. Requires x402 payment: 5000 USDC units (0.005 USDC) on Base Sepolia testnet.",
  "category": "research",
  "tags": ["research", "blockchain", "technology-trends", "enterprise", "premium-content", "x402-payment"],
  "priority": 4,
  "requires_payment": true,
  "payment": {
    "price_units": "5000",
    "price_display": "0.005 USDC",
    "asset": "USDC",
    "network": "Base Sepolia"
  }
}
```

#### Input Schema

```json
{
  "type": "object",
  "properties": {},
  "required": []
}
```

No input parameters required.

#### Output Schema (200 OK)

```json
{
  "type": "object",
  "required": ["title", "author", "publishDate", "abstract", "sections"],
  "properties": {
    "title": { "type": "string", "description": "Report title" },
    "author": { "type": "string", "description": "Report author or team" },
    "publishDate": { "type": "string", "format": "date", "description": "Publication date" },
    "version": { "type": "string", "description": "Report version" },
    "abstract": { "type": "string", "description": "Executive summary" },
    "sections": {
      "type": "array",
      "description": "Report sections with detailed analysis",
      "items": {
        "type": "object",
        "required": ["title", "content"],
        "properties": {
          "title": { "type": "string", "description": "Section heading" },
          "content": { "type": "string", "description": "Section content" },
          "data": {
            "type": "object",
            "description": "Optional structured data",
            "properties": {
              "marketSize2026": { "type": "string" },
              "projectedGrowth": { "type": "string" },
              "topSectors": { "type": "array", "items": { "type": "string" } }
            }
          },
          "trends": {
            "type": "array",
            "description": "Technology trends analysis",
            "items": {
              "type": "object",
              "properties": {
                "name": { "type": "string", "description": "Trend name" },
                "impact": { "type": "string", "enum": ["High", "Medium", "Low"] },
                "maturity": { "type": "string", "enum": ["Emerging", "Growing", "Mature"] }
              }
            }
          }
        }
      }
    },
    "premium": { "type": "boolean", "description": "Premium content flag" },
    "source": { "type": "string", "description": "Data source identifier" }
  }
}
```

#### Example Response

```json
{
  "title": "Blockchain Technology Trends 2026",
  "author": "x402 Research Team",
  "publishDate": "2026-01-15",
  "version": "1.0",
  "abstract": "This comprehensive research report analyzes the current state and future trajectory of blockchain technology...",
  "sections": [
    {
      "title": "Executive Summary",
      "content": "The blockchain industry continues to mature with significant advancements..."
    },
    {
      "title": "Market Overview",
      "content": "The global blockchain market is projected to reach $163 billion by 2027.",
      "data": {
        "marketSize2026": "$94.5B",
        "projectedGrowth": "68.4%",
        "topSectors": ["DeFi", "Supply Chain", "Digital Identity", "Healthcare"]
      }
    },
    {
      "title": "Technology Trends",
      "content": "Key technological developments include zero-knowledge proofs...",
      "trends": [
        { "name": "Zero-Knowledge Proofs", "impact": "High", "maturity": "Growing" },
        { "name": "Account Abstraction", "impact": "High", "maturity": "Emerging" }
      ]
    }
  ],
  "premium": true,
  "source": "x402-research-service"
}
```

---

### Common Error Schemas

All MCP tools return consistent error responses for non-200 status codes.

#### 402 Payment Required Schema

```json
{
  "type": "object",
  "required": ["x402Version", "resource", "accepts"],
  "properties": {
    "x402Version": { "type": "integer", "enum": [2] },
    "error": { "type": "string" },
    "resource": {
      "type": "object",
      "properties": {
        "url": { "type": "string", "format": "uri" },
        "description": { "type": "string" },
        "mimeType": { "type": "string" }
      }
    },
    "accepts": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["scheme", "network", "amount", "asset", "payTo", "maxTimeoutSeconds"],
        "properties": {
          "scheme": { "type": "string", "enum": ["exact"] },
          "network": { "type": "string", "example": "eip155:84532" },
          "amount": { "type": "string", "description": "Amount in atomic units" },
          "asset": { "type": "string", "description": "Token contract address" },
          "payTo": { "type": "string", "description": "Recipient wallet address" },
          "maxTimeoutSeconds": { "type": "integer" },
          "extra": {
            "type": "object",
            "properties": {
              "name": { "type": "string" },
              "version": { "type": "string" },
              "assetTransferMethod": { "type": "string" }
            }
          }
        }
      }
    },
    "extensions": { "type": "object" }
  }
}
```

#### Error Response Schema (400, 401, 500)

```json
{
  "type": "object",
  "required": ["error", "message"],
  "properties": {
    "error": {
      "type": "string",
      "description": "Error type/category",
      "example": "Bad Request"
    },
    "message": {
      "type": "string",
      "description": "Human-readable error message"
    },
    "code": {
      "type": "string",
      "description": "Machine-readable error code",
      "enum": [
        "INVALID_PAYLOAD_STRUCTURE",
        "INVALID_ENCODING",
        "MISSING_FIELD",
        "AMOUNT_MISMATCH",
        "UNSUPPORTED_SCHEME",
        "UNSUPPORTED_NETWORK",
        "UNSUPPORTED_VERSION",
        "INVALID_SIGNATURE",
        "AUTHORIZATION_EXPIRED",
        "AUTHORIZATION_NOT_YET_VALID",
        "SIGNER_MISMATCH",
        "NONCE_REUSED",
        "INSUFFICIENT_BALANCE",
        "PAYMENT_PROCESSING_ERROR",
        "RPC_UNAVAILABLE",
        "SETTLEMENT_FAILED",
        "TIMEOUT"
      ]
    },
    "details": {
      "type": "object",
      "description": "Additional context-specific error details"
    }
  }
}
```

---

### MCP Tool Invocation

To invoke an MCP tool directly (bypassing the agent):

```bash
curl -X POST "https://<gateway-url>/v1/mcp/invoke" \
  -H "Authorization: AWS4-HMAC-SHA256 ..." \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "get_premium_article",
    "arguments": {}
  }'
```

#### Initial Response (402)

```json
{
  "status": 402,
  "headers": {
    "X-PAYMENT-REQUIRED": "eyJ4NDAyVmVyc2lvbiI6Mi4uLn0="
  },
  "body": {
    "x402Version": 2,
    "error": "Payment Required",
    "resource": {
      "url": "https://api.example.com/api/premium-article",
      "description": "Premium article about AI and blockchain integration",
      "mimeType": "application/json"
    },
    "accepts": [
      {
        "scheme": "exact",
        "network": "eip155:84532",
        "amount": "1000",
        "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        "payTo": "<SELLER_WALLET_ADDRESS>",
        "maxTimeoutSeconds": 60,
        "extra": {
          "name": "USDC",
          "version": "2",
          "assetTransferMethod": "eip3009"
        }
      }
    ],
    "extensions": {}
  }
}
```

#### Retry with Payment

```bash
curl -X POST "https://<gateway-url>/v1/mcp/invoke" \
  -H "Authorization: AWS4-HMAC-SHA256 ..." \
  -H "Content-Type: application/json" \
  -H "X-PAYMENT-SIGNATURE: <base64-encoded-payment-payload>" \
  -d '{
    "tool": "get_premium_article",
    "arguments": {}
  }'
```

#### Success Response (200)

```json
{
  "status": 200,
  "headers": {
    "X-PAYMENT-RESPONSE": "eyJzdWNjZXNzIjp0cnVlLC4uLn0="
  },
  "body": {
    "title": "The Future of AI and Blockchain Integration",
    "author": "Tech Insights",
    "date": "2026-01-26",
    "content": "...",
    "fullText": "...",
    "tags": ["AI", "blockchain", "technology", "innovation", "x402"]
  }
}
```

---

## Data Types

### PaymentRequirements

```typescript
interface PaymentRequirements {
  scheme: string;           // Payment scheme (e.g., "exact")
  network: string;          // CAIP-2 network ID (e.g., "eip155:84532")
  amount: string;           // Amount in atomic units
  asset: string;            // Asset contract address
  payTo: string;            // Recipient wallet address
  maxTimeoutSeconds: number; // Maximum payment validity
  extra?: {
    name?: string;          // Asset name (e.g., "USDC")
    version?: string;       // Protocol version
    assetTransferMethod?: string; // Transfer method (e.g., "eip3009")
  };
}
```

### PaymentPayload

```typescript
interface PaymentPayload {
  x402Version: number;      // Protocol version (2)
  accepted: PaymentRequirements;
  payload: {
    signature: string;      // EIP-712 signature
    authorization: {
      from: string;         // Payer address
      to: string;           // Recipient address
      value: string;        // Amount in atomic units
      validAfter: string;   // Unix timestamp
      validBefore: string;  // Unix timestamp
      nonce: string;        // 32-byte hex nonce
    };
  };
}
```

### SettlementResponse

```typescript
interface SettlementResponse {
  success: boolean;
  transaction: string;      // Transaction hash
  network: string;          // Network ID
  payer?: string;           // Payer address
  errorReason?: string;     // Error reason if failed
}
```

---

## Rate Limiting

### Seller API

No explicit rate limiting at the application level. CloudFront and Lambda@Edge have built-in limits.

### AgentCore Gateway

| Setting | Value |
|---------|-------|
| Requests per second | 10 |
| Burst capacity | 20 |
| Authentication | IAM SigV4 |

Client-side rate limiting is implemented in the Gateway client to prevent throttling.

---

## Network Configuration

### Supported Networks

| Network | Chain ID | CAIP-2 ID | Environment |
|---------|----------|-----------|-------------|
| Base Sepolia | 84532 | eip155:84532 | Testnet |

### Asset Addresses (Base Sepolia)

| Asset | Contract Address |
|-------|------------------|
| USDC | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |

---

## Facilitator Service

The x402 facilitator service handles payment verification and settlement.

| Endpoint | URL |
|----------|-----|
| Production | `https://facilitator.x402.org` |

### POST /verify

Verify a payment signature.

**Request:**
```json
{
  "paymentPayload": { ... },
  "paymentRequirements": { ... }
}
```

**Response:**
```json
{
  "isValid": true,
  "payer": "0x..."
}
```

### POST /settle

Settle a verified payment on-chain.

**Request:**
```json
{
  "paymentPayload": { ... },
  "paymentRequirements": { ... }
}
```

**Response:**
```json
{
  "success": true,
  "transaction": "0x...",
  "network": "eip155:84532",
  "payer": "0x..."
}
```
