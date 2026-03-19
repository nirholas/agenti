# Why AgentCore?

This demo uses AWS Bedrock AgentCore to deploy and manage the payer agent. This document explains the architectural rationale.

## The Problem

Deploying AI agents in production requires solving several infrastructure challenges:

- **Compute**: Where does the agent run? How does it scale?
- **Security**: How do you authenticate callers? How do you protect wallet credentials?
- **State**: How do you maintain conversation context across requests?
- **Operations**: How do you monitor, debug, and maintain the system?

Building this infrastructure from scratch is a significant undertaking. For a demo focused on x402 payment flows, we wanted to minimize time spent on undifferentiated infrastructure work.

## What AgentCore Provides

### Runtime

AgentCore Runtime is a managed compute environment for agents. You upload your agent code as a Python package, and Runtime handles execution, scaling, and lifecycle management.

For this demo, that means:
- No EC2 instances or ECS tasks to configure
- No container images to build and maintain
- Automatic scaling based on invocation volume
- Pay-per-invocation pricing (useful for demos with sporadic traffic)

The alternative would be deploying the agent on Lambda or ECS, which works fine but requires more setup and ongoing maintenance.

### Gateway

AgentCore Gateway provides an API layer in front of the agent with IAM SigV4 authentication.

This is particularly useful because:
- Authentication is handled by AWS IAM, which most enterprise customers already use
- No need to implement custom auth middleware or manage API keys
- Rate limiting is configurable without writing code
- CORS is handled for web client access

The gateway configuration is declarative:

```yaml
gateway:
  authentication:
    type: IAM_SIGV4
  rate_limiting:
    requests_per_second: 10
    burst_capacity: 20
```

### Memory

AgentCore Memory provides managed session state. For a payment agent, this is useful for multi-turn conversations where the agent needs to remember what content was requested and what payments were approved.

Without this, you'd typically use DynamoDB with TTL-based cleanup, which is straightforward but adds another component to manage.

### Secrets Integration

The payer agent needs access to CDP (Coinbase Developer Platform) credentials for wallet operations. AgentCore integrates with Secrets Manager, so the agent can access these credentials without embedding them in code or environment variables.

## What This Means for the Demo

The x402 payment flow is the interesting part of this demo. AgentCore lets us focus on that instead of infrastructure plumbing.

| Component | Without AgentCore | With AgentCore |
|-----------|-------------------|----------------|
| Compute | Lambda + custom handler | Runtime deployment |
| Auth | API Gateway + authorizer | Gateway with SigV4 |
| State | DynamoDB + session logic | Memory service |
| Secrets | Secrets Manager + IAM roles | Built-in integration |
| Monitoring | CloudWatch setup | Included |

This isn't to say the "without AgentCore" approach is bad—it's how most production systems work today. But for a demo, the reduced setup time is valuable.

---

# Why Strands?

The payer agent is built with [Strands Agents SDK](https://strandsagents.com/), an open-source Python framework for building AI agents.

## Tool Definition

Strands uses decorators to define tools. The type hints and docstrings are used to generate the schema that gets passed to the LLM:

```python
@tool
def analyze_payment(amount: str, currency: str, recipient: str) -> dict:
    """Analyze a payment request and decide whether to approve it."""
    # Implementation
    return {"should_pay": True, "reasoning": "..."}
```

This keeps the tool definition close to the implementation, which makes the code easier to follow.

## AgentCore Compatibility

Strands agents can be deployed directly to AgentCore Runtime. The same code that runs locally during development runs in production without modification. This reduces the "works on my machine" problem.

## Async Support

The payer agent makes several network calls—to the seller API, to CDP for wallet operations, potentially to blockchain RPCs. Strands supports async tools, so these calls don't block:

```python
@tool
async def request_content(url: str) -> dict:
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        return {"status": response.status_code, ...}
```

## Alternatives Considered

LangChain and similar frameworks would also work for this use case. We chose Strands because:

1. It's designed to work with AgentCore, which reduces integration friction
2. The tool abstraction is lightweight—tools are just Python functions
3. It's maintained by Amazon, so support and documentation align with AWS services

The payer agent has 6 tools in about 500 lines of Python. Strands doesn't add much overhead to that.
