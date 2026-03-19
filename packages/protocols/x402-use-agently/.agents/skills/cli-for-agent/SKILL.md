---
name: cli-for-agent
description: >-
  Design and build CLI tools optimized for AI agent consumption.
  Use this skill when creating a new CLI command, refactoring an existing CLI
  for agent compatibility, or reviewing whether a CLI follows agent-friendly
  design principles.
license: MIT
metadata:
  author: Agently
  version: 1.0.0
  category: design-patterns
  tags:
    - cli
    - agent
    - automation
    - design
---

# Building CLI Tools for AI Agents

## When to Use

Use this skill when:

- Designing a new CLI tool that AI agents will invoke
- Adapting an existing CLI to be agent-friendly
- Reviewing a CLI for agent compatibility issues
- Adding commands or subcommands to an agent-facing CLI

## Core Principle

**Agents are not humans.** They cannot see colors, navigate interactive menus, interpret spinner animations, or respond to TTY prompts. A CLI built for agents must communicate entirely through structured text on stdout, clear error messages on stderr, and meaningful exit codes. If an agent can't parse your output or recover from your errors in one retry, your CLI has failed.

## Design Rules

### 1. No TTY Assumed — Ever

Never use interactive prompts, confirmation dialogs, `readline`, cursor movement, or progress spinners. Every command must run unattended in scripts, CI pipelines, and agent tool-call chains without a terminal.

```
# Bad — blocks waiting for input
Are you sure? [y/N]

# Good — flag-driven, no interaction
$ my-cli delete --confirm resource-id
```

If a command is destructive, require an explicit `--confirm` or `--yes` flag instead of prompting.

**TTY-only decoration.** Colors, boxes (`boxen`), tables, spinners, and progress bars are fine — but only when stdout is a TTY. When piped, output must be plain. Check `isatty(stdout)` (or your language's equivalent) and strip all decoration when it returns false. Never use box-drawing libraries like `boxen` in non-TTY mode — they break `grep` and `head`.

### 2. Pipeline-Friendly Output

Your output will be piped through `head`, `tail`, `grep`, `jq`, `awk`, and `wc`. Every design decision flows from this.

**One record per line.** Each line must be a self-contained unit of meaning. This is the single most important rule — it makes every standard Unix tool work for free.

For a single object response, emit one compact JSON line:

```bash
$ my-cli status --output json
{"name":"my-service","status":"running","uptime_seconds":13320}
```

**Use NDJSON when printing arrays or large collections.** When a command returns a list, array, or any potentially large collection of records, use NDJSON (Newline-Delimited JSON) — one JSON object per line, no wrapping array. This lets consumers stream, grep, and slice without buffering or parsing the entire output.

```bash
# NDJSON — each line is independently parseable
$ my-cli list --output json
{"id":"svc-1","name":"api","status":"running"}
{"id":"svc-2","name":"worker","status":"stopped"}
{"id":"svc-3","name":"gateway","status":"running"}

# Standard tools just work:
$ my-cli list --output json | head -1          # first record
$ my-cli list --output json | tail -5          # last 5 records
$ my-cli list --output json | grep '"running"' # filter without jq
$ my-cli list --output json | wc -l            # count records
```

Avoid wrapping collections in a JSON array (`[{...},{...}]`). An array forces the consumer to load and parse the entire output before accessing any single record.

When to use NDJSON vs a single JSON object:

- **Single object** (status, config, get-by-id) → one JSON line
- **Collection** (list, search, logs, events) → NDJSON, one object per line

**stdout is for data only** — no banners, tips, decorative boxes, or log messages. **stderr is for diagnostics** — progress info, warnings, and debug messages go to stderr. Mixing the two corrupts pipelines.

**Consistent shape** — the same command should always return the same JSON schema, using `null` for missing fields rather than omitting keys. Agents hardcode parsers against your schema.

### 3. 2-Attempt Error Recovery

Error messages must include enough context for the caller to succeed on the next attempt. A third attempt means your error message failed.

Every error should include:

1. **What went wrong** — the specific failure
2. **What was expected** — the correct type, shape, or value
3. **An example** — a concrete command that would work

```
# Bad
Error: invalid argument

# Good
Error: <uri> must be a URL (e.g. https://api.example.com/agents/echo)
  or a registered short name (e.g. echo-agent).
  Run 'my-cli list' to see available agents.
```

### 4. Self-Describing Commands

The CLI must describe itself without external documentation:

- `my-cli`, `my-cli --help`, and `my-cli help` should all print the full command listing
- Every command should include at least one concrete usage example in its `--help` output
- Group commands by category in help text so agents (and humans) can find what they need

```
$ my-cli --help
Usage: my-cli <command> [options]

Lifecycle:
  init          Initialize configuration
  doctor        Run health checks
  whoami        Show current identity

Resources:
  list          List available resources
  get <id>      Get a resource by ID
  create        Create a new resource

Run 'my-cli <command> --help' for details on a specific command.
```

### 5. Meaningful Exit Codes

Use exit codes so agents can detect success or failure without parsing output:

| Code | Meaning                                     |
| ---- | ------------------------------------------- |
| `0`  | Success                                     |
| `1`  | General error (bad input, failed operation) |
| `2`  | Usage error (missing argument, bad flag)    |

Always exit non-zero on failure. Never print "error" to stdout and exit 0.

### 6. Idempotent Where Possible

Agents may retry commands. Design commands to be safe to re-run:

- `create` should succeed or return the existing resource if it already exists (or offer `--if-not-exists`)
- `delete` should succeed even if the resource is already gone
- `config set` should be a no-op if the value is already set

### 7. Predictable Argument Patterns

Use consistent patterns across all commands:

```bash
my-cli <noun> <verb> [arguments] [--flags]
# or
my-cli <verb> <noun> [arguments] [--flags]
```

Pick one pattern and stick with it. Common flag conventions:

- `--output <format>` or `-o <format>` — output format (`json`, `text`, `csv`)
- `--yes` or `--confirm` — skip confirmation for destructive actions
- `--quiet` or `-q` — suppress non-essential output
- `--verbose` or `-v` — increase log detail (to stderr)

## Implementation Patterns

### Output Formatting Helper

Centralize output formatting so every command behaves consistently. Create a shared helper that all commands call:

- When `--output json`, emit one JSON object per line (NDJSON) to stdout
- When `--output text` (default), write human-readable key-value lines to stdout
- When stdout is a TTY, you may add colors, tables, or boxes for human readability
- When stdout is piped (not a TTY), strip all ANSI codes and decoration automatically
- Never mix formats — each invocation must produce exactly one format

### Startup Time

Optimize cold-start time. Agents invoke CLIs hundreds of times in a session — a 500ms startup penalty compounds fast.

- Lazy-load heavy dependencies — only import what the invoked command needs
- Avoid top-level network calls, filesystem scans, or config validation on startup
- For long-running background work (watchers, servers, polling), use a daemon pattern — spawn a background process and return immediately with its PID or socket path

### Error Handling with Recovery Hints

Wrap errors in a consistent format that agents can parse and act on. Every error path should:

1. Write the error message to **stderr** (not stdout)
2. Include a recovery hint with an example of a correct invocation
3. Exit with a non-zero code

```
# Example error output (on stderr):
Error: "foobar" is not a valid URI.
Hint: Provide a full URL (e.g. https://example.com/api) or a short name
  (e.g. my-agent). Run 'my-cli list' to see available options.
```

### Config with Safe Defaults

Never crash on missing config. Return sensible defaults so commands work out of the box:

- If no config file exists, use built-in defaults silently
- Merge user config over defaults so new fields are always present
- Document the config file location in `--help` output

## Anti-Patterns to Avoid

| Anti-Pattern                   | Why It Breaks Agents                                      |
| ------------------------------ | --------------------------------------------------------- |
| Interactive prompts            | Agents cannot type into stdin on demand                   |
| Box drawing (`boxen`, borders) | Breaks `grep`, `head`, `tail` — unparseable decoration    |
| Colors/ANSI when piped         | Pollutes parsed output; only use when stdout is a TTY     |
| Spinners and progress bars     | Interfere with stdout parsing                             |
| Paging (`less`, `more`)        | Blocks execution waiting for keypress                     |
| Mixed data and logs on stdout  | Agents can't separate data from noise                     |
| JSON arrays for collections    | Forces loading entire output; use NDJSON for lists/arrays |
| Multi-line pretty-printed JSON | Breaks `grep` and `wc -l`; one record = one line          |
| Inconsistent JSON shape        | Agents hardcode parsers against your schema               |
| Exit 0 on error                | Agents assume success and proceed with bad state          |
| Vague error messages           | Agents waste retries guessing what went wrong             |
| Slow startup (heavy imports)   | Compounds across hundreds of agent invocations            |
| Required env vars without docs | Agents can't discover implicit dependencies               |

## Testing Checklist

When reviewing or testing an agent-facing CLI, verify:

- [ ] Every command runs without a TTY (`echo "" | my-cli command` doesn't hang)
- [ ] Single-object commands produce one valid JSON line
- [ ] Collection commands produce NDJSON (one JSON object per line, no wrapping array)
- [ ] `my-cli list --output json | head -1` returns a valid, self-contained JSON object
- [ ] `my-cli list --output json | grep "keyword"` returns valid JSON lines
- [ ] Errors go to stderr, data goes to stdout
- [ ] Non-zero exit code on all failure paths
- [ ] `--help` includes at least one usage example per command
- [ ] Error messages include what was expected and a recovery hint
- [ ] Commands are idempotent or clearly documented as non-idempotent
- [ ] No ANSI codes, boxes, or decoration when stdout is piped (not a TTY)
- [ ] Startup time is under 100ms for simple commands
