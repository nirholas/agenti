# Codebase Analysis: ag402 Prepaid System

## Executive Summary

The ag402 project is an OpenClaw skill implementing an AI Agent Payment Protocol. It handles payments via HTTP 402 using a local wallet system with JSON file storage. The prepaid system will add a pre-paid credit pool mechanism to reduce on-chain transaction costs.

## Project Structure

```
ag402-skill/
├── skill.py              # Main skill file (~600 lines)
├── SKILL.md              # Skill metadata
├── TOOLS.md              # Tool definitions
├── __init__.py           # Package init
├── PRDs/                 # Product requirements
├── PRPs/                 # Planning and execution
├── references/          # Documentation
└── scripts/              # Helper scripts
```

## Relevant Patterns Found

### 1. Data Storage Pattern (JSON Files)
**Location**: skill.py lines 50-120

Uses JSON files for persistence:
- Config: ~/.ag402/config.json
- Wallet: ~/.ag402/wallet.json
- Transactions: ~/.ag402/transactions.json

### 2. Transaction Pattern
Transactions stored as list of dicts with:
- tx_id, type, amount, status, details, endpoint, timestamp

### 3. Command Pattern
Commands are async functions:
- cmd_<command_name>(args) -> dict
- Return {"status": "success"|"error", "message": ..., ...}

### 4. Configuration Pattern
Default config with wallet, network, logging sections + test_mode

## Architecture Insights

### Buyer Flow (existing)
1. cmd_pay() validates URL, checks wallet balance
2. Deducts from local balance
3. Records transaction
4. Makes HTTP request

### Seller Flow (to implement)
1. Receive HTTP request with X-Prepaid-Credential header
2. Validate credential signature and expiry
3. Decrement remaining calls
4. Return 200 or 402

## Implementation Guidance

### Must Follow
- Use Path.home() / ".ag402" for storage directory
- Use JSON file storage (follow existing patterns)
- Async functions for all commands
- Return dict with "status" key

### Recommended Approach
- Create separate module files for prepaid system
- Use dataclasses for data models
- Integrate with existing cmd_pay() function
- Add "prepaid" subcommand for buying packages

## Files to Reference

| File | Lines | Purpose |
|------|-------|---------|
| skill.py | 40-70 | Config/wallet paths |
| skill.py | 100-140 | Transaction functions |
| skill.py | 200-300 | Command implementations |
| skill.py | 300-400 | cmd_pay() implementation |

## Validation Commands

```bash
cd /Users/allenenli/Documents/ag402/adapters/openclaw/ag402-skill && python -c "import skill; print('OK')"
```
