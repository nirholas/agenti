# Review Checklist

This checklist helps review changes across the Mogami x402 stack.

Its purpose is to verify that a change is:

- correct
- small enough
- architecturally coherent
- compatible when needed
- understandable by other developers
- safe for the rest of the stack

This checklist is intended for both humans and AI agents.

Do not use it mechanically.

Use it to identify the real risks of a change.

## Core review rule

Do not review a change only for local correctness.

Always review it at the right level:

- local code quality
- repository architecture
- cross-repository impact
- release and migration implications

A change is not good just because the code compiles.

## 1. Change scope

Review the size and scope of the change first.

Ask:

- Is the change as small as it can reasonably be?
- Does it solve one problem clearly?
- Does it mix unrelated refactoring with behavior changes?
- Is the intent of the change obvious?
- Is the blast radius proportional to the problem?

Preferred outcome:

- one clear problem
- one coherent solution
- minimal collateral change

Warning signs:

- broad rewrites without clear need
- renamed files, refactors, and logic changes all mixed together
- large “cleanup” changes in sensitive repositories
- hidden contract changes inside a refactor

## 2. Repository fit

Check whether the change belongs in this repository.

Ask:

- Does this logic belong in this repository?
- Is this concern placed at the right layer?
- Is shared code being added only because it is truly shared?
- Is repository-specific logic leaking into a shared module?
- Is business logic leaking into integration or transport layers?

Preferred outcome:

- the code matches the repository role
- the responsibility is placed where future maintainers would expect it

Warning signs:

- business logic in `x402-commons`
- facilitator-specific logic in the starter
- UI or display concerns in shared contracts
- examples becoming framework libraries

## 3. Simplicity and design

Check whether the solution is simpler than the alternatives.

Ask:

- Is the code easy to read?
- Is the solution more complicated than necessary?
- Did the change introduce abstraction before it was needed?
- Are names simple and explicit?
- Could the same result be achieved with fewer moving parts?

Preferred outcome:

- direct code
- explicit control flow
- small focused types
- simple names

Warning signs:

- generic abstractions with only one use case
- helper or utility classes that hide core logic
- naming that is clever, vague, or abbreviated
- unnecessary framework mechanisms

## 4. Public API and contract safety

Check whether public behavior changed.

Ask:

- Does this change affect any public Java API?
- Does it affect JSON shape, field names, headers, or status codes?
- Does it affect enum values, validation rules, or configuration properties?
- Does it change semantics without changing structure?
- Is backward compatibility preserved?

Preferred outcome:

- additive changes
- compatibility preserved by default
- any public change is explicit and justified

Warning signs:

- renamed public fields
- changed JSON property names
- removed enum values
- stricter validation without migration thinking
- hidden behavior change in a “refactor”

## 5. Cross-repository impact

Check whether the change affects other repositories.

Ask:

- Which other repositories may consume this change?
- Which repositories may produce data affected by this change?
- Is there any hidden coupling through contracts, examples, or docs?
- Does this require follow-up work elsewhere?
- Was release order considered?

Typical repositories to consider:

- `x402-commons`
- `x402-java-client`
- `x402-spring-boot-starter`
- `x402-facilitator`
- `x402-examples`

Preferred outcome:

- downstream impact is identified explicitly
- follow-up work is visible
- the change does not assume isolated release if it is not isolated

Warning signs:

- “local” change in shared contracts treated as isolated
- producer changes merged without consumer review
- examples no longer matching released behavior
- docs silently drifting from reality

## 6. Spring Boot and integration quality

Apply this section when reviewing Spring Boot integration code.

Ask:

- Does the change respect Spring Boot conventions?
- Is auto-configuration predictable?
- Are defaults reasonable and explicit?
- Is annotation behavior understandable?
- Is configuration binding clear and stable?
- Is runtime behavior too magical?

Preferred outcome:

- minimal configuration
- idiomatic Spring Boot integration
- understandable behavior
- stable and explicit configuration surface

Warning signs:

- surprising auto-configuration side effects
- hidden bean wiring complexity
- annotations carrying too much behavior
- breaking configuration changes without deprecation path

## 7. Runtime and operational behavior

Apply this section for facilitator, or runtime-sensitive code.

Ask:

- Does the change alter runtime behavior?
- Are retries, timeouts, caching, or ordering affected?
- Does the change affect observability or traceability?
- Could the change create hidden operational risk?
- Is failure handling still understandable?

Preferred outcome:

- operational behavior remains predictable
- failure modes are visible
- logs, traces, or events stay coherent

Warning signs:

- silent retry changes
- changed ordering assumptions
- trace or event drift
- failure swallowed or obscured
- configuration-dependent behavior not documented

## 8. Validation and nullability

Check whether input handling remains robust and understandable.

Ask:

- Is nullability intentional?
- Are required and optional fields clear?
- Does validation happen in the right place?
- Are error messages understandable?
- Does stricter validation risk rejecting valid legacy inputs?

Preferred outcome:

- validation is narrow, explicit, and predictable
- null handling is deliberate
- constraints are easy to reason about

Warning signs:

- hidden validation side effects
- unclear optionality
- validators doing too much
- new rejection paths without migration consideration

## 9. Persistence and schema safety

Apply this section when schema or storage is involved.

Ask:

- Is the schema change additive when possible?
- Does the migration path make sense?
- Are reads and writes compatible during rollout?
- Are constraints introduced at the right time?
- Is data backfill or compatibility handling needed?

Preferred outcome:

- staged schema evolution
- rollout-aware design
- minimal destructive change

Warning signs:

- destructive schema change mixed with behavior change
- assumptions that all data is already clean
- changed persistence shape without migration note
- rollout plan missing for non-trivial schema changes

## 10. Tests

Check whether tests verify the real risk.

Ask:

- Are tests added or updated where behavior changed?
- Do the tests cover the actual contract or behavior risk?
- Are serialization tests present when contracts change?
- Are integration tests present when wiring or runtime behavior changes?
- Do the tests remain readable?

Preferred outcome:

- focused tests
- tests that verify what could realistically break
- tests aligned with repository role

Warning signs:

- no tests for changed behavior
- only trivial tests for a risky change
- integration-sensitive change with unit tests only
- unreadable tests that mirror implementation details

## 11. Documentation and examples

Check whether the change leaves the repository and stack understandable.

Ask:

- Does documentation need to be updated?
- Do examples still match reality?
- Are configuration changes documented?
- Are public behavior changes described?
- Is migration documentation needed?

Preferred outcome:

- docs reflect the code
- examples remain correct and useful
- user-facing changes are documented

Warning signs:

- examples demonstrating old behavior
- README describing removed configuration
- contract changes without notes
- release-impacting change with no migration note

## 12. Release and migration readiness

Check whether the change is ready to be released safely.

Ask:

- Can this be released independently?
- Does it require a migration note?
- Does it require coordinated releases?
- Is the appropriate version bump obvious?
- Is backward compatibility preserved or explicitly broken?

Preferred outcome:

- release implications are clear
- migration risk is visible before merge
- breakage is not discovered after release

Warning signs:

- unclear release ordering
- shared contract changes without release plan
- breaking change hidden in a minor-looking PR
- no deprecation path where one is possible

## 13. Review summary format

After reviewing, summarize the change clearly.

A good review summary should state:

- whether the change is acceptable as-is
- the main risk areas
- whether compatibility is preserved
- whether other repositories are impacted
- whether docs, tests, or migration notes are missing

Preferred review outcomes:

- approve
- approve with small fixes
- request changes
- block due to architecture or compatibility risk

## Lightweight final checklist

Before approval, verify:

- the change belongs in this repository
- the solution is not more complex than necessary
- public behavior changes are explicit
- cross-repository impact is identified
- tests cover the risk
- docs/examples remain correct
- release implications are understood

## AI agent instructions

When an AI agent reviews a change, it must:

- identify the repository role first
- check for hidden public contract changes
- check for cross-repository impact
- prefer simpler alternatives when appropriate
- mention migration or release implications when relevant
- not approve a change only because it compiles or tests pass

Agents must be especially strict in shared or developer-facing repositories.

Examples:
- `x402-commons`
- `x402-java-client`
- `x402-spring-boot-starter`

## Review philosophy

Good reviews do not optimize for cleverness.

Good reviews optimize for:

- Simplicity
- correctness
- clarity
- compatibility
- maintainability
- coherence across the Mogami stack

When in doubt, prefer the simpler and more explicit change.