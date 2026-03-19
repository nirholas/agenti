# Task: Replace AsyncFunction Sandbox with isolated-vm

## Priority: CRITICAL

## Context
The `executeCodeTool()` in `src/hosting/runtime.ts` (lines 194-213) uses the `AsyncFunction` constructor to run user-supplied code. The current "safe globals" approach is trivially escapable and allows remote code execution.

## Requirements
1. Remove the `AsyncFunction`-based code execution entirely
2. Integrate `isolated-vm` (or `quickjs-emscripten`) as the sandboxed runtime
3. Restrict available globals to only what tools explicitly need (no `fetch`, `process`, `require`)
4. Set memory limits (e.g., 128MB) and execution timeouts (e.g., 10s) on the isolate
5. Ensure no access to the host filesystem, network, or environment variables from within the sandbox
6. Add tests proving sandbox escape attempts fail (e.g., accessing `process`, `require`, `__proto__`)

## Acceptance Criteria
- [ ] `isolated-vm` or equivalent installed and integrated
- [ ] Memory and CPU limits enforced
- [ ] No access to host globals from sandbox
- [ ] At least 10 sandbox escape test cases passing
- [ ] Existing code tool functionality preserved
