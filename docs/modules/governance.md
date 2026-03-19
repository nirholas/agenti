# Governance Module

The governance module provides tools for monitoring and participating in on-chain governance across DeFi protocols and DAOs.

## Supported Platforms

| Platform | Type | Coverage |
|----------|------|----------|
| Snapshot | Off-chain voting | 10,000+ DAOs |
| On-chain Governors | On-chain voting | Compound, Aave, Uniswap |
| Tally | Governance aggregation | Multi-protocol |

## Tools

### Proposal Monitoring
- `governance_proposals` - List active/recent proposals for a protocol
- `governance_proposal_detail` - Full proposal details (description, voting options, timeline)
- `governance_proposal_votes` - Vote breakdown and top voters
- `governance_upcoming` - Upcoming governance events

### Voting
- `governance_vote` - Cast a vote on an active proposal
- `governance_delegate` - Delegate voting power to an address
- `governance_voting_power` - Check voting power for an address

### Analytics
- `governance_participation` - Voter participation rates
- `governance_delegates` - Top delegates by voting power
- `governance_history` - Governance action history for a protocol

## Input Schemas

### governance_proposals

```typescript
z.object({
  protocol: z.string().describe('Protocol name (e.g., "aave", "uniswap", "compound")'),
  status: z.enum(['active', 'pending', 'closed', 'all']).default('active'),
  limit: z.number().default(10),
})
```

### governance_vote

```typescript
z.object({
  proposalId: z.string().describe('Proposal ID'),
  support: z.enum(['for', 'against', 'abstain']),
  reason: z.string().optional().describe('Vote reason (shown publicly)'),
})
```

## Response Format

```json
{
  "success": true,
  "data": {
    "proposals": [
      {
        "id": "0x...",
        "title": "Increase USDC Supply Cap on Arbitrum",
        "protocol": "aave",
        "status": "active",
        "forVotes": "2500000",
        "againstVotes": "150000",
        "quorum": "1000000",
        "endTime": "2024-01-20T00:00:00Z",
        "url": "https://app.aave.com/governance/proposal/123"
      }
    ]
  }
}
```

## Common Workflows

### Stay Informed
1. Query `governance_proposals` for protocols you hold tokens in
2. Review details with `governance_proposal_detail`
3. Check community discussion and vote distribution
4. Cast informed vote with `governance_vote`

### Delegation Strategy
1. Review `governance_delegates` for active delegates
2. Check `governance_participation` for delegate track records
3. Delegate voting power to a trusted delegate
