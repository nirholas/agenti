# Task: Implement Distributed Request Tracing

## Priority: MEDIUM

## Context
Enterprise systems need end-to-end request tracing for debugging, auditing, and performance analysis across MCP tool calls, RPC requests, and external API calls.

## Requirements
1. Generate a unique `traceId` (UUID v4) for each incoming MCP request
2. Propagate `traceId` through all downstream calls:
   - RPC provider requests
   - External API calls (CoinGecko, Binance, etc.)
   - Internal service calls
3. Include `traceId` in all log messages (structured logging)
4. Return `traceId` in MCP response metadata for client correlation
5. Support W3C Trace Context (`traceparent` header) for integration with external tracing systems
6. Optional OpenTelemetry integration for exporting traces to Jaeger/Zipkin/Datadog
7. Add span timing for each tool execution phase:
   - Input validation
   - RPC/API calls
   - Response formatting
8. Store trace data with configurable retention (default 7 days)

## Acceptance Criteria
- [ ] Every request has a unique traceId
- [ ] TraceId propagated to all downstream calls
- [ ] Structured logs include traceId
- [ ] OpenTelemetry export works
- [ ] Span timing for tool execution phases
