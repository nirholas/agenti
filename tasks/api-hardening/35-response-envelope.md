# Task: Standardize API Response Envelope

## Priority: MEDIUM

## Context
Tool responses are inconsistently structured. Enterprise APIs need a predictable response envelope for client SDK development and monitoring.

## Requirements
1. Define a standard response envelope:
   ```typescript
   interface ToolResponse<T> {
     success: boolean;
     data?: T;
     error?: {
       code: string;
       message: string;
       details?: Record<string, unknown>;
       retryable: boolean;
     };
     metadata: {
       traceId: string;
       duration_ms: number;
       cached: boolean;
       chain?: string;
       toolVersion: string;
     };
   }
   ```
2. Wrap all tool responses in this envelope
3. Add response validation: verify response matches expected schema before returning
4. Add response size limits (warn if > 1MB, truncate if > 10MB)
5. Add pagination support for list operations:
   ```typescript
   pagination?: {
     page: number;
     pageSize: number;
     total: number;
     hasMore: boolean;
   }
   ```
6. Add deprecation headers for tools being phased out

## Acceptance Criteria
- [ ] All tools use standardized response envelope
- [ ] Response validation catches malformed data
- [ ] Pagination implemented for list operations
- [ ] Response size limits enforced
- [ ] Deprecation headers supported
