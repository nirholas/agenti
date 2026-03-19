# @faremeter/test-harness

In-process test harness for x402 protocol testing without network calls.

## Installation

```bash
pnpm install @faremeter/test-harness
```

## Features

- In-process testing - No network calls or external services
- Interceptor pattern - Inject failures, delays, and custom responses
- Composable - Combine interceptors for complex scenarios
- Test scheme - Simple payment scheme for protocol validation
- Framework agnostic - Works with any test runner

## API Reference

<!-- TSDOC_START -->

<!-- TSDOC_END -->

## Examples

See integration tests in the [faremeter repository](https://github.com/faremeter/faremeter/tree/main/tests):

- [Success flow](https://github.com/faremeter/faremeter/blob/main/tests/x402v1/success.test.ts)
- [Verification failures](https://github.com/faremeter/faremeter/blob/main/tests/x402v1/verification-failures.test.ts)
- [Settlement failures](https://github.com/faremeter/faremeter/blob/main/tests/x402v1/settlement-failures.test.ts)

## Related Packages

- [@faremeter/fetch](https://www.npmjs.com/package/@faremeter/fetch) - Client-side fetch wrapper
- [@faremeter/middleware](https://www.npmjs.com/package/@faremeter/middleware) - Server-side middleware
- [@faremeter/facilitator](https://www.npmjs.com/package/@faremeter/facilitator) - Payment facilitator service

## License

LGPL-3.0-only
