# Contributing to Daydreams

First off, thank you for considering contributing to Daydreams! It's people like
you that make Daydreams such a great tool. 🎉

## 🤝 Code of Conduct

By participating in this project, you are expected to uphold our Code of
Conduct:

- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive criticism
- Assume good intentions

## 🚀 How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates.
When you create a bug report, include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples**
- **Include your environment details** (OS, Node version, etc.)
- **Attach relevant logs or screenshots**

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an
enhancement suggestion:

- **Use a clear and descriptive title**
- **Provide a detailed description of the proposed enhancement**
- **Include examples of how it would be used**
- **Explain why this enhancement would be useful**

### Your First Code Contribution

Unsure where to begin? You can start by looking through these issues:

- [`good first issue`](https://github.com/daydreamsai/daydreams/labels/good%20first%20issue) -
  issues which should only require a few lines of code
- [`help wanted`](https://github.com/daydreamsai/daydreams/labels/help%20wanted) -
  issues which need extra attention

## 📝 Development Process

1. **Fork the repo** and create your branch from `main`
2. **Make your changes** in your forked repository
3. **Add tests** for any new functionality
4. **Ensure all tests pass** by running `pnpm test`
5. **Update documentation** if needed
6. **Submit a pull request**

### Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/daydreams.git
cd daydreams

# Add upstream remote
git remote add upstream https://github.com/daydreamsai/daydreams.git

# Install dependencies
pnpm install

# Build packages
pnpm build:packages

# Run tests
pnpm test

# Run linting
pnpm lint

# Run type checking
pnpm typecheck
```

### Commit Messages

We follow the [Conventional Commits](https://www.conventionalcommits.org/)
specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types:

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that don't affect the meaning of the code
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `chore`: Changes to the build process or auxiliary tools

Example:

```
feat(core): add support for custom memory providers

Implement the ability to use custom memory providers instead of the default in-memory storage.
This allows for persistent storage across agent restarts.

Closes #123
```

### Pull Request Process

1. **Update the README.md** with details of changes to the interface, if
   applicable
2. **Update the documentation** with any new functionality
3. **Add tests** to cover your changes
4. **Ensure all tests pass** on your machine
5. **Update any relevant examples**
6. The PR will be merged once you have the sign-off of two maintainers

## 🏗️ Project Structure

```
daydreams/
├── packages/
│   ├── core/          # Core agent framework
│   ├── cli/           # Command line interface
│   ├── providers/     # LLM and blockchain providers
│   └── ...           # Other packages
├── examples/          # Example implementations
├── docs/             # Documentation website
└── tests/            # Integration tests
```

## 📚 Style Guides

### TypeScript Style Guide

- Use TypeScript for all new code
- Follow the existing code style
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Prefer `const` over `let` when possible
- Use async/await over promises when possible

### Documentation Style Guide

- Use Markdown for documentation
- Reference code with backticks: `functionName()`
- Include code examples where helpful
- Keep language simple and clear
- Update docs with any API changes

## 🐛 Testing

- Write tests for all new features
- Ensure all tests pass before submitting PR
- Aim for high test coverage
- Use descriptive test names

```typescript
describe("Agent", () => {
  it("should execute a simple goal successfully", async () => {
    // Test implementation
  });
});
```

## 🔍 Review Process

All submissions require review. We use GitHub pull requests for this purpose.
The review process:

1. A maintainer will review your PR
2. They may request changes or ask questions
3. Once approved, your PR will be merged
4. Your contribution will be acknowledged in the release notes

## 🎉 Recognition

Contributors are recognized in several ways:

- Added to the
  [Contributors list](https://github.com/daydreamsai/daydreams/graphs/contributors)
- Mentioned in release notes
- Special recognition for significant contributions

## ❓ Questions?

Feel free to:

- Open an issue with your question
- Reach out on [Discord](https://discord.gg/rt8ajxQvXh)
- Tweet us [@daydreamsagents](https://twitter.com/daydreamsagents)

Thank you for contributing to Daydreams! 🚀
