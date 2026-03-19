# Spring Boot Rules (Mogami)

This document defines the Spring Boot conventions for all Mogami repositories.

The goal is simple:
build Spring Boot applications that stay explicit, testable, and easy to evolve.

This is not a generic Spring guide.
It is an opinionated rule set for Mogami.

---

# 1. Core Principles

Always optimize for:

1. Simplicity
2. Readability
3. Explicitness
4. Reliability
5. Operational clarity

Spring Boot is allowed to remove boilerplate.
It must not hide architecture.

If a Spring feature makes the code harder to understand, do not use it.

---

# 2. Baseline

- Java version: 21
- Spring Boot version: project-defined
- Dependency injection style: constructor injection only
- Configuration style: typed configuration
- Validation: explicit at boundaries
- Transactions: explicit and narrow
- Observability: structured logs and clear failure paths

---

# 3. Dependency Injection

## 3.1 Constructor Injection Only

Always use constructor injection with lombok `@RequiredArgsConstructor` or explicit constructors.

Avoid field injection:

```java
@Autowired
private PaymentRepository paymentRepository;
```

Why:
- easier to test
- explicit dependencies
- immutable references
- no hidden wiring

## 3.2 Keep Dependencies Small

A class with too many injected dependencies is usually doing too much.

As a rule of thumb:
- 2 to 5 dependencies is normal
- more than that should trigger a design review

If a service needs many collaborators:
- split responsibilities
- extract orchestration
- group related logic behind a smaller boundary

## 3.3 No Optional Injection

Do not inject optional dependencies unless the design truly requires pluggability.

Prefer explicit strategy selection over partially configured beans.

---

# 4. Bean Design

## 4.1 One Bean, One Responsibility

Each Spring bean should have a narrow and explicit role.

Typical bean categories:
- controller
- service
- repository
- client
- mapper
- validator
- configuration properties

Do not create vague beans like:
- `PaymentManager`
- `CommonHelper`
- `ApplicationUtils`

## 4.2 Prefer Concrete Types

Create interfaces by default:
- `PaymentService` interface
- `PaymentServiceImplementation,` implementation

## 4.3 Stateless by Default

Spring services should be stateless by default.

Do not keep request-specific or mutable business state inside singleton beans.

Allowed state:
- immutable configuration
- caches explicitly designed for concurrency
- well-bounded infrastructure state

---

# 5. Controllers

## 5.1 Controllers Are HTTP Adapters

A controller maps HTTP to application logic.

A controller should:
- receive HTTP input
- validate request shape
- delegate to application services
- map service results to HTTP responses

A controller should not:
- implement business logic
- orchestrate complex workflows
- contain persistence logic
- perform remote calls directly unless the controller itself is the thin adapter for a dedicated endpoint

## 5.2 Keep Controllers Thin

Good controller methods are short.

Good:

```java
@PostMapping("/payments/verify")
public ResponseEntity<PaymentVerificationResponse> verify(
        @Valid @RequestBody PaymentVerificationRequest request) {
    PaymentVerificationResponse response = paymentService.verify(request);
    return ResponseEntity.ok(response);
}
```

Bad:
- parsing domain rules in controller
- signature verification in controller
- entity loading in controller
- transaction logic in controller

## 5.3 Be Explicit With HTTP Contracts

Use explicit request and response DTOs.

Avoid exposing:
- JPA entities
- internal domain objects not meant for transport
- framework internals

DTOs should reflect the HTTP contract, not internal storage.

## 5.4 Validate at the Boundary

Use bean validation on incoming request DTOs.

Examples:
- `@NotNull`
- `@NotBlank`
- `@Size`
- `@Pattern`

Validation at the controller boundary is for:
- shape
- required values
- basic format

Business validation still belongs in services/domain logic.

## 5.5 Response Codes Must Be Intentional

Do not return 200 for everything.

Use proper response status codes:
- 200 for successful read/process
- 201 for creation
- 204 for successful no-content result
- 400 for invalid input
- 404 for missing resource
- 409 for conflicts
- 422 when semantic input is invalid, if that distinction is meaningful in the project
- 500 only for true server-side failures

---

# 6. Services

## 6.1 Services Contain Application Logic

A service is the main home of use-case logic.

A service may:
- orchestrate repositories
- call external clients
- validate business rules
- transform domain objects
- emit events

A service must remain focused on a clear use case.

## 6.2 Separate Orchestration From Pure Logic

When logic becomes large, separate:
- orchestration logic
- pure domain validation/calculation
- mapping logic
- infrastructure logic

Do not let one service become a dumping ground.

## 6.3 Avoid Service-to-Service Spaghetti

It is acceptable for services to collaborate.
It is not acceptable to create a graph of services calling services in a way that makes execution flow hard to follow.

Prefer:
- one application service orchestrates
- helpers are extracted into explicit domain/infrastructure collaborators

## 6.4 Transactions Belong in Services

Transactional boundaries should usually live in the service layer.

Do not put `@Transactional` on controllers.

Repositories are persistence components, not transaction coordinators.

---

# 7. Transactions

## 7.1 Keep Transactions Explicit and Narrow

Use `@Transactional` only where needed.

A transaction should cover the minimal unit of consistency.

Avoid very large transactional methods that:
- call external APIs
- do heavy computation
- perform long loops
- mix multiple concerns

## 7.2 Do Not Call Remote Systems Inside Long Transactions

Avoid:
- facilitator HTTP calls inside large DB transactions
- blockchain submission inside large DB transactions
- slow file/network operations inside transactions

Preferred approach:
- persist intent/state
- commit
- call remote system
- update resulting state in a new transaction
- or use an outbox/event-driven workflow when appropriate

## 7.3 Read-Only Transactions

Use read-only transactions when they improve clarity and fit the persistence model.

Example:

```java
@Transactional(readOnly = true)
public Payment findPayment(String paymentId) {
    return paymentRepository.findByPaymentId(paymentId)
            .orElseThrow(() -> new PaymentNotFoundException(paymentId));
}
```

## 7.4 One Transaction, One Consistency Goal

A transaction should protect one coherent business invariant.

If you cannot describe the invariant clearly, the transaction boundary is likely wrong.

---

# 8. Repositories

## 8.1 Repositories Handle Persistence Only

Repositories are for persistence access.

They should not contain:
- business orchestration
- external system calls
- logging-heavy operational logic
- unrelated mapping code

## 8.2 Keep Repository APIs Readable

Repository methods must stay understandable.

Good:
- `findByPaymentId`
- `findByStatusAndExpiresAtBefore`
- `existsByAuthorizationId`

If a derived query name becomes absurdly long, use an explicit query.

## 8.3 Return Types

Prefer:
- entity
- `Optional<T>`
- collections
- `Page<T>` or `Slice<T>` when pagination matters

Never return `null`.

## 8.4 Avoid Leaking Persistence Details

Do not spread JPA-specific behavior across the whole application.

The service layer should not depend on subtle persistence side effects like accidental lazy loading.

---

# 9. Entities

## 9.1 Keep Entities Simple

Entities represent persisted state.

They should not become application service containers.

Allowed inside entities:
- invariant-preserving methods tightly bound to the entity
- simple state transitions
- derived values directly related to the entity

Avoid:
- remote calls
- repository access
- orchestration logic
- cross-aggregate workflows

## 9.2 Be Careful With Lazy Loading

Lazy loading is acceptable when intentional.

Do not rely on:
- open session in view style accidental behavior
- hidden lazy access in serialization
- unpredictable graph traversal

Fetch what you need explicitly.

## 9.3 Equality Must Be Intentional

Be careful with `equals()` and `hashCode()` on entities.

Do not generate them blindly on mutable state.

For JPA entities, identity semantics must be deliberate and consistent.

---

# 10. DTOs and Mapping

## 10.1 Separate Transport and Domain

HTTP DTOs, persistence entities, and domain/value objects do not automatically have the same role.

Keep them separate when the meaning differs.

## 10.2 Mappers Must Stay Boring

Mapping code should be obvious.

Use:
- explicit mapping methods
- MapStruct when it improves consistency and removes repetitive boilerplate

Do not hide business rules inside mappers.

## 10.3 DTO Names Must Reflect Direction

Prefer:
- `PaymentVerificationRequest`
- `PaymentVerificationResponse`
- `SettlementResultResponse`

Avoid:
- `PaymentDto`
- `CommonResponse`
- `DataRequest`

---

# 11. Configuration

## 11.1 Prefer @ConfigurationProperties

Use typed configuration for non-trivial configuration.

Good:

```java
@ConfigurationProperties(prefix = "mogami.facilitator")
public record FacilitatorProperties(
        URI baseUrl,
        Duration timeout,
        String apiKey) {
}
```

Avoid scattering `@Value` across the codebase.

Use `@Value` only for very small and local cases.

## 11.2 Validate Configuration

Configuration is input.
Validate it.

Use bean validation or explicit startup validation for required configuration.

The application should fail fast on invalid configuration.

## 11.3 Keep Configuration Classes Focused

A configuration class should configure a coherent area.

Examples:
- HTTP client config
- Jackson config
- security config
- task scheduler config

Avoid giant catch-all configuration classes.

## 11.4 Do Not Overconfigure Spring

If the default behavior is fine, keep the default.

Do not create configuration classes only to restate defaults.

---

# 12. Profiles and Environments

## 12.1 Use Profiles Sparingly

Profiles should represent real environment variants.

Good:
- local
- test
- production-specific optional behavior when justified

Bad:
- many overlapping profiles with unclear combinations
- business behavior toggled through profile chaos

## 12.2 Prefer Explicit Properties Over Profile Explosion

If a behavior is parameterized, prefer typed properties over multiplying profiles.

## 12.3 Do Not Hide Critical Behavior in a Profile

Core business rules must not silently change because a profile switched.

Environment differences should concern infrastructure, not protocol correctness.

---

# 13. Validation

## 13.1 Validate at the Right Layer

Use the right validation in the right place:

- controller/request DTO: input shape
- service/domain: business rules
- configuration: startup constraints
- persistence: database integrity as final defense

## 13.2 Prefer Explicit Business Validation

For business rules, explicit code is often clearer than annotation abuse.

Good:

```java
if (authorization.isExpired(now)) {
    throw new AuthorizationExpiredException(authorization.id());
}
```

## 13.3 Validation Messages Must Be Useful

Error messages should help:
- the developer
- the API consumer
- the operator reading logs

Avoid vague messages like:
- invalid request
- bad input
- operation failed

---

# 14. Exception Handling

## 14.1 Use Domain-Specific Exceptions

Prefer:
- `PaymentNotFoundException`
- `UnsupportedNetworkException`
- `InvalidAuthorizationException`

Avoid throwing generic `RuntimeException` without context.

## 14.2 Centralize HTTP Error Mapping

Use centralized exception handling for HTTP APIs.

For example, a `@RestControllerAdvice` can map:
- domain exceptions
- validation errors
- generic failures

This keeps controllers small and response behavior consistent.

## 14.3 Do Not Swallow Exceptions

Every caught exception must have a clear reason:
- translate to domain exception
- add context and rethrow
- handle fully and intentionally

Never catch and ignore.

## 14.4 Preserve Useful Context

When wrapping exceptions, preserve the cause.

Good:

```java
throw new FacilitatorCallException("Failed to verify settlement with facilitator", exception);
```

---

# 15. Logging

## 15.1 Log for Operations

Logs should explain:
- what happened
- on which object
- with which identifiers
- whether it succeeded or failed

Useful identifiers:
- payment id
- authorization id
- network id
- facilitator reference
- settlement id
- trace id

## 15.2 Avoid Noise

Do not log:
- every trivial method entry
- every getter-style action
- duplicate information across multiple layers
- giant object dumps

## 15.3 Never Log Secrets

Never log:
- private keys
- raw secrets
- authorization tokens
- sensitive signatures if they can be replayed or leaked
- confidential user data unless explicitly justified and protected

## 15.4 Use Structured Patterns

Prefer logs that operators can search reliably.

Good:

```java
log.info(
        "Settlement submitted: paymentId={}, network={}, facilitatorReference={}",
        paymentId,
        networkId,
        facilitatorReference);
```

---

# 16. HTTP Clients

## 16.1 External Calls Must Be Isolated

Wrap remote calls inside dedicated client classes.

Do not spread raw HTTP code across services.

Examples:
- `FacilitatorClient`
- `CircleClient`
- `BlockchainRpcClient`

## 16.2 Timeouts Are Mandatory

Every remote client must have explicit:
- connect timeout
- read/response timeout
- possibly retry policy, when justified

No unbounded waits.

## 16.3 Retries Must Be Intentional

Retry only when:
- the operation is idempotent or safely repeatable
- the failure is transient
- the retry policy is bounded
- duplicate side effects are understood

## 16.4 Translate External Errors

Do not leak low-level HTTP client exceptions across the application.

Translate them into application/infrastructure exceptions with clear meaning.

---

# 17. Scheduling and Async Work

## 17.1 Prefer Explicit Async Boundaries

Use scheduled and asynchronous execution only when there is a clear operational need.

Do not use async behavior to hide poor response-time decisions.

## 17.2 Scheduled Jobs Must Be Idempotent

A scheduled task may run twice.
Design for that.

## 17.3 Background Processing Must Be Observable

For background work:
- log start/end/failure
- keep identifiers
- expose metrics when useful
- avoid silent drops

## 17.4 Use Outbox/Event Patterns for Critical Side Effects

When a workflow involves:
- DB state
- external calls
- retries
- traceability

prefer an explicit outbox or message-driven approach over fragile in-method sequencing.

---

# 18. Security

## 18.1 Security Must Be Explicit

Do not rely on accidental defaults for critical endpoints.

For each sensitive endpoint, be explicit about:
- authentication
- authorization
- public/private exposure
- accepted inputs

## 18.2 Minimize Surface Area

Only expose endpoints that are needed.

Disable or avoid accidental actuator/public exposure when not required.

## 18.3 Validate Untrusted Input

All external input is untrusted:
- HTTP payloads
- headers
- query params
- callback payloads
- configuration
- external service responses

---

# 19. Testing Rules

## 19.1 Test Slices Intentionally

Use the smallest useful test style:

- unit test for pure logic
- slice test for controller/repository/web concerns
- integration test for true framework wiring
- end-to-end test only when valuable

## 19.2 Do Not Default to @SpringBootTest

`@SpringBootTest` is expensive.
Use it when you truly need full application wiring.

Prefer lighter tests when possible.

## 19.3 Mock Only Real Boundaries

Mock:
- remote clients
- clocks
- infrastructure boundaries when needed

Avoid mocking every internal collaborator if real code is simpler and more trustworthy.

## 19.4 Test Configuration Matters

Critical configuration must be testable:
- property binding
- serializer behavior
- security rules
- transaction boundaries when relevant

---

# 20. Package Structure

Package structure must reflect architecture, not framework fashion.

Good patterns:
- by domain feature
- with explicit subpackages for api/application/domain/infrastructure when justified
- stable boundaries

Avoid giant horizontal package trees with everything mixed.

Bad:
- controller
- service
- repository
- dto
- util

for the whole application when domains are already large.

Prefer domain-oriented structure when the project grows.

Example:

```text
tech.mogami.x402.payment
  ├── api
  ├── application
  ├── domain
  ├── infrastructure
```

Or a simpler version when the module is small.

---

# 21. Autoconfiguration and Starters

## 21.1 Starters Must Stay Predictable

For starter modules:
- auto-configuration must be explicit
- defaults must be safe
- bean creation conditions must be obvious
- documentation must describe what is created

## 21.2 Do Not Surprise Integrators

A starter must not:
- create hidden side effects
- force unwanted beans
- silently override user beans without clear conditions

## 21.3 Expose Typed Properties

Every configurable starter behavior should be surfaced through clear typed properties.

---

# 22. Mogami-Specific Rules

## 22.1 Keep x402 Concepts Explicit

Do not hide protocol concepts behind generic enterprise naming.

Prefer:
- `paymentRequirements`
- `paymentPayload`
- `authorization`
- `facilitator`
- `settlement`

Avoid:
- `requestData`
- `operationInfo`
- `transactionManager`

## 22.2 Protocol Code Must Be Easy to Audit

Anything related to:
- payment verification
- signature validation
- network selection
- settlement
- replay protection
- expiration checks

must remain explicit and easy to trace in code.

## 22.3 Fail Fast on Invalid Payment State

In payment flows:
- validate aggressively
- reject invalid states early
- make error causes precise
- log enough for diagnosis
- never sacrifice correctness for convenience

## 22.4 Operational Traceability Matters

For Mogami components, especially facilitator/server flows:
- preserve stable identifiers
- make execution flow observable
- keep logs and exceptions aligned with real operational debugging needs

---

# 23. Anti-Patterns

Avoid these patterns unless there is a very strong reason:

- field injection
- service interface + impl everywhere
- fat controllers
- transactions around remote calls
- generic helper classes
- giant configuration classes
- profile-driven behavior chaos
- entities as business-service containers
- leaking JPA entities through APIs
- magic annotations used instead of explicit code
- broad exception swallowing
- excessive `@SpringBootTest`
- hidden startup behavior in starters

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

# 24. Final Rule

When hesitating between two Spring Boot designs, choose the one that:

- makes bean wiring obvious
- keeps responsibilities narrow
- minimizes hidden behavior
- makes failures easy to understand
- remains easy to test
- stays boring in production

Boring Spring Boot code is usually the right Spring Boot code.