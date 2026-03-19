# Task Types

This document defines the main task types used across the Mogami x402 stack.

Its purpose is to help developers and AI agents choose the right approach for a task.

Different tasks require different levels of caution, analysis, testing, and coordination.

Do not treat all tasks the same way.

A small local bug fix should not be handled like a shared contract migration.

## Core rule

Before starting work, identify the task type.

Then adapt:

- analysis depth
- implementation strategy
- testing strategy
- documentation updates
- migration or release thinking
- cross-repository coordination

## General task workflow

For any non-trivial task, the expected workflow is:

1. identify the repository role
2. identify the task type
3. identify affected contracts, APIs, configs, schemas, or examples
4. propose the smallest valid change
5. identify testing needs
6. identify documentation needs
7. identify release or migration implications

Do not jump directly into code without classifying the task.

## 1. Bug Fix

### Definition

A change intended to correct behavior that is wrong, broken, inconsistent, or incomplete.

### Typical examples

- a validator accepts invalid input
- a payment field is serialized incorrectly
- a Spring Boot property is ignored
- a trace field is missing in a known scenario
- an example no longer works as documented

### Expected approach

- reproduce or clearly identify the faulty behavior
- fix the smallest possible area
- avoid mixing refactor with bug fixing
- verify whether the bug is local or contract-related

### Key questions

- Is the bug local to this repository?
- Does the fix affect public behavior?
- Does the fix tighten validation or compatibility?
- Do downstream repositories depend on the old behavior?

### Expected outputs

- small focused code change
- tests covering the broken case
- explicit note if behavior changes for downstream users

### Common mistakes

- hiding behavior change inside a bug fix
- broad cleanup mixed into the fix
- breaking compatibility while “correcting” behavior

## 2. Small Additive Feature

### Definition

A new capability added without intentionally breaking existing behavior.

### Typical examples

- adding an optional field to a contract
- adding support for a new configuration property
- exposing an additional trace attribute
- adding a new helper method to a public API
- adding a new example scenario

### Expected approach

- prefer additive changes
- preserve old behavior
- keep the scope narrow
- document new public elements

### Key questions

- Is the feature truly additive?
- Does it affect a shared contract?
- Do examples or docs need updates?
- Can consumers ignore the new capability safely?

### Expected outputs

- implementation
- tests for new behavior
- documentation update where relevant

### Common mistakes

- sneaking in semantic changes
- making a new field required too early
- over-designing for hypothetical future features

## 3. Shared Contract Change

### Definition

A change that affects shared DTOs, JSON structures, enums, validation rules, headers, or public model semantics used across repositories.

### Typical examples

- changing `paymentRequirements`
- adding a field to a shared trace model
- modifying `networkId` handling
- adding or changing x402 version support
- changing shared validation annotations

### Expected approach

- treat as high blast radius
- prefer additive change
- identify all producers and consumers
- plan rollout before implementation

### Key questions

- Which repositories consume this contract?
- Which repositories produce it?
- Is backward compatibility preserved?
- Does this require migration notes or coordinated release?

### Expected outputs

- contract change
- compatibility notes
- downstream impact list
- tests for serialization, validation, and compatibility

### Common mistakes

- treating a shared contract like local code
- renaming fields directly
- tightening validation without ecosystem review
- forgetting examples or documentation

## 4. Repository Refactor

### Definition

A structural code improvement intended to improve readability, maintainability, or internal design without changing external behavior.

### Typical examples

- extracting a class
- simplifying service logic
- renaming internal methods
- reducing duplication inside a module
- reorganizing package structure without contract change

### Expected approach

- preserve semantics
- keep public behavior unchanged
- separate refactor from feature work when possible
- keep the change reviewable

### Key questions

- Is this truly behavior-preserving?
- Does it alter public API or JSON output accidentally?
- Is the refactor needed now?
- Is the new structure simpler?

### Expected outputs

- behavior-preserving code cleanup
- tests proving unchanged behavior where relevant
- no silent contract change

### Common mistakes

- changing behavior during refactor
- renaming public elements casually
- making code more abstract but not simpler

## 5. Spring Boot Integration Change

### Definition

A change affecting the starter, auto-configuration, annotations, configuration properties, request interception, bean wiring, or application integration behavior.

### Typical examples

- adding a new property
- changing default bean behavior
- modifying annotation-based endpoint protection
- changing auto-configuration conditions
- changing request processing flow

### Expected approach

- respect Spring Boot conventions
- preserve predictable developer experience
- avoid hidden magic
- validate behavior from an application point of view

### Key questions

- Is the integration still simple to use?
- Are defaults clear and stable?
- Does configuration remain backward compatible?
- Does the behavior become more magical or less understandable?

### Expected outputs

- implementation
- integration tests
- property and annotation documentation updates

### Common mistakes

- business logic leaking into configuration layers
- surprising defaults
- too much behavior hidden in annotations or bean wiring

## 6. Runtime or Operational Change

### Definition

A change affecting runtime behavior, settlement flows, retries, ordering, observability, trace emission, caching, or production behavior.

### Typical examples

- changing retry logic
- altering settlement sequencing
- changing trace emission timing
- modifying event generation
- changing cache behavior

### Expected approach

- analyze runtime implications explicitly
- preserve observability
- verify operational side effects
- document changed behavior when relevant

### Key questions

- Does this affect reliability, ordering, or traceability?
- Are logs, traces, or events still coherent?
- Could this change make failures harder to diagnose?
- Does this require operational validation?

### Expected outputs

- implementation
- targeted tests
- explicit note on runtime behavior changes
- doc update if operators or integrators are affected

### Common mistakes

- changing operational behavior without saying so
- swallowing failures
- changing trace semantics silently

## 7. Schema or Persistence Change

### Definition

A change affecting database schema, persistence models, indexes, constraints, or stored data compatibility.

### Typical examples

- adding a column
- changing constraints
- changing trace storage format
- introducing a new table
- backfilling derived data

### Expected approach

- prefer additive schema changes
- think in rollout stages
- separate schema migration from semantic rewrites when possible
- keep compatibility in mind for live systems

### Key questions

- Can the schema evolve additively?
- Are reads and writes compatible during rollout?
- Is data backfill needed?
- Does this require migration notes?

### Expected outputs

- schema migration
- persistence changes
- validation plan
- compatibility notes if relevant

### Common mistakes

- destructive changes too early
- schema rewrite mixed with business rewrite
- assuming existing data already matches new rules

## 8. Example or Documentation Task

### Definition

A change whose primary purpose is to improve understanding, onboarding, demonstration, or documentation.

### Typical examples

- adding a new runnable example
- updating a README
- documenting a payment flow
- clarifying configuration usage
- updating migration guidance

### Expected approach

- optimize for clarity
- keep examples runnable and focused
- align docs with actual released behavior
- avoid hiding important concepts behind helpers

### Key questions

- Does this make the system easier to understand?
- Does the example reflect current reality?
- Is the scope of the example obvious?
- Is the documentation precise enough to run or use the feature?

### Expected outputs

- updated doc or example
- runnable validation when relevant
- instructions for what to observe

### Common mistakes

- examples that are too abstract
- docs that describe unreleased behavior
- educational material polluted with unnecessary architecture

## 9. Review Task

### Definition

A task focused on reviewing an existing change rather than implementing one.

### Typical examples

- reviewing a pull request
- checking compatibility risk
- checking architectural fit
- checking migration or release readiness

### Expected approach

- identify repository role first
- review for local correctness and stack impact
- use the review checklist
- summarize the real risks clearly

### Key questions

- Is the change correct?
- Is it in the right repository?
- Is it more complex than necessary?
- Does it affect shared contracts or release order?
- Are tests, docs, and examples sufficient?

### Expected outputs

- review summary
- risk summary
- approve / request changes / block decision

### Common mistakes

- reviewing only style
- ignoring cross-repository impact
- approving because tests pass without checking contracts

## 10. Migration Task

### Definition

A task whose purpose is to evolve behavior, contracts, schema, or integrations across compatibility boundaries.

### Typical examples

- transitioning from one contract shape to another
- introducing a new x402 version
- replacing a configuration model
- moving from old trace semantics to new trace semantics
- introducing a compatibility layer before cleanup

### Expected approach

- use staged rollout
- prefer additive support first
- identify producer and consumer order
- define compatibility window explicitly

### Key questions

- Can old and new behavior coexist temporarily?
- Which repositories must change first?
- What is the release order?
- What must be documented for migration?

### Expected outputs

- migration plan
- implementation
- compatibility notes
- release sequencing notes
- follow-up cleanup tasks

### Common mistakes

- trying to switch everything at once
- no migration note
- no compatibility layer when one is possible

## 11. Release Preparation Task

### Definition

A task focused on preparing a repository or several repositories for publication.

### Typical examples

- preparing release notes
- checking version bump correctness
- validating release order
- verifying examples and docs before release
- checking compatibility assumptions

### Expected approach

- think at stack level
- verify dependencies and downstream usage
- ensure docs and examples match the release
- make release order explicit

### Key questions

- Is this release independent or coordinated?
- What version bump is appropriate?
- Are downstream repositories ready?
- Are migration notes needed?

### Expected outputs

- release summary
- release notes
- release order
- validation checklist

### Common mistakes

- releasing a shared change as if it were local
- forgetting example or doc updates
- unclear versioning relative to actual risk

## Task classification hints

Use these hints when a task is ambiguous.

If the task changes visible behavior, it is not just a refactor.

If the task affects shared models, it is a shared contract change even if the code diff is small.

If the task affects rollout sequencing, it is at least partly a migration or release task.

If the task affects developer configuration or annotations, it is a Spring Boot integration task.

If the task affects traces, retries, ordering, or settlement behavior, it is a runtime or operational task.

A task may belong to more than one type.

In that case, the strictest relevant rules apply.

## Expected task summary format

Before implementation, summarize the task like this:

### Task type
One or more types from this document.

### Repository role
What this repository does in the stack.

### Scope
What will change.

### Risk level
Low, medium, or high.

### Compatibility impact
None, additive, behavior change, or breaking.

### Other repositories impacted
Explicit list if any.

### Required outputs
Code, tests, docs, migration notes, release notes, examples, or review summary.

## AI agent instructions

When an AI agent receives a task, it must first classify it using this document.

The agent must not treat all tasks as generic coding work.

The task type determines:

- how much caution is required
- whether compatibility must be checked
- whether migration or release planning is needed
- what tests and docs are expected
- whether downstream repositories must be mentioned

When several task types apply, the agent must follow the strictest relevant guidance.

## Final rule

Choose the smallest valid task framing that is honest.

Do not inflate a local fix into a redesign.

Do not downplay a cross-repository contract change as a small edit.