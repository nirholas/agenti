# Lyra Intel Documentation

Complete documentation for Lyra Intel - the comprehensive code intelligence platform.

## 📖 Documentation Index

This folder contains all documentation for Lyra Intel. Start with the guides below based on your needs.

---

## 🚀 Getting Started

**New to Lyra Intel?** Start here:

1. **[⚡ QUICKSTART (Root)](../QUICKSTART.md)** - 5-minute quick start guide
2. **[🔧 INSTALL (Root)](../INSTALL.md)** - Complete installation instructions
3. **[📚 TUTORIAL](TUTORIAL.md)** - Step-by-step tutorials for common tasks

---

## 📚 Core Documentation

### 📖 [FEATURES.md](FEATURES.md)
**Complete feature documentation with code examples**

Covers all 26+ implemented features:
- Semantic Search (ML-powered code search)
- SSO Integration (OAuth 2.0, SAML 2.0, LDAP)
- Language Parsers (C++, C#, Ruby, PHP)
- Plugin System (custom analyzers)
- IDE Extensions (VS Code, JetBrains)
- CI/CD Integrations (GitLab, Bitbucket, GitHub Actions)
- Export Formats (PDF, SARIF, Excel, CSV)
- WebSocket Streaming (real-time updates)
- Interactive CLI (Rich terminal UI)
- Web Dashboard (React + TypeScript)
- Monitoring & Metrics (Prometheus, Grafana)

**Read this for:** Understanding what each feature does and how to use it.

---

### 💻 [EXAMPLES.md](EXAMPLES.md)
**Working code examples for every feature**

Practical, copy-paste examples:
- Quick start (60-second analysis)
- Core analysis workflows
- Semantic search usage
- SSO setup and configuration
- Language-specific parsing
- Custom plugin development
- IDE extension installation
- CI/CD pipeline integration
- Real-time WebSocket streaming
- Monitoring setup
- Complete end-to-end workflows

**Read this for:** Code examples you can copy and modify for your use case.

---

### 🏗️ [ARCHITECTURE.md](ARCHITECTURE.md)
**Technical architecture and design documentation**

Deep dive into system design:
- System overview and high-level architecture
- Core component descriptions
- Data flow diagrams
- Module organization
- Extension points
- Deployment architectures (single server, Kubernetes, AWS)
- Performance & scalability strategies
- Security architecture
- Technology stack

**Read this for:** Understanding how Lyra Intel works internally.

---

### 🔌 [API.md](API.md)
**Complete REST API reference**

Full API documentation:
- Authentication
- Endpoints (analyze, search, export)
- Request/response formats
- Error codes
- Rate limiting
- WebSocket protocol

**Read this for:** Integrating Lyra Intel via REST API.

---

### 🚀 [DEPLOYMENT.md](DEPLOYMENT.md)
**Production deployment guides**

Deployment options:
- Docker & Docker Compose
- Kubernetes & Helm
- AWS (ECS, Fargate, RDS)
- Configuration management
- Environment variables
- Scaling strategies
- High availability
- Backup & recovery

**Read this for:** Deploying Lyra Intel to production.

---

### 📜 [openapi.yaml](openapi.yaml)
**OpenAPI 3.0 specification**

Machine-readable API specification for:
- Code generation
- API testing
- Documentation generation
- SDK development

**Use this for:** Generating clients or importing into API tools.

---

## 📚 Learning Resources

### 📚 [TUTORIAL.md](TUTORIAL.md)
**Step-by-step tutorials**

7 complete tutorials:
1. **First Analysis** - Analyze your first codebase
2. **Security Audit** - Comprehensive security scanning
3. **Semantic Search** - Set up ML-powered code search
4. **CI/CD Integration** - GitHub Actions & GitLab CI
5. **Custom Plugins** - Build custom analyzers
6. **Production Deployment** - Deploy to Kubernetes
7. **Real-time Dashboard** - Set up WebSocket streaming

**Read this for:** Hands-on learning with real-world scenarios.

---

### ❓ [FAQ.md](FAQ.md)
**Frequently asked questions**

Common questions about:
- General information
- Installation & setup
- Features & capabilities
- Performance & scalability
- Security & privacy
- Integration
- Troubleshooting
- Development

**Read this for:** Quick answers to common questions.

---

## 🗂️ Documentation by Use Case

### I want to...

**...get started quickly**
→ [QUICKSTART](../QUICKSTART.md) → [EXAMPLES.md](EXAMPLES.md)

**...understand all features**
→ [FEATURES.md](FEATURES.md) → [ARCHITECTURE.md](ARCHITECTURE.md)

**...integrate with CI/CD**
→ [TUTORIAL.md](TUTORIAL.md) (Tutorial 4) → [EXAMPLES.md](EXAMPLES.md) (CI/CD section)

**...deploy to production**
→ [DEPLOYMENT.md](DEPLOYMENT.md) → [TUTORIAL.md](TUTORIAL.md) (Tutorial 6)

**...create custom analyzers**
→ [TUTORIAL.md](TUTORIAL.md) (Tutorial 5) → [FEATURES.md](FEATURES.md) (Plugin System)

**...use the API**
→ [API.md](API.md) → [openapi.yaml](openapi.yaml)

**...troubleshoot issues**
→ [FAQ.md](FAQ.md) → [GitHub Issues](https://github.com/nirholas/lyra-intel/issues)

**...contribute code**
→ [CONTRIBUTING.md](../CONTRIBUTING.md)

---

## 📊 Documentation Structure

```
docs/
├── README.md           # This file - documentation index
├── FEATURES.md         # Complete feature documentation
├── EXAMPLES.md         # Working code examples
├── ARCHITECTURE.md     # Technical architecture
├── TUTORIAL.md         # Step-by-step tutorials
├── FAQ.md              # Frequently asked questions
├── API.md              # REST API reference
├── DEPLOYMENT.md       # Deployment guides
└── openapi.yaml        # OpenAPI specification

Root directory:
├── README.md           # Project overview
├── QUICKSTART.md       # 5-minute quick start
├── INSTALL.md          # Installation guide
└── CONTRIBUTING.md     # Contribution guidelines
```

---

## 🎯 Quick Links

### By Role

**👨‍💻 Developer**
- [Quick Start](../QUICKSTART.md)
- [Examples](EXAMPLES.md)
- [Tutorial](TUTORIAL.md)

**🏗️ Architect**
- [Architecture](ARCHITECTURE.md)
- [Deployment](DEPLOYMENT.md)
- [Features](FEATURES.md)

**🔒 Security Engineer**
- [Features (Security)](FEATURES.md#security-scanning)
- [Examples (Security)](EXAMPLES.md#security-focused-analysis)
- [Tutorial (Security Audit)](TUTORIAL.md#tutorial-2-security-audit)

**🚀 DevOps Engineer**
- [Deployment](DEPLOYMENT.md)
- [CI/CD Integration](TUTORIAL.md#tutorial-4-cicd-integration)
- [Monitoring](FEATURES.md#monitoring--metrics)

**📊 Data Analyst**
- [API Reference](API.md)
- [Export Formats](FEATURES.md#export-formats)
- [Examples](EXAMPLES.md)

---

## 📈 Documentation Stats

- **Total Pages**: 8 comprehensive documents
- **Code Examples**: 100+ working examples
- **Tutorials**: 7 step-by-step guides
- **API Endpoints**: 15+ documented endpoints
- **Features Covered**: 26+ implemented features
- **Lines of Documentation**: 5,000+ lines

---

## 🆘 Need Help?

- **Quick questions**: Check [FAQ.md](FAQ.md)
- **How-to guides**: See [TUTORIAL.md](TUTORIAL.md)
- **Code examples**: Browse [EXAMPLES.md](EXAMPLES.md)
- **Bug reports**: [GitHub Issues](https://github.com/nirholas/lyra-intel/issues)
- **Feature requests**: [GitHub Issues](https://github.com/nirholas/lyra-intel/issues)

---

## 🔄 Documentation Updates

This documentation covers **Lyra Intel v1.0.0** and is kept up-to-date with each release.

Last updated: December 2025

---

**Ready to get started?** → [Quick Start Guide](../QUICKSTART.md)

contact [nich on Github](github.com/nirholas) | [nich on X](x.com/nichxbt)

