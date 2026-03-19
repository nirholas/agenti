# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x | :white_check_mark: |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

### How to Report

**DO NOT** create a public GitHub issue for security vulnerabilities.

Report security vulnerabilities through one of:

- **GitHub Security Advisories:** [Create a private advisory](https://github.com/nirholas/agenti/security/advisories/new)
- **Email:** Contact the maintainer directly via GitHub

### What to Include

- Type of vulnerability (e.g., XSS, injection, authentication bypass)
- Full path to the affected file(s)
- Step-by-step instructions to reproduce
- Proof-of-concept or exploit code (if possible)
- Impact assessment

### Response Timeline

| Stage | Timeframe |
|-------|-----------|
| Initial acknowledgment | Within 48 hours |
| Status update | Within 7 days |
| Critical fix target | Within 30 days |

We will credit you in the release notes unless you prefer anonymity.

---

## Security Best Practices

### Private Key Security

**NEVER** share your private key or commit it to version control.

```bash
# Use environment variables
export PRIVATE_KEY="your_key_here"

# Or use a .env file (ensure it's in .gitignore)
echo "PRIVATE_KEY=your_key_here" >> .env
```

### Recommended Wallet Setup

1. **Use a dedicated wallet** for AI agent operations with limited funds
2. **Start with testnets** to verify behavior before using mainnet
3. **Monitor transactions** regularly for unexpected activity
4. **Revoke approvals** you no longer need using the built-in revoke tools
5. **Set spending limits** where possible

### API Key Security

- Store API keys in environment variables, never in code
- Use separate keys for development and production
- Rotate keys periodically
- Monitor API usage for anomalies

---

## Security Considerations

### Transaction Signing

Agenti can sign and broadcast transactions when provided with a private key. Users should understand:

- AI agents can initiate **real transactions** with real financial consequences
- Use wallets with **limited funds** appropriate to your use case
- Consider **hardware wallet integration** for high-value operations
- Review the **x402 payment configuration** to set appropriate spending limits

### Data Privacy

- All blockchain data queried is **publicly available** on-chain
- Be cautious about **logging sensitive data** in your application
- Review tool outputs before sharing in public contexts

### Supply Chain

- Dependencies are monitored via **Dependabot** for known vulnerabilities
- Lock files are committed to ensure **reproducible builds**
- Critical dependencies are pinned to **specific versions**

---

## Audit Status

This project has not yet undergone a formal security audit. Use at your own risk. The x402 payment protocol dependencies (`@x402/core`, `@x402/evm`, `@x402/svm`) are maintained by their respective teams.

---

## Staying Updated

Always use the latest version to receive security patches:

```bash
npx @nirholas/agenti@latest
```

Subscribe to [GitHub releases](https://github.com/nirholas/agenti/releases) for security update notifications.
