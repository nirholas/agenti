# Routing Profiles & Pricing

ClawRouter offers four routing profiles to balance cost vs quality. Prices are in **$/M tokens** (input/output).

## ECO (Absolute Cheapest)

Use `blockrun/eco` for maximum cost savings.

| Tier      | Primary Model                | Input | Output |
| --------- | ---------------------------- | ----- | ------ |
| SIMPLE    | nvidia/gpt-oss-120b          | $0.00 | $0.00  |
| MEDIUM    | google/gemini-2.5-flash-lite | $0.10 | $0.40  |
| COMPLEX   | google/gemini-2.5-flash-lite | $0.10 | $0.40  |
| REASONING | xai/grok-4-1-fast-reasoning  | $0.20 | $0.50  |

---

## AUTO (Balanced - Default)

Use `blockrun/auto` for the best quality/price balance.

| Tier      | Primary Model                 | Input | Output |
| --------- | ----------------------------- | ----- | ------ |
| SIMPLE    | moonshot/kimi-k2.5            | $0.60 | $3.00  |
| MEDIUM    | xai/grok-code-fast-1          | $0.20 | $1.50  |
| COMPLEX   | google/gemini-3.1-pro         | $2.00 | $12.00 |
| REASONING | xai/grok-4-1-fast-reasoning   | $0.20 | $0.50  |

---

## PREMIUM (Best Quality)

Use `blockrun/premium` for maximum quality.

| Tier      | Primary Model        | Input | Output |
| --------- | -------------------- | ----- | ------ |
| SIMPLE    | moonshot/kimi-k2.5   | $0.60 | $3.00  |
| MEDIUM    | openai/gpt-5.2-codex | $1.75 | $14.00 |
| COMPLEX   | claude-opus-4.6      | $5.00 | $25.00 |
| REASONING | claude-sonnet-4.6    | $3.00 | $15.00 |

---

## AGENTIC (Multi-Step Tasks)

Use `blockrun/agentic` for autonomous multi-step tasks, or let ClawRouter auto-detect agentic patterns.

| Tier      | Primary Model        | Input | Output |
| --------- | -------------------- | ----- | ------ |
| SIMPLE    | moonshot/kimi-k2.5   | $0.60 | $3.00  |
| MEDIUM    | xai/grok-code-fast-1 | $0.20 | $1.50  |
| COMPLEX   | claude-sonnet-4.6    | $3.00 | $15.00 |
| REASONING | claude-sonnet-4.6    | $3.00 | $15.00 |

---

## ECO vs AUTO Savings

| Tier      | ECO   | AUTO   | Savings  |
| --------- | ----- | ------ | -------- |
| SIMPLE    | FREE  | $3.60  | **100%** |
| MEDIUM    | $0.50 | $1.70  | **71%**  |
| COMPLEX   | $0.50 | $14.00 | **96%**  |
| REASONING | $0.70 | $0.70  | 0%       |

---

## How Tiers Work

ClawRouter automatically classifies your query into one of four tiers:

- **SIMPLE**: Basic questions, short responses, simple lookups
- **MEDIUM**: Code generation, moderate complexity tasks
- **COMPLEX**: Large context, multi-step reasoning, complex code
- **REASONING**: Logic puzzles, math, chain-of-thought tasks

The router picks the cheapest model capable of handling your query's tier.

---

_Last updated: v0.12.24_
