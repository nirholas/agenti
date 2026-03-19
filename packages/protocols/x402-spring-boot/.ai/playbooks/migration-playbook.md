# Migration Playbook

This document explains how to design and roll out changes across the Mogami x402 stack without creating unnecessary breakage.

It applies to any change that may affect more than one repository, including:

- shared contracts
- JSON payloads
- DTOs
- validation rules
- configuration properties
- database schemas
- trace or event formats
- public Java APIs
- x402 version handling
- cross-repository integration behavior

The goal is to make migrations:

- small
- explicit
- reversible when possible
- backward compatible by default
- easy to understand for both developers and AI agents

## Core rule

Prefer additive change over breaking change.

Prefer staged rollout over atomic rewrite.

Prefer compatibility windows over synchronized releases.

Do not introduce a breaking change unless there is a clear and justified reason.

## Migration mindset

When a change affects multiple repositories, do not think only about the local implementation.

Always think about:

- who produces the data
- who consumes the data
- who validates the data
- who stores the data
- who displays the data
- who depends on the old behavior

A migration is complete only when the whole system remains coherent.

## Types of migrations

Typical migrations in Mogami include:

### Shared contract migration

Examples:

- adding a field to a shared DTO
- renaming a JSON property
- changing nullability
- changing an enum
- changing field meaning

### API migration

Examples:

- changing request or response shape
- changing headers
- changing status codes
- introducing a new endpoint version
- changing payment requirement semantics

### Validation migration

Examples:

- stricter field validation
- new required constraints
- changing accepted formats
- changing network id validation
- changing x402 version support

### Persistence migration

Examples:

- adding a database column
- changing constraints
- splitting a table
- changing indexes
- changing trace storage format

### Spring Boot integration migration

Examples:

- changing annotation behavior
- changing auto-configuration
- adding or renaming properties
- changing bean defaults
- changing request interception behavior

### Event or trace migration

Examples:

- adding trace fields
- changing event structure
- changing ordering assumptions
- changing identifiers or correlation fields

## Migration process

Every migration should follow the same process.

### 1. Define the reason

Start by stating:

- what is changing
- why the change is needed
- what problem it solves
- why a non-breaking approach is or is not possible

Keep this explicit.

### 2. Identify impact

List all impacted repositories and components.

For each migration, identify:

- producer repositories
- consumer repositories
- shared libraries affected
- storage affected
- tests affected
- documentation affected
- examples affected

Typical impacted repositories may include:

- x402-commons
- mogami-x402-java-client
- mogami-x402-spring-boot-starter
- mogami-facilitator
- mogami-console
- mogami-examples

### 3. Classify the change

Classify the migration as one of the following:

- additive and backward compatible
- behavior change but backward compatible
- soft breaking change
- hard breaking change

Use the lightest classification that is honest.

### 4. Prefer staged rollout

When possible, apply migrations in phases.

Preferred order:

1. add support for the new shape
2. keep support for the old shape
3. migrate producers
4. migrate consumers
5. remove legacy behavior later

This is the default migration strategy.

## Preferred migration patterns

### Additive field migration

Preferred pattern:

- add a new optional field
- keep existing fields unchanged
- update consumers to tolerate both old and new payloads
- later make the new field standard if needed

Avoid:

- renaming a field directly
- changing a required field in place
- changing JSON semantics silently

### Enum migration

Preferred pattern:

- add new enum values only when consumers can tolerate unknown values
- ensure downstream logic does not fail unexpectedly
- document meaning clearly

Avoid:

- removing enum values abruptly
- reusing an existing enum value with a different meaning

### Validation tightening

Preferred pattern:

- first detect and observe invalid legacy data if relevant
- introduce warnings or compatibility handling if needed
- tighten validation only after downstream readiness

Avoid:

- suddenly rejecting values that may already exist in the ecosystem

### API evolution

Preferred pattern:

- preserve existing endpoint behavior
- add optional request or response elements
- introduce a new version only when semantic differences are substantial

Avoid:

- changing meaning of an existing field without versioning
- reusing an endpoint for incompatible semantics

### Schema evolution

Preferred pattern:

- add nullable columns first when possible
- backfill data if needed
- switch reads and writes progressively
- make constraints stricter only after data is ready

Avoid:

- destructive schema changes without rollout planning
- combining schema rewrite and business rewrite in one step

### Configuration evolution

Preferred pattern:

- add new properties
- preserve old properties during a compatibility window
- emit clear deprecation guidance
- document default behavior explicitly

Avoid:

- silently changing defaults that alter runtime behavior

## Backward compatibility rules

Backward compatibility is the default expectation.

Unless explicitly justified otherwise:

- do not rename public fields
- do not remove public fields
- do not remove enum values
- do not change JSON property names
- do not make an optional field required
- do not change a public method signature lightly
- do not change validation rules unexpectedly
- do not change external behavior silently

If a breaking change is unavoidable, document it clearly and contain it.

## Breaking changes

A breaking change must be treated as exceptional.

When proposing one, explicitly document:

- what breaks
- who is impacted
- why additive migration is insufficient
- what migration path exists
- whether a compatibility layer is possible
- when legacy support will be removed

Breaking changes should normally be paired with:

- versioning
- release notes
- migration notes
- explicit downstream update tasks

## Migration template

For any non-trivial migration, write a short migration note using this structure.

### Title

A short explicit title.

### Reason

Why the migration exists.

### Scope

Which repositories, modules, APIs, schemas, or contracts are affected.

### Change type

One of:

- additive
- behavior change
- soft breaking
- hard breaking

### Old behavior

What existed before.

### New behavior

What exists after the migration.

### Compatibility strategy

How old and new behavior can coexist.

### Rollout plan

Step-by-step rollout sequence.

### Risks

What may fail or become inconsistent.

### Validation plan

How to verify the migration.

### Cleanup plan

What legacy code or compatibility logic can later be removed.

## Example migration note

### Title

Add `networkId` to payment trace contracts

### Reason

Trace consumers need a normalized network identifier to correlate activity across chains.

### Scope

- x402-commons
- mogami-facilitator
- mogami-console
- mogami-examples

### Change type

Additive

### Old behavior

Payment traces do not expose `networkId`.

### New behavior

Payment traces may include `networkId` as an optional field.

### Compatibility strategy

Consumers must tolerate trace payloads with or without `networkId`.

### Rollout plan

1. Add optional field in shared contracts.
2. Update facilitator to emit it.
3. Update console to display it when present.
4. Update examples and documentation.
5. Consider future validation after adoption.

### Risks

Some consumers may incorrectly assume the field is always present.

### Validation plan

- serialization tests
- consumer compatibility tests
- UI rendering verification

### Cleanup plan

None initially.

## Cross-repository rollout rules

When a migration affects several repositories:

- update shared contracts first
- then update producers
- then update consumers
- then update examples
- then update documentation

Do not merge a local change without considering its downstream effect.

When possible, use separate pull requests per repository with explicit linkage.

## Pull request expectations for migrations

Migration pull requests should explicitly include:

- what changed
- whether compatibility is preserved
- which repositories are impacted
- what must be released in what order
- what tests were added or updated
- whether follow-up cleanup is required

A migration PR should be understandable without oral context.

## Documentation expectations

Every meaningful migration should update the relevant documentation, including when needed:

- architecture documents
- repository contracts
- examples
- configuration docs
- release notes

If users of the stack need to adapt their code, add migration notes.

## AI agent instructions

When an AI agent performs a migration, it must:

- minimize the blast radius
- preserve compatibility by default
- identify downstream impact explicitly
- prefer staged rollout
- avoid silent semantic changes
- mention follow-up repositories and release order

Agents must not treat a local refactor as isolated when the repository participates in shared contracts.

## Final checklist

Before considering a migration complete, verify:

- the reason is documented
- impacted repositories are identified
- compatibility was evaluated
- rollout order is clear
- tests cover the changed behavior
- examples remain valid
- documentation is updated
- cleanup work is identified if needed