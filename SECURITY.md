# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

### How to Report

**DO NOT** create a public GitHub issue for security vulnerabilities.

Instead, please report security vulnerabilities by emailing:

**security@[project-domain]** or directly via [GitHub Security Advisories](https://github.com/nirholas/universal-crypto-mcp/security/advisories/new)

### What to Include

- Type of vulnerability (e.g., XSS, injection, authentication bypass)
- Full path to the affected file(s)
- Step-by-step instructions to reproduce
- Proof-of-concept or exploit code (if possible)
- Impact assessment

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Resolution Target**: Within 30 days for critical issues

### What to Expect

1. We'll acknowledge receipt of your report
2. We'll investigate and validate the issue
3. We'll work on a fix and coordinate disclosure
4. We'll credit you in the release notes (unless you prefer anonymity)

## Security Best Practices for Users

### Private Key Security

⚠️ **NEVER** share your private key with anyone or commit it to version control.

```bash
# Use environment variables
export PRIVATE_KEY="your_key_here"

# Or use a .env file (add to .gitignore!)
echo "PRIVATE_KEY=your_key_here" >> .env
```

### Recommended Setup

1. **Use a dedicated wallet** for AI agent operations
2. **Set spending limits** where possible
3. **Start with testnets** to verify behavior
4. **Monitor transactions** regularly
5. **Revoke approvals** you no longer need

### API Key Security

- Store API keys in environment variables
- Use separate API keys for development and production
- Rotate keys periodically
- Monitor API usage for anomalies

## Known Security Considerations

### Transaction Signing

This MCP server can sign and broadcast transactions when provided with a private key. Users should:

- Understand that AI agents can initiate real transactions
- Use wallets with limited funds
- Consider using hardware wallet integration for high-value operations

### Data Exposure

- Blockchain data is public; queries don't expose additional information
- Be cautious about logging sensitive data
- Review tool outputs before sharing

## Audit Status

This project has not yet undergone a formal security audit. Use at your own risk.

## Security Updates

Security updates will be released as patch versions. We recommend:

```bash
# Always use the latest version
npx @nirholas/universal-crypto-mcp@latest
```

Subscribe to releases to be notified of security updates.
