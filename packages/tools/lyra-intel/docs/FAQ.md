# Lyra Intel - Frequently Asked Questions

Common questions and answers about Lyra Intel.

## Table of Contents

- [General](#general)
- [Installation & Setup](#installation--setup)
- [Features & Capabilities](#features--capabilities)
- [Performance & Scalability](#performance--scalability)
- [Security & Privacy](#security--privacy)
- [Integration](#integration)
- [Troubleshooting](#troubleshooting)
- [Development](#development)

---

## General

### What is Lyra Intel?

Lyra Intel is a comprehensive code intelligence platform that analyzes codebases to provide insights about code quality, security vulnerabilities, architecture, dependencies, and more. It combines static analysis, ML-powered semantic search, and AI integration to help developers understand and improve their code.

### What languages does it support?

**Core support:**
- Python
- JavaScript/TypeScript
- Go
- Rust
- Java

**Extended parsers:**
- C++ (templates, inheritance, STL)
- C# (async/await, LINQ, properties)
- Ruby (mixins, metaprogramming)
- PHP (traits, namespaces)

### Is it open source?

Yes, Lyra Intel is open source under the MIT License.

### How is it different from other code analysis tools?

**Key differentiators:**
- **Comprehensive**: 70+ components covering analysis, security, metrics, visualization
- **Scalable**: From single files to enterprise monorepos
- **ML-Powered**: Semantic code search using sentence transformers
- **Extensible**: Plugin system for custom analyzers
- **Modern**: WebSocket streaming, React dashboard, IDE extensions
- **Cloud-Ready**: Kubernetes, Terraform, auto-scaling support

---

## Installation & Setup

### What are the system requirements?

**Minimum:**
- Python 3.9+
- 2GB RAM
- 1GB disk space

**Recommended:**
- Python 3.11+
- 8GB RAM
- 10GB disk space
- Redis (for caching)
- PostgreSQL (for production)

### How do I install it?

```bash
# From source
git clone https://github.com/nirholas/lyra-intel.git
cd lyra-intel
pip install -e .

# Or via pip (when published)
pip install lyra-intel
```

### Do I need Redis or PostgreSQL?

**For development:** No, it works with in-memory cache and SQLite.

**For production:** Yes, recommended for performance and persistence.

### Can I run it in Docker?

Yes! Docker and Docker Compose configurations are included:

```bash
docker-compose up
```

---

## Features & Capabilities

### What can Lyra Intel analyze?

- **Code Quality**: Complexity, maintainability, code smells
- **Security**: Vulnerabilities, secrets, OWASP Top 10
- **Dependencies**: Dependency graphs, circular dependencies, vulnerabilities
- **Architecture**: Component relationships, module structure
- **Metrics**: LOC, complexity, test coverage
- **Git History**: Commits, contributors, blame analysis
- **Documentation**: Auto-generate docs from code

### Does it support semantic code search?

Yes! Semantic search uses ML embeddings to find code by meaning, not just keywords:

```python
search.search("authenticate users with OAuth")
# Finds authentication code even if it doesn't mention "OAuth"
```

### Can it detect security vulnerabilities?

Yes, it includes:
- Hardcoded secrets (API keys, passwords)
- SQL injection patterns
- XSS vulnerabilities
- Insecure deserialization
- Path traversal
- Command injection
- Dependency CVEs

### Does it have AI integration?

Yes, supports:
- **OpenAI** (GPT-4, GPT-3.5)
- **Anthropic** (Claude)
- **Local models** (Ollama, llama.cpp)

AI features:
- Code explanation
- Bug detection
- Refactoring suggestions
- Test generation

### Can I create custom analyzers?

Yes! The plugin system allows custom analyzers:

```python
class MyAnalyzer(AnalyzerPlugin):
    def analyze(self, code, language, **kwargs):
        # Your analysis logic
        return {"issues": [...]}
```

---

## Performance & Scalability

### How fast is it?

Typical performance:
- **Small project** (1K files): 30-60 seconds
- **Medium project** (10K files): 5-10 minutes
- **Large project** (100K+ files): 30-60 minutes (with distributed mode)

Single file analysis: < 1 second

### How does it scale for large codebases?

Three scaling modes:

1. **Local Mode**: Single machine (< 10K files)
2. **Distributed Mode**: Multiple workers (10K-100K files)
3. **Cloud Mode**: Auto-scaling infrastructure (100K+ files)

### Does it cache results?

Yes, multi-level caching:
- **L1**: In-memory LRU cache
- **L2**: Redis cache (1 hour TTL)
- **L3**: Database persistence

### Can I run it distributed?

Yes, with multiple workers:

```python
# Coordinator node
coordinator = Coordinator(workers=10)
await coordinator.distribute_analysis(files)

# Worker nodes
worker = Worker(coordinator_url="...")
await worker.start()
```

---

## Security & Privacy

### Is my code sent to external services?

**By default, NO.** All analysis runs locally.

**Optional AI features** may send code snippets to:
- OpenAI API (if configured)
- Anthropic API (if configured)

You can use local AI models (Ollama) for complete privacy.

### How is sensitive data handled?

- Code is **never** logged or persisted without consent
- API keys and secrets are detected but **not stored**
- All data transmission uses TLS 1.3
- Database encryption at rest (AES-256)

### Does it store my code?

Only if you explicitly configure database storage. By default:
- Analysis results are cached (configurable TTL)
- Original code is not stored
- Only metadata and findings are persisted

### What authentication methods are supported?

- **API Keys** (bcrypt hashed)
- **JWT tokens**
- **OAuth 2.0 / OpenID Connect**
- **SAML 2.0**
- **LDAP**

### Is it compliant with security standards?

- OWASP Top 10 coverage
- SARIF 2.1.0 output (GitHub Code Scanning compatible)
- CWE mapping
- CVSS scoring
- SOC 2 compatible architecture

---

## Integration

### Can I integrate with GitHub?

Yes! Multiple integration points:

- **GitHub Actions** (CI/CD)
- **Code Scanning** (SARIF upload)
- **Pull Request comments**
- **Issues creation**

### What about GitLab?

Yes, full GitLab integration:

```python
gitlab = GitLabIntegration(...)
gitlab.comment_on_merge_request(mr_iid=42, comment="...")
gitlab.create_issue(title="...", description="...")
```

### Does it work with Bitbucket?

Yes:

```python
bitbucket = BitbucketIntegration(...)
bitbucket.comment_on_pull_request(pr_id=123, comment="...")
bitbucket.create_build_status(commit_hash="...", state="SUCCESSFUL")
```

### Are there IDE extensions?

Yes:
- **VS Code extension** (TypeScript)
- **JetBrains plugin** (IntelliJ, PyCharm, WebStorm)

Both support:
- Real-time analysis
- Inline warnings
- Security highlighting
- Quick fixes

### Can I export results?

Yes, multiple formats:
- **PDF** (professional reports)
- **SARIF** (GitHub Code Scanning)
- **Excel** (multi-sheet workbooks)
- **CSV** (data analysis)
- **JSON** (programmatic access)

---

## Troubleshooting

### Analysis is slow

**Solutions:**
1. Enable caching (Redis)
2. Exclude unnecessary files (`.gitignore`, config)
3. Use distributed mode
4. Disable AI features for faster analysis

### Out of memory errors

**Solutions:**
1. Increase memory limit
2. Analyze in batches
3. Use streaming mode
4. Exclude large files

### Import errors

**Solutions:**
1. Ensure Python 3.9+ is installed
2. Install all dependencies: `pip install -e .`
3. Check for conflicting packages

### WebSocket connection fails

**Solutions:**
1. Check firewall settings
2. Verify port is not in use
3. Ensure WebSocket server is running
4. Check CORS configuration

### Redis connection errors

**Solutions:**
1. Ensure Redis is running: `redis-cli ping`
2. Check connection URL
3. Verify network access
4. Check Redis authentication

---

## Development

### How do I contribute?

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

### Can I add support for new languages?

Yes! Create a custom parser:

```python
from src.analyzers.base import BaseParser

class MyLanguageParser(BaseParser):
    def parse(self, code):
        # Parse code and return AST
        return ast_data
```

### How do I run tests?

```bash
# Run all tests
pytest

# With coverage
pytest --cov=src tests/

# Specific test file
pytest tests/test_engine.py
```

### Where can I get help?

- **Documentation**: [docs/](.)
- **Examples**: [EXAMPLES.md](EXAMPLES.md)
- **Tutorials**: [TUTORIAL.md](TUTORIAL.md)
- **Issues**: [GitHub Issues](https://github.com/nirholas/lyra-intel/issues)

### How do I report a bug?

Open an issue on GitHub with:
- Description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Python version)
- Log output (if applicable)

### Can I request features?

Yes! Open a feature request issue with:
- Use case description
- Proposed solution
- Why it would be useful
- Examples (if applicable)

---

## Still have questions?

- Check the [complete documentation](.)
- Read the [tutorials](TUTORIAL.md)
- See [code examples](EXAMPLES.md)
- Open an issue on [GitHub](https://github.com/nirholas/lyra-intel/issues)
contact [nich on Github](github.com/nirholas) | [nich on X](x.com/nichxbt)


