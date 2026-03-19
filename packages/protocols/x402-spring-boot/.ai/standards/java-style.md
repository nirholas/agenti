# Java Style Guide (Mogami Extended)

This document defines the Java coding standards for all Mogami repositories.

It is intentionally opinionated.

---

# 1. Philosophy

Always optimize for:

1. Simplicity
2. Readability
3. Explicitness
4. Reliability
5. Performance (only when needed)

Bad code works.
Good code scales.
Great code is obvious.

---

# 2. Global Rules

- Java version: 21
- No magic
- No hidden behavior
- No implicit side effects
- No clever tricks

If something is not obvious → rewrite it.

---

# 3. Naming

## 3.1 General

Names must be:
- Explicit
- Domain-oriented
- Complete

BAD:
- data
- value
- obj
- tmp
- result

GOOD:
- paymentRequirements
- authorizationSignature
- facilitatorResponse
- expiresAt

## 3.2 Methods

Use verbs:

- createPaymentPayload()
- verifyAuthorization()
- findNetwork()

Boolean:
- isValid()
- hasAuthorization()

## 3.3 Classes

Use nouns:

- PaymentRequest
- PaymentService
- AuthorizationVerifier

---

# 4. Class Design

## 4.1 Responsibilities

A class should do ONE thing.

If you need "and" → split the class.

## 4.2 Immutability

Prefer immutable objects:

- records for DTOs
- final fields

Avoid setters unless required.

## 4.3 Constructors

A constructor must create a VALID object.

Never allow half-built objects.

---

# 5. Methods

## 5.1 Size

- Small
- Single responsibility
- Readable in < 20 seconds

## 5.2 Parameters

Max ~3–4 parameters.

If more → create object.

## 5.3 Return

Never return null for collections.

Use:
- List.of()
- Optional<T> (sparingly)

---

# 6. Control Flow

Prefer early return:

GOOD:
```
if (authorization == null) {
    return false;
}
return verifier.verify(authorization);
```

BAD:
```
if (authorization != null) {
    return verifier.verify(authorization);
}
return false;
```

---

# 7. Exceptions

## Rules

- Always explicit
- Always meaningful

GOOD:
```
throw new UnsupportedNetworkException(networkId);
```

BAD:
```
throw new RuntimeException("error");
```

## Never

- swallow exceptions
- log + ignore

---

# 8. Logging

Log ONLY:

- important business events
- failures
- retries
- external calls

NEVER log:
- private keys
- signatures
- secrets

GOOD:
```
log.info("Payment verified: paymentId={}, network={}", paymentId, networkId);
```

---

# 9. Spring Rules

## 9.1 Injection

ONLY constructor injection.

## 9.2 Layers

- Controller → HTTP
- Service → logic
- Repository → DB
- Client → external

NO mixing.

## 9.3 Configuration

Use @ConfigurationProperties.

Avoid @Value everywhere.

---

# 10. DTO & API

- DTO != Entity
- Explicit JSON fields
- Stable contracts

---

# 11. Time

Use:
- Instant (default)
- OffsetDateTime (if needed)

Never rely on system timezone implicitly.

---

# 12. Collections

Prefer loops when clearer.

Streams ONLY when readable.

NO complex pipelines.

---

# 13. Persistence

- Keep entities simple
- No business logic inside entities
- Be explicit with queries

---

# 14. Testing

## Rules

- Test behavior, not implementation
- One test = one reason to fail

## Naming

- shouldRejectExpiredAuthorization()
- shouldVerifySignature()

## Avoid

- over-mocking
- weak assertions

---

# 15. Lombok

Allowed but controlled.

GOOD:
- @Getter
- @RequiredArgsConstructor

BE CAREFUL:
- @Builder everywhere
- hidden complexity

---

# 16. Null Handling

- Non-null by default
- Validate at boundaries
- Optional only when meaningful

---

# 17. Mogami Specific

## 17.1 x402 clarity

DO NOT abstract protocol concepts.

Keep:
- paymentRequirements
- authorization
- facilitator

## 17.2 Network logic

Must be visible and explicit.

## 17.3 Safety

- Validate everything
- Fail fast
- Trace everything

---

# 18. Anti-patterns

FORBIDDEN:

- God classes
- Generic Utils classes
- Hidden side effects
- Over-abstraction
- Premature optimization

---

# 19. Package Naming

GOOD:
- tech.mogami.x402.client
- tech.mogami.x402.server

BAD:
- util
- misc
- impl

---

# 20. Final Rule

If you hesitate:

Choose the code that:
- a senior can read instantly
- a junior can understand
- you can debug at 3am