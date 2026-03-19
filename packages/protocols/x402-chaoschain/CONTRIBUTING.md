# Contributing to ChaosChain-x402

Thank you for your interest in contributing to ChaosChain-x402! This project aims to decentralize the x402 payment facilitator using Chainlink CRE and ERC-8004 Proof-of-Agency.

## 🎯 Project Vision

We're building the **decentralized facilitator layer** for the x402 protocol, replacing centralized payment verification and settlement servers with Byzantine Fault Tolerant (BFT) consensus via Chainlink CRE.

This enables:
- Trustless agent-to-agent payments
- Censorship-resistant verification
- Cryptographic proofs for transparency
- Universal facilitator infrastructure for the entire x402 ecosystem

## 🚀 Getting Started

### Prerequisites

- **Bun** 1.2.21+ (for TypeScript)
- **Python** 3.9+ (for Python client)
- **Git**
- **Basic understanding of:**
  - x402 protocol (see [Coinbase's repo](https://github.com/coinbase/x402))
  - Blockchain concepts (EIP-712, ERC-20, etc.)
  - TypeScript and/or Python

### Development Setup

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/chaoschain-x402.git
   cd chaoschain-x402
   ```

2. **Install dependencies:**
   ```bash
   # HTTP Bridge
   cd http-bridge
   bun install
   cd ..

   # TypeScript Client
   cd clients/ts
   bun install
   cd ../..

   # Python Client
   cd clients/py
   pip install -e ".[dev]"
   cd ../..

   # CRE Workflow
   cd workflows/x402-facilitator
   bun install
   cd ../..
   ```

3. **Run the development environment:**
   ```bash
   # Terminal 1: Start HTTP bridge
   cd http-bridge
   bun run dev

   # Terminal 2: Run TypeScript demo
   cd examples/ts-demo
   bun run dev

   # Terminal 3: Run Python demo
   cd examples/py-demo
   python demo.py
   ```

## 🧩 Project Structure

```
chaoschain-x402/
├── workflows/x402-facilitator/   # CRE workflow (TypeScript)
├── http-bridge/                   # REST API server (Fastify)
├── clients/
│   ├── ts/                        # TypeScript client library
│   └── py/                        # Python client library
├── examples/
│   ├── ts-demo/                   # TypeScript usage example
│   └── py-demo/                   # Python usage example
├── diagrams/                      # Architecture documentation
└── docs/                          # Additional documentation
```

## 📝 How to Contribute

### 1. Issues

Before starting work, check our [issue tracker](https://github.com/ChaosChain/chaoschain-x402/issues) or create a new issue describing:
- **Bug reports:** What's broken and how to reproduce it
- **Feature requests:** What you'd like to see and why
- **Questions:** Ask about architecture, design decisions, or implementation

### 2. Pull Requests

We follow a standard fork-and-pull-request workflow:

1. **Fork the repository** and create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following our coding standards (see below)

3. **Test your changes:**
   ```bash
   # TypeScript
   cd clients/ts
   bun run typecheck
   bun run build

   # Python
   cd clients/py
   pytest
   black chaoschain_x402_client
   mypy chaoschain_x402_client
   ```

4. **Commit with clear messages:**
   ```bash
   git commit -m "feat: add support for new network"
   # or
   git commit -m "fix: resolve timeout in verify endpoint"
   # or
   git commit -m "docs: update README with new examples"
   ```

5. **Push and create a PR:**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Open a Pull Request** with:
   - Clear description of changes
   - Reference to related issues
   - Screenshots/examples if relevant

### 3. Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `refactor:` Code refactoring
- `test:` Test additions or changes
- `chore:` Build process or tooling changes

## 🎨 Coding Standards

### TypeScript

- Use **strict mode** (`strict: true` in `tsconfig.json`)
- Write **type-safe code** with explicit types
- Follow **ESLint** and **Prettier** configurations
- Add **JSDoc comments** for public APIs
- Use **async/await** over raw Promises

**Example:**
```typescript
/**
 * Verifies an x402 payment via decentralized consensus.
 * 
 * @param paymentHeader - Base64 encoded payment payload
 * @param requirements - Payment requirements from resource server
 * @returns Verification response with consensus proof
 */
async verifyPayment(
  paymentHeader: string,
  requirements: PaymentRequirements
): Promise<VerifyResponse> {
  // Implementation
}
```

### Python

- Follow **PEP 8** style guide
- Use **type hints** for all functions
- Format with **Black** (line length 88)
- Type-check with **mypy**
- Write **docstrings** for all public functions

**Example:**
```python
def verify_payment(
    self,
    payment_header: str,
    payment_requirements: dict,
) -> VerifyResponse:
    """
    Verify an x402 payment via decentralized consensus.

    Args:
        payment_header: Base64 encoded payment payload
        payment_requirements: Payment requirements from resource server

    Returns:
        Verification response with consensus proof
    """
    # Implementation
```

### CRE Workflows

- Add **clear comments** explaining workflow logic
- Mark **TODO sections** for production upgrades
- Use **runtime.log()** for debugging
- Keep handlers **pure and deterministic**

## 🔒 Important Note: CRE Private Alpha

**Chainlink CRE is currently in private alpha.** This means:

- ✅ We can publish **workflow templates and structure**
- ✅ We can publish **simulate mode implementations**
- ✅ We can document **the architecture and flow**
- ❌ We **cannot publish** real CRE deployment credentials
- ❌ We **cannot share** private alpha binaries or keys

If you have access to the CRE private alpha and want to contribute production-ready implementations:

1. **Contact the maintainers** before starting work
2. **Use a private branch** for any code using real CRE endpoints
3. **Never commit** API keys, RPC URLs, or deployment credentials
4. **Keep sensitive implementations** separate until CRE goes public

See [`workflows/x402-facilitator/README.md`](./workflows/x402-facilitator/README.md) for guidance on the simulate-to-production upgrade path.

## 🎯 Contribution Ideas

### High Priority

- [ ] Add support for additional blockchains (Polygon, Arbitrum, Optimism)
- [ ] Implement `upto` payment scheme (variable amounts based on usage)
- [ ] Add comprehensive test coverage for clients
- [ ] Create end-to-end integration tests
- [ ] Write guides for integrating with resource servers

### Medium Priority

- [ ] Add Docker Compose setup for local development
- [ ] Create Kubernetes deployment manifests
- [ ] Implement caching layer for verification results
- [ ] Add monitoring and observability (Prometheus/Grafana)
- [ ] Build a simple web UI for facilitator status

### Documentation

- [ ] Write tutorials for common use cases
- [ ] Create video walkthroughs
- [ ] Document production deployment best practices
- [ ] Add troubleshooting guides
- [ ] Translate docs to other languages

## 🐛 Reporting Bugs

When reporting bugs, please include:

1. **Description:** Clear description of the issue
2. **Steps to reproduce:** Minimal code to reproduce the problem
3. **Expected behavior:** What should happen
4. **Actual behavior:** What actually happens
5. **Environment:** OS, Bun/Node version, etc.
6. **Logs:** Relevant error messages or stack traces

## 💡 Feature Requests

When proposing features, please include:

1. **Use case:** Why is this feature needed?
2. **Proposed solution:** How would it work?
3. **Alternatives:** What other approaches did you consider?
4. **Impact:** Who benefits from this feature?

## 🔐 Security

If you discover a security vulnerability:

1. **DO NOT** open a public issue
2. **Email** sumeet.chougule@nethermind.io with details
3. Include steps to reproduce and potential impact
4. We'll respond within 48 hours

See [SECURITY.md](./SECURITY.md) for our full security policy.

## 📜 License

By contributing to ChaosChain-x402, you agree that your contributions will be licensed under the MIT License.

## 🙏 Recognition

All contributors will be:
- Listed in our [README.md](./README.md) acknowledgments
- Mentioned in release notes for their contributions
- Invited to the ChaosChain contributors channel

## 📞 Getting Help

- **Discord:** [ChaosChain Community] (Coming soon)
- **GitHub Discussions:** Use for questions and discussions
- **Email:** sumeet.chougule@nethermind.io
- **X/Twitter:** [@Ch40sChain](https://x.com/Ch40sChain)

## 🌟 Code of Conduct

We are committed to providing a welcoming and inclusive environment. Please:

- Be respectful and professional
- Welcome newcomers and help them get started
- Focus on constructive feedback
- Assume good intentions
- Report unacceptable behavior to maintainers

## 🎓 Learning Resources

New to x402 or CRE? Check these out:

- [x402 Whitepaper](https://www.x402.org/x402-whitepaper.pdf)
- [Chainlink CRE Documentation](https://docs.chain.link/cre)
- [ERC-8004 Specification](https://eips.ethereum.org/EIPS/eip-8004)
- [ChaosChain SDK](https://github.com/ChaosChain/chaoschain-sdk-ts)

---

**Thank you for contributing to the decentralized future of agent payments!** 🚀

Questions? Open an issue or reach out to the maintainers.

