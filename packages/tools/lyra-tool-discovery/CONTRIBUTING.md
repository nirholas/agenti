# Contributing to Lyra Tool Discovery

First off, thank you for considering contributing to Lyra Tool Discovery! 🔮

This document provides guidelines and information about contributing to this project. Following these guidelines helps communicate that you respect the time of the developers managing and developing this open source project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Coding Standards](#coding-standards)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)
- [Areas for Contribution](#areas-for-contribution)

## Code of Conduct

This project and everyone participating in it is governed by our commitment to providing a welcoming and inclusive environment. By participating, you are expected to uphold this standard. Please be respectful, constructive, and considerate in all interactions.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally
3. **Set up the development environment** (see below)
4. **Create a branch** for your changes
5. **Make your changes** and test them
6. **Submit a pull request**

## Development Setup

### Prerequisites

- Node.js 18+ (we recommend using [nvm](https://github.com/nvm-sh/nvm))
- pnpm 8+ (`npm install -g pnpm`)
- Git
- An API key from OpenAI or Anthropic (for testing AI features)

### Installation

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/lyra-tool-discovery.git
cd lyra-tool-discovery

# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env

# Edit .env with your API keys
# At minimum, set OPENAI_API_KEY or ANTHROPIC_API_KEY
```

### Running in Development

```bash
# Run CLI in development mode
pnpm dev discover --dry-run

# Run specific commands
pnpm dev analyze-repo modelcontextprotocol servers
pnpm dev providers
pnpm dev templates

# Build the project
pnpm build

# Run the built version
node dist/cli.js discover --help
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

## Project Structure

```
lyra-tool-discovery/
├── src/
│   ├── index.ts          # Main ToolDiscovery class, exports
│   ├── cli.ts            # CLI commands and options
│   ├── ai.ts             # AI analyzer (OpenAI, Anthropic)
│   ├── types.ts          # TypeScript type definitions
│   └── sources/
│       ├── index.ts      # Source exports
│       ├── github.ts     # GitHub source implementation
│       └── npm.ts        # npm source implementation
├── examples/             # Usage examples
├── docs/                 # VitePress documentation
├── dist/                 # Built output (gitignored)
├── package.json
├── tsconfig.json
├── tsup.config.ts        # Build configuration
└── README.md
```

### Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Main entry point, `ToolDiscovery` class |
| `src/cli.ts` | CLI using Commander.js |
| `src/ai.ts` | `AIAnalyzer` class, provider detection, prompts |
| `src/types.ts` | All TypeScript interfaces and types |
| `src/sources/github.ts` | GitHub API integration |
| `src/sources/npm.ts` | npm registry integration |

## Making Changes

### Branch Naming

Use descriptive branch names:

- `feature/add-smithery-source` - New features
- `fix/github-rate-limit` - Bug fixes
- `docs/improve-api-docs` - Documentation
- `refactor/ai-provider-abstraction` - Refactoring
- `test/add-npm-source-tests` - Tests

### Development Workflow

1. **Create a branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** in small, focused commits

3. **Test your changes**:
   ```bash
   pnpm build
   pnpm test
   ```

4. **Run linting** (if configured):
   ```bash
   pnpm lint
   ```

5. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Open a Pull Request** on GitHub

## Coding Standards

### TypeScript

- Use **TypeScript strict mode** (`"strict": true` in tsconfig)
- Prefer **explicit types** over `any`
- Use **interfaces** for object shapes
- Export types from `types.ts`

### Code Style

```typescript
// ✅ Good: Explicit types, JSDoc comments
/**
 * Analyzes a discovered tool and determines the best template
 * @param tool - The tool to analyze
 * @returns Template decision with reasoning
 */
async analyzeAndDecide(tool: DiscoveredTool): Promise<TemplateDecision> {
  // Implementation
}

// ❌ Bad: No types, no documentation
async analyzeAndDecide(tool) {
  // Implementation
}
```

### File Organization

- One class per file (generally)
- Export from `index.ts` files
- Group related types together
- Keep files under 300 lines when possible

### Comments

- Use JSDoc for public APIs
- Add inline comments for complex logic
- Document "why" not "what"

## Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, no code change |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `chore` | Build process, dependencies, etc. |

### Examples

```bash
# Feature
feat(sources): add Smithery source integration

# Bug fix
fix(github): handle rate limit errors gracefully

# Documentation
docs(readme): add programmatic API examples

# Refactor
refactor(ai): extract provider into separate classes
```

## Pull Request Process

1. **Ensure your PR**:
   - Has a clear title following conventional commits
   - Includes a description of what changed and why
   - Links to any related issues
   - Has passing CI checks

2. **PR Description Template**:
   ```markdown
   ## Description
   Brief description of changes

   ## Type of Change
   - [ ] Bug fix
   - [ ] New feature
   - [ ] Breaking change
   - [ ] Documentation update

   ## How Has This Been Tested?
   Describe testing performed

   ## Checklist
   - [ ] My code follows the project style
   - [ ] I have added tests (if applicable)
   - [ ] I have updated documentation (if applicable)
   - [ ] All tests pass locally
   ```

3. **Review Process**:
   - A maintainer will review your PR
   - Address any feedback
   - Once approved, a maintainer will merge

## Reporting Bugs

### Before Submitting

1. Check the [existing issues](https://github.com/nirholas/lyra-tool-discovery/issues)
2. Ensure you're on the latest version
3. Collect information about your environment

### Bug Report Template

```markdown
**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce:
1. Run command '...'
2. With options '...'
3. See error

**Expected behavior**
What you expected to happen.

**Environment**
- OS: [e.g., macOS 14, Ubuntu 22.04]
- Node.js version: [e.g., 20.10.0]
- Package version: [e.g., 0.1.0]
- AI Provider: [e.g., OpenAI]

**Additional context**
Any other relevant information.
```

## Suggesting Features

### Feature Request Template

```markdown
**Is your feature request related to a problem?**
A clear description of the problem.

**Describe the solution you'd like**
What you want to happen.

**Describe alternatives you've considered**
Other solutions you've thought about.

**Additional context**
Any other relevant information, mockups, etc.
```

## Areas for Contribution

Looking for ways to contribute? Here are some areas we'd love help with:

### 🔌 New Discovery Sources

Add support for additional sources:
- **Smithery** - MCP server directory
- **OpenAPI Directory** - Public API specifications
- **RapidAPI** - API marketplace
- **Awesome lists** - Curated GitHub lists

### 🤖 AI Provider Support

Expand AI capabilities:
- **Google Gemini** - Add Gemini API support
- **Mistral** - Add Mistral API support
- **Local models** - Ollama, llama.cpp integration
- **Provider abstraction** - Better provider interface

### 📝 Documentation

Improve docs:
- More examples in `/examples`
- Tutorial guides in `/docs`
- Video walkthroughs
- API reference generation

### 🧪 Testing

Expand test coverage:
- Unit tests for sources
- Integration tests for AI
- E2E tests for CLI
- Mock API responses

### 🛠️ Developer Experience

Improve DX:
- Better error messages
- Progress indicators
- Verbose logging mode
- Config file support

---

## Questions?

Feel free to open an issue with the `question` label or reach out to the maintainers.

Thank you for contributing! 🙏
