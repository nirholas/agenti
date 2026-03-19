# x402 AWS Enterprise Demo - Troubleshooting Guide

This guide covers common issues and their solutions when working with the x402 payment demo.

## Table of Contents

- [Setup Issues](#setup-issues)
- [AWS & CDK Issues](#aws--cdk-issues)
- [Payer Agent Issues](#payer-agent-issues)
- [Wallet & Payment Issues](#wallet--payment-issues)
- [Seller Infrastructure Issues](#seller-infrastructure-issues)
- [AgentCore Gateway Issues](#agentcore-gateway-issues)
- [x402 Protocol Issues](#x402-protocol-issues)
- [Network & Connection Issues](#network--connection-issues)
- [Debugging Tips](#debugging-tips)

---

## Setup Issues

### "No module named 'strands_agents'"

**Cause**: Python dependencies not installed or virtual environment not activated.

**Solution**:
```bash
cd payer-agent
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -e ".[dev]"
```

### "Command not found: cdk"

**Cause**: AWS CDK CLI not installed.

**Solution**:
```bash
npm install -g aws-cdk
# Verify installation
cdk --version
```

### Missing x402 or agentkit directories

**Cause**: Required dependencies not cloned.

**Solution**:
```bash
cd sample-agentcore-cloudfront-x402-payments
git clone https://github.com/coinbase/x402.git
git clone https://github.com/coinbase/agentkit.git
```

### Python version mismatch

**Cause**: Project requires Python 3.10+.

**Solution**:
```bash
python3 --version
# If < 3.10, install newer Python via pyenv or your package manager
pyenv install 3.10.12
pyenv local 3.10.12
```

---

## AWS & CDK Issues

### "AWS credentials not found"

**Cause**: AWS CLI not configured or credentials expired.

**Solution**:
```bash
# Configure credentials
aws configure

# Or for SSO:
aws sso login --profile your-profile

# Verify credentials
aws sts get-caller-identity
```

### "CDK bootstrap required"

**Cause**: CDK hasn't been bootstrapped in the target account/region.

**Solution**:
```bash
# Get your account ID
aws sts get-caller-identity --query Account --output text

# Bootstrap CDK
cdk bootstrap aws://ACCOUNT_ID/REGION

# Example:
cdk bootstrap aws://123456789012/us-east-1
```

### "Resource already exists" during CDK deploy

**Cause**: Previous deployment left orphaned resources.

**Solution**:
```bash
# Option 1: Destroy and redeploy
cdk destroy
cdk deploy

# Option 2: Import existing resources (advanced)
cdk import
```

### Lambda@Edge deployment fails

**Cause**: Lambda@Edge must be deployed to `us-east-1`.

**Solution**:
Lambda@Edge requires `us-east-1`, which is hardcoded in the CDK stack. No `.env` configuration needed.

Redeploy:
```bash
cd seller-infrastructure
cdk deploy
```

### "Access Denied" when invoking AgentCore

**Cause**: IAM permissions not configured correctly.

**Solution**:
1. Verify your IAM user/role has `bedrock:InvokeAgent` permission
2. Check the agent's resource policy allows your principal
3. Verify the agent ID and alias ID are correct

```bash
# Test with AWS CLI
aws bedrock-agent-runtime invoke-agent \
  --agent-id YOUR_AGENT_ID \
  --agent-alias-id TSTALIASID \
  --session-id test-session \
  --input-text "Hello"
```

---

## Payer Agent Issues

### Agent not responding or timing out

**Cause**: Bedrock model access not enabled or rate limited.

**Solution**:
1. Enable model access in AWS Console:
   - Go to Amazon Bedrock → Model access
   - Request access to Claude 3 Sonnet
2. Check CloudWatch logs for errors
3. Verify `BEDROCK_MODEL_ID` in `.env` is correct

### "Wallet not initialized" error

**Cause**: CDP credentials not configured or invalid.

**Solution**:
1. Verify CDP credentials in `payer-agent/.env`:
```bash
CDP_API_KEY_ID=your_actual_key_id
CDP_API_KEY_SECRET=your_actual_secret
CDP_WALLET_SECRET=your_wallet_secret
```

2. Test credentials:
```bash
cd payer-agent
source .venv/bin/activate
python -c "from agent.tools.payment import get_wallet_balance; print(get_wallet_balance())"
```

### Rate limiting errors

**Cause**: Too many requests to AgentCore Gateway.

**Solution**:
The gateway is configured for 10 requests/second with burst of 20. If you're hitting limits:
1. Add delays between requests
2. Use the built-in rate limiter:
```python
from agent.rate_limiter import RateLimiter, RateLimitConfig

config = RateLimitConfig(requests_per_second=5.0)
limiter = RateLimiter(config)
limiter.acquire()  # Blocks if rate exceeded
```

### OpenTelemetry tracing not working

**Cause**: OTLP endpoint not configured.

**Solution**:
Set the endpoint in `payer-agent/.env`:
```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
# Or for AWS X-Ray:
OTEL_EXPORTER_OTLP_ENDPOINT=https://xray.us-east-1.amazonaws.com
```

For local debugging, enable console export:
```bash
OTEL_CONSOLE_EXPORT=true
```

---

## Wallet & Payment Issues

### "402 Payment Required but no wallet balance"

**Cause**: Wallet has no testnet tokens.

**Solution**:
Request tokens from the CDP faucet:
```bash
cd payer-agent
source .venv/bin/activate
python -c "from agent.tools.payment import request_faucet_funds; print(request_faucet_funds())"
```

Or via the agent:
```
> Request testnet ETH from the faucet
```

### "Faucet service unavailable"

**Cause**: CDP faucet rate limited or temporarily down.

**Solution**:
1. Wait 24 hours (faucet has daily limits per wallet)
2. Use a different wallet address
3. Get testnet tokens from alternative faucets:
   - [Base Sepolia Faucet](https://www.coinbase.com/faucets/base-ethereum-goerli-faucet)
   - [Alchemy Faucet](https://sepoliafaucet.com/)

### Payment signature rejected

**Cause**: Signature validation failed at the seller.

**Solution**:
Check the `X-PAYMENT-REQUIRED` header for specific error:
- `scheme_mismatch` - Use the correct payment scheme (usually "exact")
- `network_mismatch` - Ensure you're on Base Sepolia (`eip155:84532`)
- `invalid_exact_evm_payload_recipient_mismatch` - Wrong recipient address
- `invalid_exact_evm_payload_authorization_value` - Insufficient payment amount
- `invalid_exact_evm_payload_authorization_valid_before` - Payment expired
- `asset_mismatch` - Wrong payment asset (should be USDC)

### "User rejected signing request"

**Cause**: Wallet provider rejected the transaction.

**Solution**:
1. Check wallet has sufficient balance for gas
2. Verify the transaction parameters are valid
3. Check CDP API key permissions include signing

---

## Seller Infrastructure Issues

### CloudFront returning 403 Forbidden

**Cause**: Origin access or CORS misconfiguration.

**Solution**:
1. Check CloudFront distribution settings
2. Verify S3 bucket policy allows CloudFront access
3. Check CORS headers in Lambda@Edge response

### Lambda@Edge not triggering

**Cause**: Function not associated with CloudFront behavior.

**Solution**:
1. Verify Lambda@Edge association in CloudFront console
2. Check function is deployed to `us-east-1`
3. Ensure function has correct execution role

### Content not found (404)

**Cause**: Content path not configured or S3 content not uploaded.

**Solution**:
1. Check `content-config.ts` for the endpoint
2. For S3 content, upload using:
```bash
cd seller-infrastructure
./scripts/upload-content.sh YOUR_BUCKET_NAME
```

### Payment verification failing

**Cause**: Facilitator service unreachable or payload malformed.

**Solution**:
1. Check facilitator URL is correct: `https://facilitator.x402.org`
2. Verify payment payload structure matches x402 v2 spec
3. Check Lambda@Edge logs in CloudWatch

---

## AgentCore Gateway Issues

### MCP Tool Discovery Fails

**Cause**: Gateway MCP endpoint not responding or misconfigured.

**Solution**:
1. Verify the Gateway is deployed and running:
```bash
# Check Gateway status via AWS CLI
aws bedrock-agent list-agents --query "agentSummaries[?agentName=='x402-payer-agent']"
```

2. Test the MCP discovery endpoint directly:
```bash
curl -X GET "https://<gateway-url>/mcp/tools" \
  -H "Accept: application/json"
```

3. Check the OpenAPI spec is valid:
```bash
cd payer-agent/openapi
npx @stoplight/spectral-cli lint content-tools.yaml
```

4. Verify `x-mcp-tool` extensions are properly formatted in the OpenAPI spec

5. Check Gateway logs for spec parsing errors:
```bash
aws logs tail /aws/bedrock/agents/<agent-id> --follow
```

### Gateway Target Not Responding

**Cause**: CloudFront distribution URL not configured or unreachable.

**Solution**:
1. Verify the `X402_SELLER_CLOUDFRONT_URL` environment variable is set:
```bash
echo $X402_SELLER_CLOUDFRONT_URL
```

2. Get the CloudFront URL from CDK output:
```bash
cd seller-infrastructure
aws cloudformation describe-stacks --stack-name X402SellerStack \
  --query "Stacks[0].Outputs[?ExportName=='X402DistributionUrl'].OutputValue" \
  --output text
```

3. Test connectivity to the target:
```bash
curl -I "$X402_SELLER_CLOUDFRONT_URL/api/premium-article"
```

4. Check Gateway target configuration in `gateway_config.yaml`:
```yaml
targets:
  content_tools:
    target_url: "${X402_SELLER_CLOUDFRONT_URL}"
```

### x402 Headers Not Being Passed Through

**Cause**: Gateway header passthrough not configured correctly.

**Solution**:
1. Verify headers are listed in `passthrough_request_headers` in `gateway_config.yaml`:
```yaml
authentication:
  passthrough_request_headers:
    - name: "X-PAYMENT-SIGNATURE"
    - name: "X-Request-Id"
```

2. Check `forward_headers` includes x402 headers:
```yaml
request:
  forward_headers:
    - "X-PAYMENT-SIGNATURE"
    - "PAYMENT-SIGNATURE"
```

3. Ensure response headers are exposed:
```yaml
response:
  expose_headers:
    - "X-PAYMENT-REQUIRED"
    - "X-PAYMENT-RESPONSE"
```

4. Test header passthrough manually:
```bash
# Send request with payment header
curl -v "https://<gateway-url>/api/premium-article" \
  -H "X-PAYMENT-SIGNATURE: <base64-encoded-payment>"
```

5. Check CloudFront logs for incoming headers

### 402 Responses Being Retried by Gateway

**Cause**: Gateway retry configuration treating 402 as a transient error.

**Solution**:
1. Ensure 402 is in `passthrough_status_codes`:
```yaml
response:
  passthrough_status_codes:
    - 402
    - 400
    - 401
```

2. Verify 402 is NOT in `retry_on_status_codes`:
```yaml
retry:
  retry_on_status_codes:
    - 500
    - 502
    - 503
    - 504
  # 402 should NOT be here
```

3. Check `no_retry_status_codes` includes 402:
```yaml
response:
  no_retry_status_codes:
    - 402
    - 400
    - 401
```

### Gateway Rate Limiting Errors

**Cause**: Too many requests hitting Gateway rate limits.

**Solution**:
1. Check current rate limit configuration:
```yaml
rate_limiting:
  enabled: true
  requests_per_second: 10
  burst_capacity: 20
```

2. Use the built-in rate limiter in your client:
```python
from agent.gateway_client import GatewayClient

client = GatewayClient(
    agent_id="your-agent-id",
    rate_limit_enabled=True,
    rate_limit_requests_per_second=5.0,
    rate_limit_burst_capacity=10,
)
```

3. Check rate limit stats:
```python
print(client.rate_limit_stats)
```

4. If hitting server-side limits, check CloudWatch metrics:
```bash
aws cloudwatch get-metric-statistics \
  --namespace "AWS/Bedrock" \
  --metric-name "ThrottledRequests" \
  --dimensions Name=AgentId,Value=<agent-id> \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 300 \
  --statistics Sum
```

### MCP Tool Invocation Returns Empty Response

**Cause**: Tool endpoint path mapping incorrect or content not found.

**Solution**:
1. Verify the endpoint path in the OpenAPI spec matches the actual CloudFront path:
```yaml
paths:
  /api/premium-article:  # Must match CloudFront path
    get:
      operationId: get_premium_article
```

2. Check the MCP client is constructing the correct URL:
```python
from agent.mcp_client import get_mcp_client

client = get_mcp_client()
tools = client.get_cached_tools()
for tool in tools:
    print(f"{tool.name}: {tool.endpoint_path}")
```

3. Test the endpoint directly:
```bash
curl -v "$X402_SELLER_CLOUDFRONT_URL/api/premium-article"
```

4. Check Lambda@Edge logs for the request:
```bash
aws logs tail /aws/lambda/us-east-1.PaymentVerifier --follow
```

### Gateway SigV4 Authentication Fails

**Cause**: AWS credentials invalid or missing required permissions.

**Solution**:
1. Verify credentials are valid:
```bash
aws sts get-caller-identity
```

2. Check required IAM permissions:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeAgent",
        "bedrock:InvokeAgentWithResponseStream"
      ],
      "Resource": "arn:aws:bedrock:*:*:agent/*"
    }
  ]
}
```

3. Test authentication with the Gateway client:
```python
from agent.gateway_client import GatewayClient

client = GatewayClient(agent_id="your-agent-id")
if client.verify_credentials():
    print("Credentials valid")
    print(client.get_caller_identity())
else:
    print("Credentials invalid")
```

4. Check if the IAM principal is in the Gateway's allowed principals list

### Gateway Target Health Check Failing

**Cause**: Health check endpoint not responding or misconfigured.

**Solution**:
1. Check health check configuration:
```yaml
health_check:
  enabled: true
  method: OPTIONS
  path: "/api/premium-article"
  interval_seconds: 60
```

2. Test the health check endpoint manually:
```bash
curl -X OPTIONS "$X402_SELLER_CLOUDFRONT_URL/api/premium-article" -v
```

3. Verify CloudFront allows OPTIONS requests (check behavior settings)

4. Check CloudWatch for health check metrics:
```bash
aws cloudwatch get-metric-statistics \
  --namespace "X402PayerAgent/ContentTools" \
  --metric-name "HealthCheckStatus" \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 300 \
  --statistics Average
```

### MCP Tool Cache Issues

**Cause**: Stale tool definitions cached by the MCP client.

**Solution**:
1. Force refresh the tool cache:
```python
from agent.mcp_client import get_mcp_client

client = get_mcp_client()
response = await client.discover_tools(force_refresh=True)
print(f"Discovered {len(response.tools)} tools")
```

2. Clear the cache manually:
```python
client.clear_cache()
```

3. Check cache TTL configuration:
```python
# Default is 300 seconds (5 minutes)
client = MCPClient(cache_ttl_seconds=60)  # Reduce for testing
```

4. Disable caching for debugging:
```python
client = MCPClient(enable_caching=False)
```

### Gateway Timeout Errors

**Cause**: Request taking too long or target not responding.

**Solution**:
1. Increase timeout in Gateway config:
```yaml
request:
  timeout_seconds: 60  # Increase from default 30
```

2. Check target latency in CloudWatch:
```bash
aws cloudwatch get-metric-statistics \
  --namespace "X402PayerAgent/ContentTools" \
  --metric-name "TargetLatency" \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 300 \
  --statistics Average
```

3. Check Lambda@Edge execution time (max 30 seconds for viewer-request)

4. Verify CloudFront origin timeout settings

### Debugging Gateway Requests

Enable detailed logging to troubleshoot Gateway issues:

1. Enable x402-specific logging in `gateway_config.yaml`:
```yaml
logging:
  enabled: true
  log_level: DEBUG
  log_request_headers: true
  log_response_headers: true
  x402_logging:
    log_payment_required: true
    log_payment_signature: true
    log_payment_response: true
    log_payment_amounts: true
```

2. Check Gateway logs:
```bash
aws logs tail /aws/bedrock/agents/<agent-id> --follow
```

3. Use the MCP client with tracing enabled:
```python
import os
os.environ["OTEL_CONSOLE_EXPORT"] = "true"

from agent.mcp_client import MCPClient
client = MCPClient()
response = await client.invoke_tool("get_premium_article")
```

4. Check x402 payment metrics:
```bash
aws cloudwatch get-metric-statistics \
  --namespace "X402PayerAgent/ContentTools" \
  --metric-name "PaymentRequired" \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 300 \
  --statistics Sum
```

---

## x402 Protocol Issues

### Invalid base64 in X-PAYMENT-REQUIRED header

**Cause**: Header encoding corrupted or truncated.

**Solution**:
Test decoding manually:
```python
import base64
import json

header = "YOUR_HEADER_VALUE"
decoded = base64.b64decode(header)
data = json.loads(decoded)
print(json.dumps(data, indent=2))
```

### Wrong x402 version

**Cause**: Using v1 client with v2 server or vice versa.

**Solution**:
This demo uses x402 v2. Ensure:
- `x402Version: 2` in payment requirements
- Payment payload follows v2 structure
- Using v2-compatible facilitator

### Invalid CAIP-2 network format

**Cause**: Network identifier not in correct format.

**Solution**:
Use format `namespace:chainId`:
- Base Sepolia: `eip155:84532`
- Ethereum Sepolia: `eip155:11155111`

Invalid formats:
- `base-sepolia` (missing chain ID)
- `84532` (missing namespace)

### Payment amount mismatch

**Cause**: Amount in atomic units vs decimal confusion.

**Solution**:
x402 uses atomic units (smallest denomination):
- 1 USDC = 1,000,000 atomic units (6 decimals)
- 0.001 USDC = 1,000 atomic units

```python
# Convert decimal to atomic units
decimal_amount = 0.001
atomic_units = int(decimal_amount * 1_000_000)  # 1000
```

---

## Network & Connection Issues

### Connection timeout to seller API

**Cause**: Network issues or CloudFront not deployed.

**Solution**:
1. Verify CloudFront URL is correct
2. Test connectivity:
```bash
curl -I https://YOUR_DISTRIBUTION.cloudfront.net/api/premium-article
```
3. Check AWS service health dashboard

### SSL certificate errors

**Cause**: Certificate validation failing.

**Solution**:
1. Ensure using HTTPS
2. Check system CA certificates are up to date
3. For testing only, disable verification (not for production):
```python
import httpx
async with httpx.AsyncClient(verify=False) as client:
    response = await client.get(url)
```

### DNS resolution failures

**Cause**: DNS not resolving CloudFront domain.

**Solution**:
1. Wait for DNS propagation (up to 24 hours for new distributions)
2. Try alternative DNS servers:
```bash
nslookup YOUR_DISTRIBUTION.cloudfront.net 8.8.8.8
```

---

## Debugging Tips

### Enable verbose logging

```bash
# Payer agent
export LOG_LEVEL=DEBUG
python -m agent.main

# Or in code
import logging
logging.basicConfig(level=logging.DEBUG)
```

### Inspect x402 headers

```bash
# Get payment requirements
curl -i https://YOUR_DISTRIBUTION.cloudfront.net/api/premium-article 2>&1 | grep -i x-payment

# Decode the header
echo "BASE64_HEADER" | base64 -d | jq .
```

### Test payment flow step by step

```python
# 1. Request content (get 402)
import httpx
response = httpx.get("https://YOUR_URL/api/premium-article")
print(f"Status: {response.status_code}")
print(f"Headers: {dict(response.headers)}")

# 2. Decode payment requirements
import base64, json
req = json.loads(base64.b64decode(response.headers["X-PAYMENT-REQUIRED"]))
print(json.dumps(req, indent=2))

# 3. Sign payment (via agent tools)
from agent.tools.payment import sign_payment
result = await sign_payment(
    scheme=req["accepts"][0]["scheme"],
    network="base-sepolia",
    amount=req["accepts"][0]["amount"],
    recipient=req["accepts"][0]["payTo"]
)
print(result)
```

### Check CloudWatch logs

```bash
# Lambda@Edge logs (check multiple regions)
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/us-east-1"

# Get recent logs
aws logs tail /aws/lambda/us-east-1.PaymentVerifier --follow
```

### Verify AWS credentials

```bash
# Check current identity
aws sts get-caller-identity

# Check Bedrock access
aws bedrock list-foundation-models --query "modelSummaries[?contains(modelId, 'claude')]"
```

---

## Getting Help

If you're still stuck:

1. Check the [x402 GitHub Issues](https://github.com/coinbase/x402/issues)
2. Review [AgentKit Documentation](https://docs.cdp.coinbase.com/agent-kit/welcome)
3. Consult [Strands Agents Docs](https://strandsagents.com/)
4. Check [Bedrock AgentCore Docs](https://docs.aws.amazon.com/bedrock-agentcore/)

When reporting issues, include:
- Error message and stack trace
- Relevant configuration (redact secrets)
- Steps to reproduce
- Environment details (OS, Python version, AWS region)
