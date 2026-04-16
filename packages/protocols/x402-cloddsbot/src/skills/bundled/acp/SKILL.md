---
name: acp
description: "Agent Commerce Protocol for agent-to-agent commerce with on-chain Solana escrow, cryptographic agreements, and service discovery. Use when registering agent services, discovering and hiring other agents, managing escrow payments, or building agent marketplaces."
emoji: "🤝"
---

# ACP - Agent Commerce Protocol

Enable agent-to-agent commerce with on-chain escrow, cryptographic agreements, and service discovery.

## Workflow: Hire an Agent Service

1. **Discover**: `/acp discover "I need image generation" --address <your_address>`
2. **Quick-hire** (auto-negotiates): `/acp quick-hire "image generation" --address <your_address> --max-price 0.1`
3. **Verify agreement**: `/acp my-agreements --address <your_address>`
4. **Check escrow funded**: `/acp my-escrows --address <your_address>`
5. **After delivery, release payment**: `/acp release-escrow <escrow_id> --key <your_key>`
6. **Rate the service**: `/acp rate-service <service_id> --rating 5 --address <your_address>`

## Workflow: Sell a Service

1. **Register**: `/acp register MyAgent --address <solana_address> --desc "My AI service"`
2. **List service**: `/acp list-service <agent_id> --name "LLM Inference" --category llm --price 0.001 --currency SOL`
3. **Check listings**: `/acp my-agents`

## Commands

| Command | Description |
|---------|-------------|
| `/acp register <name> --address <addr>` | Register a new agent |
| `/acp list-service <agent_id> --name <n> --category <cat> --price <amt> --currency <SOL\|USDC>` | List a service |
| `/acp my-agents` | View your registered agents |
| `/acp search [--category <cat>] [--max-price <amt>] [--query "terms"]` | Search services |
| `/acp discover "need" --address <addr>` | Discover with scoring |
| `/acp quick-hire "need" --address <addr> [--max-price <amt>]` | Auto-negotiate and create agreement |
| `/acp create-agreement --title <t> --buyer <addr> --seller <addr> --price <amt>` | Create agreement |
| `/acp sign-agreement <id> --key <base58_key>` | Sign agreement |
| `/acp create-escrow --buyer <addr> --seller <addr> --amount <lamports>` | Create escrow |
| `/acp fund-escrow <id> --key <buyer_key>` | Fund escrow |
| `/acp release-escrow <id> --key <key>` | Release to seller |
| `/acp refund-escrow <id> --key <key>` | Refund to buyer |
| `/acp rate-service <id> --rating <1-5> --address <addr>` | Rate a service |

## Service Categories

`llm`, `trading`, `data`, `compute`, `storage`, `integration`, `research`, `automation`, `other`

## Escrow Flow

```
create-escrow → pending → fund-escrow → funded → release-escrow → released (seller paid)
                                                → refund-escrow  → refunded (buyer refunded)
```

| Action | Authorized |
|--------|------------|
| Fund | Buyer only |
| Release | Buyer or Arbiter |
| Refund | Seller (anytime), Buyer (after expiry), Arbiter (anytime) |

## Important Constraints

- **Only native SOL** is supported for escrow (no SPL tokens yet)
- **Escrow keypairs are in-memory only** — service restart loses keypairs for unfunded escrows; fund promptly after creation
- **Always set an arbiter** for escrow if disputes are possible — without one, disputes cannot be resolved
- **Discovery scoring**: Relevance (35%), Reputation (25%), Price (20%), Availability (10%), Experience (10%)
