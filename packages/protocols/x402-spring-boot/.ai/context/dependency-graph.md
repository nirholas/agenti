# Dependency Graph

This document describes the main repository dependencies in the Mogami x402 stack.

Its purpose is to make dependency direction explicit for both developers and AI agents.

It should help answer these questions quickly:

- which repositories depend on which others
- which repositories define shared contracts
- which repositories produce data consumed elsewhere
- which repositories are runtime components
- which repositories are integration layers
- which repositories are documentation or demonstration layers
- how release and migration impact flows through the stack

This document is intentionally simple and readable.

It is not intended to be a generated dependency dump.

## Core rule

Not all dependencies are equal.

For Mogami, dependencies exist at several levels:

- source dependency
- contract dependency
- runtime dependency
- documentation dependency
- release dependency

A repository may depend on another repository even when there is no direct build dependency.

## Dependency categories

### 1. Build dependency

A repository directly uses another repository as a library or artifact.

Example:
- a Spring Boot starter depends on shared contracts from `x402-commons`

### 2. Contract dependency

A repository relies on a model, JSON structure, event shape, validation rule, or semantic convention defined elsewhere.

### 3. Runtime dependency

A repository interacts with another component at runtime.

Example:
- a client application interacts with a facilitator or x402-protected server

### 4. Documentation dependency

A repository's documentation or examples depend on the behavior of another repository.

Example:
- `mogami-examples` depends on the released behavior of client and starter repositories

### 5. Release dependency

A repository should usually be released after another one because it consumes its artifacts, behavior, or contracts.

## Main repositories

The Mogami stack includes the following repository roles.

### `x402-commons`

Shared contracts, shared types, shared validation, shared constants, and other small cross-repository building blocks.

This repository is a foundation dependency.

### `x402-java-client`

Java client SDK used to interact with x402-protected APIs.

This repository is a consumer-facing integration library.

### `x402-spring-boot-starter`

Spring Boot integration used to protect APIs with x402.

This repository is a developer-facing server integration layer.

### `x402-facilitator`

Runtime component responsible for verification, settlement, and payment flow support.

This repository is a producer of runtime behavior and trace data.

### `x402-examples`

Runnable examples and demos showing how to use the stack.

This repository depends on the released reality of the rest of the platform.

## Dependency graph overview

The simplified dependency graph is:

```text
x402-commons
  ├── mogami-x402-java-client
  ├── mogami-x402-spring-boot-starter
  └── mogami-facilitator

mogami-facilitator

mogami-x402-java-client
  └── mogami-examples

mogami-x402-spring-boot-starter
  └── mogami-examples

mogami-facilitator
  └── mogami-examples
```