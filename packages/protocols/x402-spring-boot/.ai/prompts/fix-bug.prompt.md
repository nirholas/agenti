# fix-bug.prompt.md

You are working in a Mogami Java / Spring Boot repository.

Your task is to FIX a bug.

Do not explain theory.
Do not give high-level advice.
Produce concrete fixes.

---

# Objective

Given:
- a bug description
- possibly a stack trace
- possibly some code

You must:

1. Identify the root cause
2. Provide the minimal correct fix
3. Show the exact code changes
4. Explain briefly WHY the bug happened

---

# Core Principles

- Fix the root cause, not the symptom
- Prefer simple fixes over complex rewrites
- Do not introduce unnecessary abstractions
- Preserve existing architecture unless clearly broken
- Do not refactor unrelated code

---

# Expected Output Format

## 1. Root Cause

Explain in 2–4 lines:
- what is wrong
- where it breaks
- why it fails

## 2. Fix

Show ONLY the relevant code changes.

Use small code blocks with context:

```java
// before
...

// after
...
```

Do not dump entire files.

## 3. Notes

Optional, short:
- edge cases
- side effects
- follow-up improvements (only if critical)

---

# Debugging Rules

## Always verify:

- null handling
- incorrect assumptions on data
- wrong types / serialization issues
- transaction boundaries
- concurrency issues
- incorrect equals/hashCode
- time-related bugs (Instant vs LocalDateTime)
- missing validation
- incorrect default values
- mapping issues (DTO ↔ entity)
- off-by-one errors
- index / query mismatch
- missing index causing timeouts mistaken for logic bugs

---

# Spring Boot Specific

## Common pitfalls:

- @Transactional not applied (wrong layer / proxy issue)
- Lazy loading outside transaction
- Wrong bean injected
- Missing @Component / @Service
- Configuration not loaded
- Wrong profile
- circular dependency
- exception swallowed in @Async / scheduler

---

# Liquibase / DB bugs

Check:

- column nullable vs non-null
- missing index
- wrong column type
- wrong constraint
- migration not applied
- case sensitivity (Postgres vs others)
- default values missing

---

# Serialization / API bugs

Check:

- Jackson mapping mismatch
- missing @JsonProperty
- enum mismatch
- date format issues
- missing field in DTO
- backward compatibility issues

---

# x402 / Mogami Specific

Always consider:

- paymentRequirements mismatch
- authorization invalid or expired
- signature verification mismatch
- network mismatch (CAIP-2)
- replay protection failure
- incorrect hashing / payload building
- facilitator response parsing
- incorrect unit (wei vs decimal)
- wrong address normalization

---

# What NOT to do

Do NOT:

- rewrite entire classes
- propose multiple alternative solutions
- introduce frameworks
- add abstraction layers
- change naming conventions
- give vague advice

---

# Style

- Be terse
- Be precise
- Show code
- Fix the bug

---

## Checkstyle review

You must review the PR against the repository checkstyle.

Check explicitly for:
- missing Javadoc
- non-final parameters
- hidden fields
- magic numbers
- inline conditionals
- missing braces
- bad imports
- overlong methods
- too many parameters
- naming violations

If a violation exists:
- classify it
- explain it briefly
- provide corrected code


# Final Rule

If your answer does not include code changes, it is wrong.