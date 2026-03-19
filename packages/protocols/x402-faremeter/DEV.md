# Developer Notes

## Tools Required

- node (v22 or newer)
- pnpm
- bash (v4 or newer)
- GNU make
- opsh

Note: A recent version of `opsh` is included in the repository. You can set your `PATH` to include `bin` to use that version, rather than install it directly.

## Setting Up Your Environment

0. Configure your git hooks:

```
git config core.hooksPath .githooks
```

1. Install all of the needed packages:

```
pnpm install -r
```

## Building

Build all packages:

```
make build
```

Build a specific package (faster during development):

```
make packages/<package-name>
```

For example:

```
make packages/test-harness
make packages/middleware
make packages/types
```

## Testing

### Running Unit Tests

```
make test
```

### Bulk Running Examples For Testing

Setup your environment using the [quickstart guide](./QUICKSTART.md). Then you can run the examples en masse:

#### Solana

```
cd scripts && pnpm tsx solana-example/run-examples.ts
```

#### EVM

```
cd scripts && pnpm tsx evm-example/run-examples.ts
```
