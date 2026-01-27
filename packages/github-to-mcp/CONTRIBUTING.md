# Contributing to GitHub to MCP

Thank you for your interest in contributing to GitHub to MCP! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Pull Request Process](#pull-request-process)
- [Code Style Guide](#code-style-guide)
- [Testing Requirements](#testing-requirements)
- [Issue Guidelines](#issue-guidelines)

## Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to [security@example.com].

## Getting Started

### Prerequisites

- Node.js 22.x or later (see `.nvmrc`)
- pnpm 10.x or later
- Git 2.x or later

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/github-to-mcp.git
   cd github-to-mcp
   ```
3. Add the upstream remote:
   ```bash
   git remote add upstream https://github.com/nirholas/github-to-mcp.git
   ```

## Development Setup

### Install Dependencies

```bash
pnpm install
```

### Build Packages

```bash
pnpm build
```

### Run Development Server

```bash
pnpm dev
```

### Project Structure

```
github-to-mcp/
├── apps/
│   └── web/                 # Next.js web application
│       ├── app/             # App router pages
│       ├── components/      # React components
│       ├── hooks/           # Custom hooks
│       ├── lib/             # Utilities
│       └── types/           # TypeScript types
├── packages/
│   ├── core/                # Main conversion engine
│   │   └── src/
│   │       ├── index.ts     # Main exports
│   │       ├── cli.ts       # CLI entry point
│   │       ├── github-client.ts
│   │       ├── readme-extractor.ts
│   │       ├── code-extractor.ts
│   │       └── types.ts
│   └── openapi-parser/      # OpenAPI spec parser
│       └── src/
│           ├── parser.ts
│           ├── analyzer.ts
│           ├── transformer.ts
│           └── generator.ts
└── docs/                    # Documentation
```

## Making Changes

### Branch Naming

Use descriptive branch names:
- `feat/add-python-support` - New features
- `fix/handle-rate-limit` - Bug fixes
- `docs/update-api-reference` - Documentation
- `refactor/extract-utils` - Code refactoring
- `test/add-integration-tests` - Test additions

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Formatting, no code change
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Maintenance tasks

Examples:
```
feat(core): add Python MCP decorator extraction
fix(web): handle rate limit errors gracefully
docs(api): update generateFromGithub examples
```

## Pull Request Process

### Before Submitting

1. **Sync with upstream**:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Run all checks**:
   ```bash
   pnpm build
   pnpm test
   pnpm lint
   pnpm typecheck
   ```

3. **Update documentation** if needed

4. **Add a changeset** (for user-facing changes):
   ```bash
   pnpm changeset
   ```
   This will prompt you to describe your change and select the semver bump type.

### PR Requirements

- [ ] All tests pass
- [ ] No TypeScript errors
- [ ] Linting passes
- [ ] Documentation updated (if applicable)
- [ ] Changeset added (for user-facing changes)
- [ ] PR description explains the change

### Pre-commit Hooks

This project uses Husky to run pre-commit checks automatically. When you commit:
- TypeScript/TSX files are linted with ESLint
- JSON, Markdown, and YAML files are formatted with Prettier

If a check fails, fix the issues before committing.

### Review Process

1. A maintainer will review your PR within 3 business days
2. Address any requested changes
3. Once approved, a maintainer will merge

## Code Style Guide

### TypeScript

- Use TypeScript strict mode
- Prefer `const` over `let`
- Use explicit return types for public functions
- Use interface over type for object shapes
- No `any` types (use `unknown` if necessary)

```typescript
// Good
export function parseReadme(content: string): ParseResult {
  // ...
}

// Bad
export function parseReadme(content) {
  // ...
}
```

### React Components

- Use functional components with hooks
- Props interface should be named `{ComponentName}Props`
- Use semantic HTML elements
- Include accessibility attributes

```typescript
interface ButtonProps {
  variant?: 'primary' | 'secondary';
  onClick: () => void;
  children: React.ReactNode;
}

export function Button({ variant = 'primary', onClick, children }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant }))}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}
```

### File Organization

- One component per file
- Co-locate tests with source files
- Export from index files
- Keep files under 300 lines

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files | kebab-case | `github-client.ts` |
| Components | PascalCase | `CodeBlock.tsx` |
| Functions | camelCase | `parseReadme()` |
| Constants | UPPER_SNAKE | `MAX_RETRIES` |
| Types/Interfaces | PascalCase | `ConversionResult` |

## Testing Requirements

### Test Structure

```
src/
├── module.ts
└── module.test.ts
```

### Running Tests

```bash
# All tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage
pnpm test:coverage
```

### Test Guidelines

1. **Unit tests** for pure functions
2. **Integration tests** for API routes
3. **E2E tests** for critical user flows

```typescript
import { describe, it, expect } from 'vitest';
import { parseGitHubUrl } from './utils';

describe('parseGitHubUrl', () => {
  it('should parse valid GitHub URLs', () => {
    const result = parseGitHubUrl('https://github.com/owner/repo');
    expect(result).toEqual({ owner: 'owner', repo: 'repo' });
  });

  it('should return null for invalid URLs', () => {
    const result = parseGitHubUrl('not-a-url');
    expect(result).toBeNull();
  });
});
```

### Coverage Requirements

- Minimum 80% line coverage
- 100% coverage for critical paths (parsing, generation)

## Issue Guidelines

### Bug Reports

Include:
- Node.js version
- pnpm version
- Operating system
- Steps to reproduce
- Expected vs actual behavior
- Error messages/logs

### Feature Requests

Include:
- Use case description
- Proposed solution
- Alternatives considered
- Willingness to implement

### Questions

For questions, use:
- GitHub Discussions (preferred)
- Stack Overflow with tag `github-to-mcp`

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing! 🎉
