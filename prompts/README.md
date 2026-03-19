# Quality Improvement Prompts

Self-contained prompts to improve testing, CI, and code quality in Agenti. Each file is an actionable task you can hand to a developer or AI agent.

## Execution Order

Run in this order — later prompts build on earlier ones.

| # | Prompt | Effort | Impact |
|---|--------|--------|--------|
| 01 | [Harden CI Pipeline](01-harden-ci-pipeline.md) | 5 min | CI actually catches failures |
| 02 | [Raise Coverage Thresholds](02-raise-coverage-thresholds.md) | 5 min | Coverage can only go up |
| 03 | [Add Tests to Untested Modules](03-add-tests-untested-modules.md) | 4-8 hrs | 16 modules gain test coverage |
| 04 | [Reusable Tool Test Template](04-reusable-tool-test-template.md) | 1-2 hrs | Stamp out tests for 380+ tools |
| 05 | [Unify ESLint Config](05-unify-eslint-config.md) | 1 hr | Consistent linting across monorepo |
| 06 | [Add Security Scanning](06-add-security-scanning.md) | 30 min | Catch leaked secrets and vuln deps |
| 07 | [Add Mutation Testing](07-add-mutation-testing.md) | 1 hr | Verify tests actually catch bugs |
| 08 | [Improve E2E Tests](08-improve-e2e-tests.md) | 2-4 hrs | Real workflow coverage |
| 09 | [Error Scenario Testing](09-error-scenario-testing.md) | 2-3 hrs | Every failure mode handled |
| 10 | [Performance Benchmarks](10-add-performance-benchmarks.md) | 1-2 hrs | Track speed and memory regressions |
