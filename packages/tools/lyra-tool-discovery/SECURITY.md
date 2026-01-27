# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

### How to Report

1. **Do NOT open a public GitHub issue** for security vulnerabilities
2. Email security concerns to: [security@nirholas.dev](mailto:security@nirholas.dev)
3. Include as much detail as possible:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Any suggested fixes

### What to Expect

- **Acknowledgment**: We will acknowledge receipt within 48 hours
- **Assessment**: We will assess the vulnerability and determine severity within 1 week
- **Resolution**: We will work on a fix and coordinate disclosure timing with you
- **Credit**: We will credit you in the security advisory (unless you prefer to remain anonymous)

### Scope

This security policy applies to:

- The `lyra-tool-discovery` npm package
- The CLI tool (`lyra-discover`)
- The official documentation site

### Out of Scope

- Third-party dependencies (please report to the respective maintainers)
- Issues in forks or unofficial distributions
- Social engineering attacks

## Security Best Practices

When using Lyra Tool Discovery:

### API Keys

- **Never commit API keys** to version control
- Use environment variables or secure secret management
- Rotate keys regularly
- Use the minimum required permissions

```bash
# ✅ Good: Use environment variables
export OPENAI_API_KEY="sk-..."

# ❌ Bad: Never hardcode in scripts
const ai = new AIAnalyzer({ apiKey: "sk-..." });
```

### GitHub Tokens

- Use fine-grained personal access tokens when possible
- Grant only necessary permissions (public repo read access is sufficient)
- Set token expiration dates

### CI/CD

When using in GitHub Actions:

```yaml
# ✅ Good: Use GitHub Secrets
env:
  OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}

# ❌ Bad: Never expose in logs
run: echo $OPENAI_API_KEY
```

## Dependency Security

We regularly update dependencies to address security vulnerabilities. You can check for known vulnerabilities:

```bash
# Check for vulnerabilities
pnpm audit

# Update dependencies
pnpm update
```

## Changelog

Security-related changes will be noted in the [CHANGELOG.md](./CHANGELOG.md) with a 🔒 icon.
