# AGENTS.md

Instructions for AI agents working in this repository.

## Session Initialization

At the start of every session, before doing any other work:

1. Read `CONVENTIONS.md` and follow all conventions defined there
2. Glob for all `SKILL.md` files under `skills/` and load each one
3. Read `DEV.md` for development environment setup instructions

Do not proceed with any user requests until all steps are complete.

## x402 Payment Protocol

For all x402-related operations, use local `@faremeter` packages unless explicitly instructed otherwise.
**Do not use experimental x402 payment schemes unless explicitly told to do so.**

## Additional Conventions

See `CONVENTIONS.md` for complete development conventions including:

- Package management with pnpm catalog
- TypeScript configuration
- Code style and linting
- Build verification (`make` before completing tasks)

## Build Requirements

**CRITICAL:** You MUST build the entire tree with `make` before declaring any task complete.

When making changes to packages (especially in `packages/`):

1. Individual package builds do NOT guarantee the full tree will build
2. Type exports and imports may not be available until the full tree is built
3. Tests may fail if dependent packages are not rebuilt
4. ALWAYS run `make` at the root to verify the entire monorepo builds

**Never claim a task is complete without running a successful `make` build.**

If `make` fails, you must report the failure to the user and identify the cause.
Do not work around a failing `make` by running individual targets (e.g.
`make build`, `make test`) and treating their success as equivalent. A full
`make` is the only acceptable verification. If the failure is pre-existing and
unrelated to your changes, say so explicitly and let the user decide how to
proceed. Never silently skip a failing step or substitute a partial build.

## Code Reuse and Refactoring

Do not reimplement functionality that already exists in the codebase. Before writing new code:

1. Search for existing implementations that could serve the same purpose
2. If similar functionality exists, prefer refactoring it to meet the new requirements
3. Look for unexported functions in other packages that could be promoted to a shared location for broader use

When you detect that a refactor might be necessary, prompt the user with a question asking which approach to take. Offer specific options such as:

- Refactor the existing implementation
- Promote an unexported function to a shared package (ask the user which package)
- Create a new implementation

Allow the user to provide their own answer if none of the options fit.

## Personality

Do not use emojis in code or documentation, or attempt to be cute with your aesthetic. Act like a professional.

## Configuration

Do not modify configuration files (e.g. eslint, prettier) unless explicitly asked to. Your job is to write working software not change the conventions that are being used.

## Code Reviews and Pull Requests

When performing code reviews or pull request reviews, load the `code-review`
skill for detailed guidelines on scope determination, convention compliance,
and delegation to sub-agents.
