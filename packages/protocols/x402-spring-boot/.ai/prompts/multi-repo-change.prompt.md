# multi-repo-change.prompt.md

You are working on the Mogami x402 stack, which is split across multiple repositories.

Your task is to implement ONE coherent change that may impact several repositories.

Do not answer with high-level advice.
Do not stop at architecture discussion.
Produce the actual changes.

---

# Objective

Given a feature, bug fix, refactor, protocol change, or contract change that spans multiple repositories, you must:

1. Identify which repositories are impacted
2. Explain the impact on each repository
3. Define the correct implementation order
4. Produce the concrete changes for each repository
5. Keep the change coherent across the full stack

You must think in terms of end-to-end compatibility, not isolated repository edits.

---

# Expected Output Format

## 1. Impacted repositories

List only the repositories that are actually impacted.

For each repository, give:
- why it is impacted
- what must change

Example:

- `x402-commons`
    - shared DTO or protocol contract changes
- `x402-java-client`
    - request building / parsing changes
- `x402-spring-boot-starter`
    - server-side verification / annotation / auto-config changes
- `x402-facilitator`
    - settlement / verification / API / persistence changes
- `mogami-examples`
    - example integration updates

## 2. Change order

Define the safest implementation order.

The default reasoning is usually:
1. shared contracts
2. producer/consumer protocol code
3. server-side validation
4. persistence or facilitator changes
5. UI/console changes
6. examples and docs

Explain dependencies briefly.

## 3. Repository-by-repository changes

For each impacted repository, provide concrete changes.

Use this structure:

### `<repository-name>`

#### Files to change
- `path/to/file`
- `path/to/file`

#### Changes
Provide actual code or diff-style snippets.
Do not stay abstract.

#### Notes
Short and concrete:
- compatibility issue
- migration issue
- rollout risk
- test requirement

## 4. Compatibility / rollout notes

State clearly:
- whether the change is backward compatible
- whether it requires a coordinated release
- whether feature flags or versioning are needed
- whether examples/docs must be updated immediately

Keep this short.

---

# Core Principles

- Fix the real cross-repo change, not only one local symptom
- Shared contracts must change first
- Avoid breaking compatibility accidentally
- Keep naming aligned across repositories
- Prefer small coherent changes over broad rewrites
- Do not refactor unrelated code
- Do not invent architecture that does not exist

---

# Multi-repo reasoning rules

## 1. Start from the contract

For any cross-repo change, identify first:
- shared DTOs
- protocol payloads
- JSON models
- database events
- public Java APIs
- Spring Boot properties
- starter annotations / auto-config contracts

If the contract changes, downstream repositories must be updated consistently.

## 2. Track producer and consumer sides

For any payload, header, event, or persisted object:
- who produces it?
- who consumes it?
- who validates it?
- who stores it?
- who displays it?

Your solution must cover the full chain.

## 3. Think in compatibility modes

Always decide whether the change is:

- fully backward compatible
- backward compatible with fallback
- breaking

If breaking, say it clearly and explain how to roll it out safely.

## 4. Do not break examples

If a public SDK or starter changes, examples must be updated too.
Examples are part of the product.

## 5. Console / observability changes are real changes

If the protocol, persistence model, or trace structure changes:
- check whether the console must be updated
- check whether logs, trace DTOs, or display models must change

## 6. Starters must remain predictable

If the change affects Spring Boot starter behavior:
- update auto-configuration
- update properties
- update tests for enable/disable and bean override behavior
- do not introduce hidden behavior

---

# What to look for by repository

## mogami-x402-commons

Typical changes:
- shared DTOs
- enums
- protocol objects
- utility types
- serialization annotations
- validation annotations
- constants

Rules:
- keep public contracts explicit
- avoid unnecessary helper abstractions
- preserve naming consistency

## mogami-x402-java-client

Typical changes:
- payment requirements fetching
- payload building
- signature generation
- request headers
- response parsing
- validation
- error translation

Rules:
- client code must remain explicit
- do not hide protocol concepts
- preserve backward compatibility when possible

## mogami-x402-spring-boot-starter

Typical changes:
- annotation behavior
- request verification
- filters/interceptors
- configuration properties
- auto-configuration
- HTTP response generation
- payment requirement exposure

Rules:
- keep starter behavior predictable
- document any new property or default
- test bean creation conditions

## mogami-facilitator

Typical changes:
- REST API
- settlement verification
- persistence schema
- retry behavior
- outbox/event processing
- trace generation
- blockchain integration

Rules:
- fail clearly
- preserve operational traceability
- keep DB migrations safe
- think about idempotency and locking

## mogami-console

Typical changes:
- trace DTOs
- event rendering
- filters
- search fields
- timeline display
- API integration
- backend/frontend DTO mapping

Rules:
- if a new field matters operationally, surface it
- if an old field changes semantics, update the UI explicitly

## mogami-examples

Typical changes:
- demo payment flows
- starter usage examples
- client usage examples
- README snippets
- sample configs

Rules:
- examples must compile
- examples must reflect the real public API
- examples must not teach deprecated usage

## mogami-playground

Typical changes:
- demo endpoints
- request/response contract changes
- visible sample flows
- documentation snippets

Rules:
- playground behavior must match the current stack contract
- update visible sample code if public usage changed

---

# Required engineering discipline

## 1. Show actual code

If your answer does not contain code or diff-level changes per impacted repository, it is incomplete.

## 2. Minimize unrelated churn

Change only what is necessary for the cross-repo feature.

## 3. Preserve naming consistency

Same concept -> same name everywhere.

Do not use:
- `paymentReq` in one repo
- `paymentRequirements` in another
- `requirementsPayload` in a third

Pick one name and keep it.

## 4. Keep versioning explicit

If the change affects public contracts, mention:
- release order
- version bump expectation
- migration need

## 5. Mention tests

For each impacted repository, mention the tests to add or update when relevant.

---

# What NOT to do

Do NOT:
- answer only with architecture commentary
- only list repositories without code changes
- ignore downstream consumers
- propose vague “update docs/tests as needed”
- refactor unrelated files
- invent repositories not present in the stack
- skip compatibility analysis

---

# Style

- Be terse
- Be concrete
- Think end-to-end
- Show the real changes
- Treat examples and console as first-class parts of the stack

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

A multi-repo change is not complete until:
- contracts are aligned
- producers and consumers are aligned
- examples are aligned
- tests are aligned
- rollout risk is stated clearly