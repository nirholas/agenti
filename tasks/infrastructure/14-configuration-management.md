# Task: Centralized Configuration Management

## Priority: MEDIUM

## Context
Configuration is scattered across environment variables, `config.json` files, and hardcoded values. Enterprise deployments need validated, documented, centralized configuration.

## Requirements
1. Create a `src/config/` module with Zod-validated configuration schema
2. Support configuration sources with precedence: env vars > config file > defaults
3. Validate all configuration at startup — fail fast with clear error messages
4. Required config for production:
   - `NODE_ENV` (development | staging | production)
   - `CORS_ALLOWED_ORIGINS`
   - `AUTH_REQUIRED`
   - All RPC endpoints
5. Sensitive values must come from env vars only (not config files)
6. Generate a JSON schema from the Zod config for documentation
7. Add a `--validate-config` CLI flag that checks config without starting the server
8. Remove all `process.env` access outside the config module
9. Add config hot-reload support for non-sensitive values

## Acceptance Criteria
- [ ] Single config module with Zod validation
- [ ] Startup fails fast on invalid config
- [ ] `--validate-config` CLI flag works
- [ ] No `process.env` access outside config module
- [ ] JSON schema generated for documentation
