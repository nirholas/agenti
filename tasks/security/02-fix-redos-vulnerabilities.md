# Task: Fix All ReDoS Vulnerabilities

## Priority: HIGH

## Context
Multiple locations use `new RegExp()` with unsanitized user input, enabling Regular Expression Denial of Service attacks.

## Affected Files
- `src/modules/ai-prompts/index.ts:531` — template variable replacement
- `src/hosting/runtime.ts:47` — prompt template processing
- `src/vendors/tatum-api/api-client.ts:95` — URL parameter replacement
- `src/modules/tool-marketplace/verification/security-scanner.ts:61` — malware detection patterns

## Requirements
1. Create a shared utility function `escapeRegExp(str: string): string` that escapes all regex special characters
2. Apply it to every instance where user input flows into `new RegExp()`
3. Alternatively, replace `new RegExp` usage with `String.prototype.replaceAll()` or `String.prototype.split().join()` where appropriate
4. Add fuzz tests with adversarial regex inputs (e.g., `(a+)+b`, `.*.*.*.*`)
5. Add an ESLint rule or custom lint to flag future `new RegExp()` usage without escaping

## Acceptance Criteria
- [ ] All identified ReDoS vectors fixed
- [ ] `escapeRegExp` utility created and unit tested
- [ ] Fuzz tests for template processing pass
- [ ] Lint rule prevents regressions
