# Dependabot configuration
# https://docs.github.com/en/code-security/dependabot/dependabot-version-updates

version: 2
updates:
  # NPM dependencies
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "09:00"
      timezone: "UTC"
    open-pull-requests-limit: 10
    reviewers:
      - "nirholas"
    labels:
      - "dependencies"
      - "npm"
    commit-message:
      prefix: "chore(deps)"
    groups:
      typescript:
        patterns:
          - "typescript"
          - "@types/*"
      testing:
        patterns:
          - "vitest"
          - "@vitest/*"
          - "jest"
          - "@jest/*"
      linting:
        patterns:
          - "eslint"
          - "@eslint/*"
          - "prettier"
      mcp:
        patterns:
          - "@modelcontextprotocol/*"
      viem:
        patterns:
          - "viem"
          - "@viem/*"

  # x402-ecosystem package
  - package-ecosystem: "npm"
    directory: "/packages/x402-ecosystem"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 5
    labels:
      - "dependencies"
      - "x402"

  # GitHub Actions
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 5
    reviewers:
      - "nirholas"
    labels:
      - "dependencies"
      - "github-actions"
    commit-message:
      prefix: "chore(ci)"

  # Docker
  - package-ecosystem: "docker"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 3
    labels:
      - "dependencies"
      - "docker"
