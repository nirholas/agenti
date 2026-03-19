# x402-commons Copilot Instructions

## Purpose
This repository provides the Spring Boot starter used to protect APIs with x402 payment requirements.

Its main responsibilities are:

- exposing simple Spring Boot integration for x402
- auto-configuring the required components
- protecting endpoints with minimal developer effort
- keeping application integration simple and predictable

This repository is an integration layer between Spring Boot applications and the Mogami x402 stack.

## System context

This repository follows Mogami standards.

### Mandatory standards
- .ai/standards/checkstyle-rules.md
- .ai/standards/java-style.md
- .ai/standards/naming-rules.md
- .ai/standards/spring-boot-rules.md
- .ai/standards/testing-rules.md

### Prompts
- .ai/prompts/fix-bug.prompt.md
- .ai/prompts/review-pr.prompt.md
- .ai/prompts/multi-repo-change.prompt.md
- .ai/prompts/add-liquibase-migration.prompt.md

### Architecture
- .ai/context/repo-map.md

### Rules
- Code that violates standards is invalid
- Prefer simplicity, readability, and explicitness

## Main responsibilities
This repository may contain:

- shared domain models
- request and response contracts
- shared DTOs
- shared enums
- shared validation annotations and validators
- shared constants
- shared utility classes only when they are broadly reusable and clearly justified

This repository must remain small, stable, and easy to understand.

## Design principles
When generating code for this repository, always prioritize:

1. simplicity
2. readability
3. beauty
4. performance

Prefer explicit code to clever code.

Avoid unnecessary abstraction.

Avoid introducing framework-specific behavior unless it is already part of the repository design.

## What to avoid
- Do not introduce code that is specific to only one downstream repository unless there is a strong shared need.
- Do not add business logic that belongs in client, facilitator, server, or console.
- Do not add persistence logic.
- Do not add HTTP client/server behavior unless this repository is explicitly designed to hold shared transport
  contracts.
- Do not add Spring-specific components unless already consistent with the module purpose.
- Do not add dependencies without strong justification.
- Do not break public contracts unless the prompt explicitly asks for a breaking change.

## Backward compatibility
Assume all public classes, records, enums, JSON fields, validators, and constants may already be used by other
repositories.

When modifying an existing type:
- preserve backward compatibility by default
- do not rename public fields lightly
- do not remove constructors, accessors, or enum values lightly
- do not change serialized JSON shape unless explicitly requested
- do not change validation behavior without considering downstream impact

If a change may affect compatibility, explicitly mention:
- what changed
- which repositories may be impacted
- whether a migration is required

## Naming rules
Use simple, explicit, full English names.
Choose expressive names to abbreviations.
Good names are short but clear.

Examples:

- `paymentRequirements`
- `networkId`
- `facilitatorUrl`

Avoid vague names like:

- `data`
- `info`
- `object`

## API and model rules
Prefer immutable models when possible.

If the repository already uses records for DTO-like structures, prefer records for new DTO-like types.

Keep models focused.

Do not mix unrelated concerns into the same class.

When adding fields to shared contracts:

- ensure names are explicit
- ensure nullability is intentional
- preserve JSON compatibility
- document semantics in Javadoc when the meaning is not obvious

## Validation rules
Validation must be predictable and easy to reason about.

Custom validation annotations and validators should:

- have clear names
- validate one concern
- produce understandable error messages
- avoid hidden side effects

Do not create overly generic validators when a narrow validator is clearer.

## Utility class rules
Only add a utility class when:

- the logic is reused across multiple modules
- the responsibility is obvious
- the API is small and stable

Prefer a focused utility over a large catch-all utility class.

Do not create `Utils` classes that accumulate unrelated methods.

## Dependencies
Treat every new dependency as costly.

Before adding a dependency, prefer:

- existing repository dependencies
- plain Java
- small local code

Only add a dependency if it meaningfully improves correctness or maintainability.

## Testing expectations
When changing code in this repository:

- add or update unit tests when behavior changes
- cover serialization/deserialization when contracts change
- cover validation logic when validators change
- cover edge cases for shared utility code

Tests should be simple, direct, and readable.

## Output expectations
When proposing a change:

- keep the change set as small as possible
- preserve existing style
- show concrete code, not only high-level advice
- mention downstream impact when relevant
- mention compatibility risks when relevant