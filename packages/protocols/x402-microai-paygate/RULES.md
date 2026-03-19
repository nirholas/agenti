# Project Rules

These guidelines keep the project maintainable and secure.

## Code
- Keep changes focused and minimal; avoid drive-by refactors.
- Add or update tests with behavior changes.
- Follow language idioms (Go fmt/vet; Rust fmt/clippy; TS linting where applicable).
- No secrets in code or logs. Use `.env` and `.gitignore` appropriately.

## Git & Reviews
- Prefer small, reviewable PRs.
- Write meaningful commits (`feat:`, `fix:`, `docs:`, `chore:`).
- Keep branches up to date with `main`/`ops` before requesting review.
- Do not force-push shared branches without coordination.

## Security
- Never commit private keys or API tokens.
- Report vulnerabilities privately (see CONTRIBUTING for disclosure guidance).
- Keep dependencies minimal; avoid adding heavy libraries without justification.

## Documentation
- Update README/Service READMEs when behavior, env vars, or APIs change.
- Document new endpoints and flags in the relevant service README.
- Note breaking changes clearly in PR descriptions.

## Testing
- Run relevant test suites before PRs: gateway `go test`, verifier `cargo test`, E2E `bun run test:e2e` when applicable.
- Avoid merging code with failing tests unless marked and explained.

## Operations
- Default ports: 3000 (gateway), 3001 (web), 3002 (verifier). Avoid collisions or configure overrides.
- Docker usage: prefer service names (gateway/verifier/web) inside Compose.
- Log responsibly; avoid sensitive data in logs.
