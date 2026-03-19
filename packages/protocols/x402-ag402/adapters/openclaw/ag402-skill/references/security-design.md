# ag402 Security Design

## Security Principles

1. **Validate First** - Always verify payment recipient before sending
2. **Minimal Permissions** - Use dedicated payment wallet
3. **Transaction Verification** - Confirm on-chain before delivering
4. **Audit Trail** - Log all payment attempts

## Budget Limits

> ⚠️ Important: Values must match commands.md. Single source of truth: commands.md

| Setting | Default | Hard Ceiling |
|---------|---------|--------------|
| Single Transaction | $50.00 | $1,000 |
| Daily | $100.00 | $10,000 |
| Per Minute | $20.00 (10 txns) | $100 (50 txns) |

## Payment Confirmation

| Amount | Behavior |
|--------|----------|
| < $10.00 | Auto-confirm |
| >= $10.00 | User confirmation required |

## Key Management

- Keys encrypted with PBKDF2 + AES-256-GCM
- Never stored in plaintext
- Logs always redact keys
- Wallet file permissions: 600 (chmod 600)

## Audit Log

- Location: `~/.ag402/transactions.json`
- Retention: 90 days
- Fields: tx_id, amount, timestamp, endpoint, status, error_message

## Security Checklist

- [x] Validate recipient before payment
- [x] Set spending limits
- [x] Enable payment confirmation for large amounts
- [x] Review transaction history regularly
- [x] Never expose private keys in logs
- [x] Wallet file permissions secured (600)
