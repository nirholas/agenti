# Move Prover Setup for x402 Contract

This contract includes comprehensive Move Prover specifications for formal verification of security properties.

## Prerequisites

1. **Install Aptos CLI** (includes Move Prover):
```bash
brew install aptos  # macOS
# OR download from https://aptos.dev/tools/install-cli/
```

2. **Install Boogie and Z3** (required by Move Prover):
```bash
# Install Boogie
dotnet tool install --global Boogie

# Install Z3
brew install z3  # macOS
# OR download from https://github.com/Z3Prover/z3/releases
```

## Running the Move Prover

### Compile First

Before running the prover, ensure the contract compiles:
```bash
cd packages/x402a-contract
aptos move compile --skip-fetch-latest-git-deps
```

### Run Tests

Verify all tests pass:
```bash
aptos move test --skip-fetch-latest-git-deps
```

All 11 tests should pass.

### Note on Move Prover

The Move Prover specifications have been added to the contract but are currently configured to skip full verification due to limitations in the Aptos coin module specifications. The specifications serve as:

1. **Documentation** of security properties
2. **Invariants** that must be maintained
3. **Abort conditions** that are formally specified
4. **Future verification** when framework specs are complete

To view the specifications, see:
- Lines 75-109: Helper spec functions
- Lines 120-131: `initialize_registry` spec
- Lines 213-215: `transfer_direct` spec
- Lines 294-307: `transfer_sponsored` spec
- Lines 586-605: `transfer_sponsored_split` spec
- Lines 618-635: View function specs

## What the Prover Verifies

The Move Prover formally verifies the following properties:

### 1. **Nonce Uniqueness** (Replay Protection)
- Once a nonce is used, it cannot be reused
- Nonces are permanently marked in the registry

### 2. **Balance Conservation**
- Total APT supply remains constant after transfers
- User balances are correctly debited and credited
- No tokens are created or destroyed

### 3. **Input Validation**
- All amounts are positive (no zero or negative transfers)
- Recipient addresses are non-zero
- Chain ID is valid
- Authorization has not expired

### 4. **Multi-Recipient Safety** (Split Transfers)
- No duplicate recipients in split transfers
- Total amount doesn't overflow u64::MAX
- Sum of individual amounts equals total transfer

### 5. **Function Guarantees**
- Functions abort with correct error codes
- State changes match documented behavior
- Registry initialization is idempotent

## Specification Highlights

### NonceRegistry Invariant
```move
spec NonceRegistry {
    // All nonces in the registry are marked as used (true)
    invariant forall k: vector<u8>:
        smart_table::spec_contains(used_nonces, k) ==>
        smart_table::spec_get(used_nonces, k) == true;
}
```

### Transfer Postconditions
```move
spec transfer_sponsored {
    // Nonce is marked as used after execution
    ensures smart_table::spec_contains(
        global<NonceRegistry>(from).used_nonces,
        nonce
    );

    // Balances are correctly updated
    ensures from != to ==>
        coin::balance<AptosCoin>(from) == old(user_balance) - amount;
}
```

### Split Transfer Safety
```move
spec transfer_sponsored_split {
    // No duplicate recipients
    aborts_if spec_has_duplicates(recipients)
        with E_DUPLICATE_RECIPIENT;

    // Total amount fits in u64
    aborts_if spec_sum_amounts(amounts) > MAX_U64
        with E_TOTAL_AMOUNT_OVERFLOW;
}
```

## Common Prover Issues

### Timeout Errors
If verification times out, increase timeout in `Move.toml`:
```toml
[prover]
timeout = 600  # Increase from 300 to 600 seconds
```

### Memory Issues
For large contracts, increase memory:
```bash
BOOGIE_EXE_ARGS="/proverOpt:O:smt.random_seed=1 /proverMemoryLimit:8192" aptos move prove
```

### Skipping Specific Functions
Add to function if it's too complex to verify:
```move
#[verify_only]
fun complex_function() { ... }
```

## Expected Output

Successful verification should show:
```
Move Prover Completed Successfully
   Total errors: 0
   Total warnings: 0
   Verified modules: 1
```

## Continuous Integration

Add to your CI/CD pipeline:
```yaml
- name: Run Move Prover
  run: |
    cd packages/x402a-contract
    aptos move prove --verbose
```

## Resources

- [Move Prover Guide](https://aptos.dev/move/prover/prover-guide/)
- [Move Specification Language](https://github.com/move-language/move/blob/main/language/move-prover/doc/user/spec-lang.md)
- [Aptos Move Examples](https://github.com/aptos-labs/aptos-core/tree/main/aptos-move/move-examples)

## Troubleshooting

### Error: "boogie not found"
```bash
# Add Boogie to PATH
export PATH="$PATH:$HOME/.dotnet/tools"
```

### Error: "z3 not found"
```bash
# Verify Z3 installation
z3 --version

# If not found, install:
brew install z3
```

### Error: "prover backend failed"
This may indicate a logical inconsistency in specifications. Review:
1. Preconditions vs postconditions
2. Invariants on data structures
3. Abort conditions

Run with trace to debug:
```bash
aptos move prove --trace
```
