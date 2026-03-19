# x402 Payer Infrastructure

AWS CDK stack for the payer agent's supporting infrastructure.

## What Gets Deployed

| Resource | Name | Purpose |
|----------|------|---------|
| IAM Role | `x402-payer-agent-runtime-role` | AgentCore Runtime execution |
| IAM Role | `x402-payer-agent-gateway-role` | AgentCore Gateway execution |
| Secret | `x402-payer-agent/cdp-credentials` | CDP API key storage |
| Log Group | `/aws/agentcore/x402-payer-gateway` | Gateway logs |
| Dashboard | `x402-payer-agent-dashboard` | Monitoring |

## Prerequisites

- AWS CLI configured
- Node.js 18+
- AWS CDK CLI (`npm install -g aws-cdk`)

## Deploy

```bash
npm install
cdk bootstrap    # first time only
cdk deploy
```

After deployment, store your CDP credentials:

```bash
aws secretsmanager put-secret-value \
  --secret-id x402-payer-agent/cdp-credentials \
  --secret-string '{
    "CDP_API_KEY_NAME": "your-api-key-name",
    "CDP_API_KEY_PRIVATE_KEY": "your-private-key"
  }'
```

## Monitoring

### Dashboards

Three CloudWatch dashboards are created:

- `x402-enterprise-demo-overview` — End-to-end payment flow metrics
- `x402-payer-agent` — Gateway request rates and throttling
- `x402-seller-infrastructure` — CloudFront and Lambda@Edge metrics

Deploy the observability stack:

```bash
cdk deploy X402ObservabilityStack
```

### Alarms

Rate limiting alarms notify when requests are throttled or approaching limits. Subscribe to notifications:

```bash
aws sns subscribe \
  --topic-arn <RateLimitAlarmTopicArn> \
  --protocol email \
  --notification-endpoint your-email@example.com
```

## OpenTelemetry Tracing

The payer agent includes OpenTelemetry instrumentation with X-Ray support.

### Configuration

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
OTEL_CONSOLE_EXPORT=false  # set true for local debugging
ENVIRONMENT=development
```

### Traced Operations

| Span | Description |
|------|-------------|
| `payment.analyze` | Payment decision logic |
| `payment.sign` | Wallet signature generation |
| `wallet.get_balance` | Balance retrieval |
| `content.request` | Content request (may return 402) |
| `agent.run` | Full agent execution |

## Cleanup

```bash
cdk destroy
```

To immediately delete the secret (bypasses 7-day recovery window):

```bash
aws secretsmanager delete-secret \
  --secret-id x402-payer-agent/cdp-credentials \
  --force-delete-without-recovery
```

## Cost

Estimated < $5/month for development use.
