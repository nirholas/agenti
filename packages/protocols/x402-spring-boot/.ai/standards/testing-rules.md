# Testing Rules (Mogami)

This document defines the testing conventions for all Mogami repositories.

The goal is simple:
write tests that are useful, stable, fast enough, and easy to trust.

Tests are part of the product.
Unreadable tests, fragile tests, or slow tests reduce delivery speed instead of improving quality.

This is not a generic testing guide.
It is an opinionated rule set for Mogami.

---

# 1. Core Principles

Always optimize for:

1. Confidence
2. Clarity
3. Stability
4. Speed
5. Maintainability

A good test should:
- fail for one clear reason
- be easy to read
- be deterministic
- verify behavior that matters
- help debugging when it fails

A bad test:
- passes by accident
- verifies implementation details
- is flaky
- is hard to understand
- is expensive without adding confidence

---

# 2. What to Test

Prioritize tests that verify:

- business rules
- protocol behavior
- serialization/deserialization contracts
- boundary validation
- persistence queries that matter
- transaction-sensitive workflows
- external client behavior
- regressions from real bugs

For Mogami specifically, high-value tests include:
- payment requirement validation
- authorization validation
- signature verification behavior
- expiration checks
- replay protection
- network compatibility
- facilitator interaction behavior
- JSON contract stability
- configuration binding
- outbox/event processing behavior
- failure handling and retries when relevant

Do not spend the same energy testing trivial code and critical code.
Test depth should follow risk.

---

# 3. Testing Pyramid

Use the smallest test type that gives enough confidence.

Preferred order:

1. Unit tests
2. Integration tests
3. End-to-end tests

The default should be:
- many unit tests
- a controlled number of slice/integration tests
- very few full end-to-end tests

If a test can be written as a unit test, do not automatically make it a Spring Boot integration test.

---

# 4. Test Types

## 4.1 Unit Tests

Use unit tests for:
- pure business logic
- validators
- mapping logic
- parsers
- calculators
- protocol rules
- state transitions
- error condition logic

Unit tests should:
- run fast
- avoid Spring when unnecessary
- avoid the database
- avoid the network
- avoid file system dependence unless the file itself is the thing being tested

Good examples:
- authorization expiration validation
- x402 header parsing
- payment payload creation
- retry policy decision logic
- mapper correctness
- replay check decision behavior

## 4.2 Slice Tests

Use focused Spring slice tests when framework behavior matters.

Typical examples:
- `@WebMvcTest` for controller behavior
- `@JsonTest` for Jackson serialization
- `@DataJpaTest` for repository behavior

Use slice tests for:
- request/response binding
- HTTP validation
- JSON shape
- repository queries
- persistence mappings

Slice tests should stay narrow.
Do not turn them into mini end-to-end tests.

## 4.3 Integration Tests

Use integration tests when the interaction between multiple real components matters.

Examples:
- service + repository + transaction behavior
- startup wiring for a starter
- outbox persistence and processing flow
- external client against a controlled mock server
- property binding + bean creation + service behavior

Integration tests are valuable, but must be intentional.
They are more expensive and usually more fragile than unit tests.

## 4.4 End-to-End Tests

Use end-to-end tests sparingly.

Good uses:
- a critical full payment flow
- a full paywalled endpoint workflow
- a critical starter integration path
- a known production-sensitive flow that needs top-level protection

Do not try to prove every behavior through end-to-end tests.

---

# 5. Naming Rules

Test names must describe behavior, not implementation.

Good:
- `shouldRejectExpiredAuthorization()`
- `shouldReturnPaymentRequirementsForSupportedNetwork()`
- `shouldFailWhenSignatureDoesNotMatchPayload()`
- `shouldPersistOutboxEventWhenSettlementIsAccepted()`

Bad:
- `testAuthorization()`
- `test1()`
- `verifyPayment()`
- `paymentServiceTest()`

A test name should answer:
- what is the condition?
- what is the expected result?

---

# 6. Structure of a Test

Tests must stay easy to scan.

Prefer a clear structure:

- given
- when
- then

Example:

```java
@Test
void shouldRejectExpiredAuthorization() {
    Instant now = Instant.parse("2026-03-18T10:00:00Z");
    Authorization authorization = authorization(expiredAt = now.minusSeconds(1));

    boolean valid = authorizationValidator.isValid(authorization, now);

    assertThat(valid).isFalse();
}
```

Use blank lines to separate phases when helpful.

Do not over-ceremonialize tiny tests.
But do keep the execution flow obvious.

---

# 7. One Test, One Reason to Fail

A test should fail for one clear reason.

Avoid giant tests that verify too many things at once.

Bad:
- verify status
- verify event count
- verify three mappings
- verify logs
- verify persistence
- verify a callback

all in one test unless the behavior is genuinely one atomic end-to-end scenario.

If a test failure could mean five different causes, the test is too broad.

---

# 8. Assertions

## 8.1 Prefer Strong Assertions

Assertions must be specific.

Good:
```java
assertThat(response.status()).isEqualTo(PaymentStatus.ACCEPTED);
assertThat(result.networkId()).isEqualTo("eip155:8453");
assertThat(events).hasSize(1);
```

Weak:
```java
assertThat(response).isNotNull();
```

## 8.2 Assert the Meaningful Outcome

Assert what matters for the behavior.

Do not assert irrelevant details just because they are available.

## 8.3 Group Assertions Carefully

Grouped assertions are acceptable when they describe one coherent outcome.

Example:
```java
assertThat(response)
        .extracting(
                PaymentVerificationResponse::accepted,
                PaymentVerificationResponse::networkId,
                PaymentVerificationResponse::reason)
        .containsExactly(true, "eip155:8453", null);
```

But avoid unreadable assertion blocks that are harder than the production code.

## 8.4 Prefer AssertJ-Style Readability

Use assertion style that is expressive and easy to read.
In Mogami projects, AssertJ-style assertions are generally preferred.

---

# 9. Test Data

## 9.1 Keep Test Data Small and Intentional

Test data should be minimal but realistic enough.

Only include the fields needed to understand the scenario.

Avoid giant fixtures with unrelated data.

## 9.2 Use Builders / Factories Carefully

Shared test factories are good when they reduce noise without hiding intent.

Good:
- `AuthorizationTestData.validAuthorization()`
- `PaymentRequirementsTestData.baseRequirements()`

Bad:
- one giant generic factory that hides half the scenario
- fixture methods with dozens of defaults nobody understands

## 9.3 Defaults Must Be Safe

A default test object should be:
- valid
- obvious
- easy to customize

Then each test changes only what matters.

## 9.4 Prefer Local Overrides

Make the scenario visible in the test.

Good:
```java
Authorization authorization = validAuthorization()
        .withExpiresAt(now.minusSeconds(1));
```

This is usually better than a distant hidden fixture mutation.

---

# 10. Determinism

Tests must be deterministic.

Avoid dependence on:
- current time
- random values without control
- environment-specific behavior
- network availability
- test execution order
- database residue from previous tests

## 10.1 Time

Never depend on `Instant.now()` directly in tests when the behavior is time-sensitive.

Use:
- fixed `Instant`
- injected `Clock`
- controlled test helper

Good:
```java
Clock clock = Clock.fixed(Instant.parse("2026-03-18T10:00:00Z"), ZoneOffset.UTC);
```

## 10.2 Randomness

If randomness is needed:
- use a fixed seed
- make the generated values stable
- or prefer explicit values

## 10.3 Order Independence

Tests must not depend on execution order.
Each test must set up its own state.

---

# 11. Mocking Rules

## 11.1 Mock Only Real Boundaries

Mock when crossing a real boundary:
- HTTP client
- blockchain client
- external facilitator
- file storage
- email sender
- clock, if useful

Do not mock everything inside the application by default.

## 11.2 Prefer Real Value Objects

Use real DTOs, value objects, and mappers when possible.

Mocking simple internal objects usually makes tests more brittle and less meaningful.

## 11.3 Do Not Mock What You Do Not Own Without Reason

External systems are normal mock/stub candidates.
Internal pure logic often should be real.

## 11.4 Avoid Interaction-Only Testing

Do not write tests that only verify:
- method A called method B
- method B called method C

unless call sequencing is itself the behavior that matters.

Prefer state/result assertions over pure interaction assertions.

## 11.5 Verify Important Interactions, Not Every Interaction

Interaction verification is useful for:
- ensuring a message was emitted
- ensuring a client was called once
- ensuring no retry was performed
- ensuring an outbox event was created

It is not useful to verify every internal collaboration detail.

---

# 12. Spring Testing Rules

## 12.1 Do Not Default to `@SpringBootTest`

`@SpringBootTest` is expensive.
Use it only when full application wiring is the thing being tested.

Prefer:
- plain JUnit for pure logic
- `@JsonTest` for JSON
- `@WebMvcTest` for controller layer
- `@DataJpaTest` for repository layer

## 12.2 Keep Contexts Small

A test should load only the Spring context it needs.

Smaller contexts:
- run faster
- fail more clearly
- are easier to maintain

## 12.3 Test Real Wiring Where It Matters

For starters and auto-configuration, wiring tests are important.

Useful checks:
- bean created when required property is set
- bean not created when disabled
- user bean overrides auto-configured bean correctly
- invalid config fails fast

## 12.4 Avoid Accidental Context Pollution

Do not reuse test configuration in a way that silently affects unrelated tests.

Be explicit with:
- imported test configuration
- profiles
- properties
- bean overrides

---

# 13. Controller Tests

Controller tests should verify:
- request mapping
- validation
- status code
- response body shape
- error mapping when relevant

Controller tests should not become business logic tests.

If the service already has business rule tests, the controller test should mostly confirm HTTP behavior.

Typical checks:
- invalid request returns 400
- valid request returns expected JSON
- domain exception maps to correct error response

---

# 14. JSON and Contract Tests

For API and SDK code, contract tests are high value.

Test:
- field names
- required fields
- optional fields
- enum serialization
- backward compatibility when relevant
- unknown field handling when relevant
- date/time formatting

For Mogami, this is especially important for:
- x402 payloads
- payment requirements
- facilitator messages
- trace/event objects
- starter configuration-related API contracts

If a JSON shape matters externally, test it explicitly.

---

# 15. Repository Tests

Repository tests should focus on:
- query correctness
- persistence mapping correctness
- uniqueness/integrity assumptions when relevant
- transaction-sensitive behavior when relevant

Do not test Spring Data itself.
Test your actual query and mapping behavior.

Good repository test examples:
- finds active authorization by payment id
- does not return expired payment requirement
- orders trace events chronologically
- enforces unique replay key

---

# 16. Integration with External Systems

## 16.1 Use Controlled Test Doubles

When testing external clients, prefer:
- mock server
- local stub
- fixture-based response simulation

Avoid real external dependencies in normal automated tests.

## 16.2 Test Important Failure Modes

Do not test only the happy path.

Relevant failure cases include:
- timeout
- invalid payload
- 4xx response
- 5xx response
- malformed JSON
- partial response
- retryable vs non-retryable error

## 16.3 Keep Client Tests Focused

A client test should verify:
- request generation
- response parsing
- error translation
- timeout/retry behavior if implemented

It should not need the whole application unless wiring is part of the concern.

---

# 17. Database Testing

## 17.1 Keep Database Tests Realistic but Cheap

Use database tests for behavior that truly depends on the database.

Examples:
- query semantics
- unique constraints
- transaction rollbacks
- persistence mappings

## 17.2 Clean State Matters

Each test must have isolated state.

Do not let residue from previous tests affect outcomes.

## 17.3 Prefer Explicit Test Setup

A test should make its required state visible.

Do not hide too much setup in distant global fixtures.

---

# 18. Transaction and Concurrency Testing

These tests are important when the application has:
- payment state transitions
- replay protection
- outbox processing
- locks
- deduplication
- retried workflows

Test:
- duplicate processing resistance
- transactional consistency
- idempotency
- race-sensitive code when relevant

These tests are often fewer, but very valuable.

For Mogami, concurrency-related regressions can be expensive.
Do not ignore them when the workflow depends on uniqueness or exactly-once-like guarantees.

---

# 19. Regression Tests

Every significant bug should ideally produce a regression test.

A regression test should:
- reproduce the bug condition clearly
- verify the corrected behavior
- be named after the behavior, not the ticket number alone

Good:
- `shouldRejectAuthorizationSignedForDifferentPayload()`

Less useful:
- `fixBug123()`

Regression tests are one of the highest-ROI categories of tests.

---

# 20. Performance of the Test Suite

A good test suite must remain usable.

Warning signs:
- developers stop running tests locally
- tests are so slow that feedback loops break
- CI time becomes dominated by low-value tests
- flaky integration tests are retried routinely

Prefer:
- fast unit tests
- targeted integration tests
- minimal full-stack tests

Speed is not the main goal.
But a test suite that nobody runs is nearly worthless.

---

# 21. Flaky Tests

Flaky tests are failures.
Do not normalize them.

If a test is flaky:
- fix it
- isolate it
- or remove it until it can be trusted

Common sources of flakiness:
- time dependence
- race conditions
- async polling without control
- random ports without proper waiting
- shared mutable state
- external dependencies
- parallel execution issues

Never accept a flaky test as “good enough”.

---

# 22. Test Readability

Tests are documentation.

A reader should quickly understand:
- what is the scenario
- what is the expected behavior
- why the test exists

Rules:
- keep names explicit
- keep setup minimal
- use meaningful values
- avoid unnecessary indirection
- do not hide the scenario in giant helper layers

Prefer:
- `paymentId = "payment-123"`
  over:
- `paymentId = UUID.randomUUID().toString()`

when randomness does not help the test.

---

# 23. Code Coverage

Coverage is a signal, not a goal.

High coverage with weak tests is false confidence.
Low coverage on critical paths is dangerous.

Use coverage to identify blind spots, especially in:
- protocol logic
- payment flows
- error handling
- external client code
- starter auto-configuration
- concurrency-sensitive code

Do not optimize for coverage percentage alone.

---

# 24. Mogami-Specific Rules

## 24.1 Keep Protocol Tests Explicit

x402-related tests must remain easy to audit.

Test names and assertions should expose concepts like:
- payment requirements
- authorization
- signature
- replay
- expiration
- settlement
- network

Do not hide protocol meaning behind generic helper names.

## 24.2 Validate Failure Paths Carefully

Payment and verification code must be tested for incorrect states, not just successful states.

Examples:
- expired authorization
- wrong chain/network
- mismatched recipient
- invalid signature
- reused authorization
- unsupported scheme
- malformed payload
- facilitator rejection

## 24.3 Serialization Stability Matters

For SDKs and APIs, serialization compatibility is part of the contract.

Whenever an object is externally exchanged, test its JSON form explicitly when the shape matters.

## 24.4 Starter Tests Matter

For Spring Boot starters, test:
- auto-configuration conditions
- property binding
- custom bean override behavior
- disabled/enabled modes
- validation failure on invalid config

## 24.5 Outbox / Event Processing Must Be Tested Where Used

If a workflow relies on outbox/event processing:
- test event creation
- test retry behavior when relevant
- test idempotency assumptions
- test ordering behavior when the business depends on it

---

# 25. Anti-Patterns

Avoid these testing anti-patterns:

- giant `@SpringBootTest` for everything
- mocking every collaborator by reflex
- asserting only `not null`
- random test values without need
- sleep-based async tests
- one giant fixture for every scenario
- tests that verify internal implementation instead of behavior
- flaky tests kept in CI
- hidden time dependence
- meaningless coverage chasing
- test names that do not describe behavior
- duplicated tests that provide no extra confidence

---

# 26. Review Checklist

When reviewing a test, ask:

- Does this test verify meaningful behavior?
- Is the scenario obvious?
- Can it fail for one clear reason?
- Is it deterministic?
- Is the test type appropriate?
- Are the assertions strong enough?
- Is mocking justified?
- Is there a simpler test shape?
- Would this test help diagnose a real regression?

If the answer is “no” to several of these, rewrite the test.

---

# 27. Final Rule

When hesitating between two test designs, choose the one that:

- gives more real confidence
- is easier to read
- is less flaky
- is cheaper to maintain
- fails more clearly
- matches the actual risk of the code

A boring, explicit, trustworthy test is usually the right test.