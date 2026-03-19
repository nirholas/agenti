# Contributing to MicroAI Paygate

Thanks for considering a contribution! This project is open to issues, bug fixes, docs improvements, and new features that keep the system lean and secure.

## Getting Started
- Fork the repo and create a feature branch: `git checkout -b feature/my-change`
- Install prerequisites: Bun, Go 1.24+, Rust/Cargo, and Node 20+ (for Next.js 16.x).
- Copy `.env.example` to `.env` and fill in required keys (see README).
- Run `bun install`, `go mod tidy -C gateway`, and `cargo build -q -C verifier`.

## Development Workflow
- Run the stack locally: `bun run stack`
- Run unit tests:
  - Gateway: `cd gateway && go test -v`
  - Verifier: `cd verifier && cargo test`
- Run E2E tests: `bun run test:e2e` (auto-starts gateway/verifier)
- Keep ports 3000/3001/3002 free when running locally.

## Pull Request Checklist
- Tests pass locally (gateway, verifier, and E2E where applicable).
- README/docs updated if behavior or env changes.
- No unrelated formatting-only diffs.
- Minimal surface area: focused, reviewable changes.

## Local Validation (mirrors CI)
- Gateway: `go test -v ./...` and `go vet ./...`
- Verifier: `cargo fmt -- --check`, `cargo clippy -- -D warnings`, `cargo test`
- Web: `cd web && bun run lint && bun run build`
- E2E (optional): `bun run test:e2e` (requires `OPENROUTER_API_KEY`)

## Coding Standards
- Keep changes minimal and focused; avoid large, unrelated refactors.
- Add tests for new behavior; update existing tests if logic changes.
- Prefer clear, concise documentation alongside code changes.
- Follow existing language idioms: Go fmt/go vet style; Rust fmt/clippy where applicable.
- New features must include tests (unit and/or E2E) covering the added behavior.

## Pull Requests
- Describe the problem, the solution, and testing performed.
- Link related issues if they exist.
- Be responsive to review feedback; small, incremental PRs are easier to merge.
- Use draft PRs for WIP to get early feedback.

## Reporting Issues
- Include steps to reproduce, expected vs actual behavior, logs, and environment details (OS, versions).
- For security-sensitive reports, please open a private disclosure channel (create a security-labeled issue requesting contact).

Thank you for helping improve MicroAI Paygate!
