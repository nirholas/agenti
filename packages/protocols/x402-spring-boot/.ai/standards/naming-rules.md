# Naming Rules (Mogami)

This document defines strict naming conventions for all Mogami repositories.

Goal: eliminate ambiguity, maximize readability, and make the domain obvious in code.

---

# 1. Core Principles

Names must be:

- Explicit
- Complete
- Domain-oriented
- Unambiguous

If a name needs a comment → it is a bad name.

---

# 2. Forbidden Naming

Never use:

- data
- value
- obj
- tmp
- result
- manager
- misc

These names hide intent.

---

# 3. Variable Naming

## Rule

Variables must describe WHAT they contain.

BAD:
```
var data;
var result;
var value;
```

GOOD:
```
var paymentRequirements;
var authorizationSignature;
var facilitatorResponse;
```

## Collections

Always plural:

```
payments
paymentRequirements
supportedNetworks
```

---

# 4. Method Naming

## Rule

Methods must describe WHAT they do.

Format:
```
<verb><object>
```

Examples:
```
createPaymentPayload()
verifyAuthorization()
findSupportedNetwork()
```

## Boolean Methods

Must read like a sentence:

```
isValid()
hasAuthorization()
supportsNetwork()
```

BAD:
```
check()
test()
flag()
```

---

# 5. Class Naming

## Rule

Classes are nouns.

Examples:
```
PaymentRequest
PaymentRequirements
AuthorizationVerifier
FacilitatorClient
```

## Services

Only use "Service" if it represents business logic:

```
PaymentService
AuthorizationService
```

Avoid:
```
PaymentManager
PaymentHelper
```

---

# 6. DTO Naming

DTOs must reflect their role.

Patterns:
```
PaymentRequest
PaymentResponse
AuthorizationPayload
FacilitatorResponse
```

Avoid generic names:
```
DataDto
ResponseDto
```

---

# 7. Exception Naming

Format:
```
<Context><Problem>Exception
```

Examples:
```
PaymentExpiredException
UnsupportedNetworkException
InvalidAuthorizationException
```

---

# 8. Boolean Variables

Must be readable:

GOOD:
```
isExpired
hasSignature
supportsNetwork
```

BAD:
```
expired
flag
ok
valid
```

---

# 9. Constants

Use UPPER_SNAKE_CASE:

```
MAX_RETRY_COUNT
DEFAULT_TIMEOUT_SECONDS
SUPPORTED_NETWORKS
```

---

# 10. Package Naming

Packages must reflect domain boundaries.

GOOD:
```
tech.mogami.x402.client
tech.mogami.x402.server
tech.mogami.x402.facilitator
```

BAD:
```
util
common
misc
impl
```

---

# 11. Domain Language (MUST FOLLOW)

Use x402 vocabulary consistently.

Required terms:
```
paymentRequirements
paymentPayload
authorization
facilitator
network
settlement
```

Never replace with generic terms:
```
data
info
requestData
```

---

# 12. Anti-patterns

FORBIDDEN:

- Abbreviations (except standard ones: URL, HTTP, JSON, UUID)
- One-letter variables (except loop index)
- Over-generic names
- Synonyms for the same concept (pick ONE term and reuse it)

---

# 13. Consistency Rule

Same concept → same name everywhere.

Example:

Always:
```
paymentRequirements
```

Never mix:
```
paymentReq
requirements
paymentData
```

---

# 14. Final Rule

A name must answer instantly:

- What is this?
- What does it contain?
- What is its role?

If not → rename it.