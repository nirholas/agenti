# Task: Achieve 80% Unit Test Coverage

## Priority: HIGH

## Context
Enterprise-grade projects require comprehensive test coverage. All tool modules in `src/modules/` need unit tests with mocked dependencies.

## Requirements
1. Set up Vitest coverage reporting with Istanbul provider
2. Add unit tests for every tool module in `src/modules/`:
   - Input validation (valid, invalid, edge cases)
   - Successful execution paths
   - Error handling paths
   - Boundary conditions (empty arrays, max values, zero amounts)
3. Mock all external dependencies (RPC calls, API calls, blockchain interactions)
4. Test Zod schema validation independently
5. Add coverage thresholds to CI:
   - Statements: 80%
   - Branches: 75%
   - Functions: 80%
   - Lines: 80%
6. Generate coverage reports in lcov format for CI integration
7. Block PRs that decrease coverage by more than 2%

## Acceptance Criteria
- [ ] Vitest coverage configured with Istanbul
- [ ] Every module in `src/modules/` has test file
- [ ] Coverage thresholds enforced in CI
- [ ] Coverage reports generated per PR
- [ ] 80% statement coverage achieved
