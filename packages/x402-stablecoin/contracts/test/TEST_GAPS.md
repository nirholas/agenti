# X402 Test Coverage Gap Analysis

This document identifies missing tests and untested functionality across X402 smart contracts, prioritized by risk.

## Summary

| Contract | Estimated Coverage | Risk Level | Priority |
|----------|-------------------|------------|----------|
| ToolRegistry | ~85% | High | P1 |
| X402CreditSystem | ~80% | Critical | P0 |
| X402PaymentChannel | ~82% | Critical | P0 |
| X402Subscription | ~78% | High | P1 |
| X402RevenueSplitter | ~65% | Medium | P2 |

---

## Critical (P0) - Missing Tests

### 1. X402CreditSystem - Yield Tracking

**Risk**: High - Incorrect yield calculations could result in user fund loss

**Missing Tests**:
```solidity
// test/CreditSystem.Yield.t.sol - TO BE CREATED

function test_YieldAccumulation_AfterRebase() public {
    // Deposit credits
    // Simulate USDs rebase (creditsPerToken changes)
    // Verify getCreditBalance reflects yield
}

function test_YieldEarned_CalculatesCorrectly() public {
    // Deposit 100 USDs
    // Simulate 5% yield
    // Verify getYieldEarned returns ~5 USDs
}

function test_Withdraw_IncludesYield() public {
    // Deposit, simulate rebase
    // Withdraw full balance
    // Verify user receives principal + yield
}

function test_UseCredits_DeductsFromYield() public {
    // Deposit, accumulate yield
    // Use credits > original deposit
    // Verify yield is used
}
```

### 2. X402PaymentChannel - Dispute Resolution

**Risk**: Critical - Incorrect dispute handling could lock funds

**Missing Tests**:
```solidity
// test/PaymentChannel.Disputes.t.sol - TO BE CREATED

function test_ChallengeClose_RevertInvalidNonce() public {
    // Try to challenge with lower nonce
    // Should revert
}

function test_ChallengeClose_RevertAfterPeriod() public {
    // Initiate close
    // Wait past challenge period
    // Try to challenge
    // Should revert
}

function test_MultipleChallengers() public {
    // Sender initiates close
    // Recipient challenges
    // Sender challenges back
    // Verify final state is correct
}

function test_DisputeWithMaxUint256Amount() public {
    // Edge case: dispute with max amount
    // Should handle correctly
}
```

### 3. X402PaymentChannel - Emergency Functions

**Risk**: Critical - Emergency recovery needs thorough testing

**Missing Tests**:
```solidity
// test/PaymentChannel.Emergency.t.sol - TO BE CREATED

function test_EmergencyWithdraw_OnlyOwner() public {
    // Test access control
}

function test_EmergencyWithdraw_DoesNotAffectOpenChannels() public {
    // Open channels
    // Emergency withdraw
    // Verify channel balances intact
}

function test_PauseDoesNotAffectExistingChannels() public {
    // Open channel
    // Pause
    // Existing operations should work (close, etc.)
}
```

---

## High Priority (P1) - Missing Tests

### 4. ToolRegistry - Upgrade Tests

**Missing Tests**:
```solidity
// test/upgrades/ToolRegistry.Upgrade.t.sol - TO BE CREATED

function test_UpgradeToV2_PreservesAllState() public {
    // Register multiple tools
    // Process payments
    // Upgrade
    // Verify all data intact
}

function test_UpgradeToV2_NewFunctionsWork() public {
    // Upgrade
    // Call new V2 functions
}

function test_DoubleInitialize_Reverts() public {
    // Try to call initialize twice
    // Should revert
}

function test_StorageCollision_Prevention() public {
    // Verify storage gap is correct
    // Add new storage in V2
    // Verify no collision
}
```

### 5. X402Subscription - Payment Token Support

**Missing Tests**:
```solidity
// test/Subscription.MultiToken.t.sol - TO BE CREATED

function test_CreateSubscription_WithNonUSDsToken() public {
    // Add new supported token
    // Create subscription with it
    // Execute subscription
}

function test_DepositFunds_MultipleTokens() public {
    // Deposit USDs
    // Add another token
    // Deposit other token
    // Use both for subscriptions
}

function test_RemoveToken_ExistingSubscriptions() public {
    // Create subscription with token
    // Remove token support
    // Existing subscriptions should still work
}
```

### 6. ToolRegistry - Batch Operations Edge Cases

**Missing Tests**:
```solidity
// test/ToolRegistry.Batch.t.sol - TO BE CREATED

function test_BatchPayForTools_EmptyArray() public {
    // Call with empty array
    // Should not revert (no-op)
}

function test_BatchPayForTools_OneInactiveTool() public {
    // Array has one inactive tool
    // Should revert entire batch
}

function test_BatchPayForTools_GasLimitExceeded() public {
    // Large batch that exceeds block gas
    // Should handle gracefully
}

function test_BatchPayForTools_PartialTokenApproval() public {
    // Approve less than total needed
    // Should revert with clear error
}
```

---

## Medium Priority (P2) - Missing Tests

### 7. X402RevenueSplitter - Edge Cases

**Missing Tests**:
```solidity
// test/RevenueSplitter.t.sol - EXTEND EXISTING

function test_ProcessPayment_RoundingDown() public {
    // Pay 1 wei
    // Verify rounding doesn't break
}

function test_ProcessPayment_MaxUint256() public {
    // Pay max uint256
    // Should handle overflow protection
}

function test_BatchPayments_EmptyArray() public {
    // Empty array should not revert
}

function test_BatchPayments_1000Items() public {
    // Large batch stress test
}

function testFuzz_FeeCalculation_NeverExceedsInput(uint256 amount) public {
    // Fuzz: platformAmount + developerAmount == amount always
}
```

### 8. X402CreditSystem - Expiration Logic

**Missing Tests**:
```solidity
// test/CreditSystem.Expiration.t.sol - TO BE CREATED

function test_ExpiredCredits_CannotUse() public {
    // Deposit
    // Set expiration
    // Warp past expiration
    // Try to use credits
    // Should revert
}

function test_ExpiredCredits_CanStillWithdraw() public {
    // Expired credits should still be withdrawable
    // (Policy decision - verify current behavior)
}

function test_UpdateActivity_ResetsExpiration() public {
    // Deposit
    // Use some credits (updates lastUpdate)
    // Verify expiration timer reset
}
```

### 9. All Contracts - Reentrancy Tests

**Missing Tests**:
```solidity
// test/security/Reentrancy.t.sol - TO BE CREATED

contract MaliciousToken {
    function transferFrom(address, address, uint256) external returns (bool) {
        // Try to reenter
        IToolRegistry(msg.sender).payForTool("other-tool");
        return true;
    }
}

function test_ToolRegistry_ReentrancyProtection() public {
    // Deploy malicious token
    // Add as supported
    // Try to exploit
    // Should be blocked by ReentrancyGuard
}

function test_CreditSystem_ReentrancyProtection() public {
    // Similar test for credit system
}

function test_PaymentChannel_ReentrancyProtection() public {
    // Similar test for payment channels
}
```

---

## Low Priority (P3) - Nice to Have

### 10. Gas Optimization Tests

```solidity
// test/gas/GasBenchmarks.t.sol - TO BE CREATED

function test_Gas_RegisterTool_Cold() public {
    // First registration (cold storage)
    // Record gas
}

function test_Gas_RegisterTool_Warm() public {
    // After some registrations (warm storage)
    // Record gas
}

function test_Gas_PayForTool_Comparison() public {
    // Compare gas: payForTool vs payForToolWithAmount
}

function test_Gas_BatchPayVsIndividual() public {
    // 10 batch payments vs 10 individual
    // Calculate savings
}
```

### 11. Invariant Tests

```solidity
// test/invariants/ - TO BE CREATED

contract ToolRegistryInvariant is Test {
    function invariant_totalToolsMatchesMapping() public {
        // totalTools == sum of active tools
    }
    
    function invariant_noNegativeRevenue() public {
        // Tool revenue >= 0 always
    }
}

contract CreditSystemInvariant is Test {
    function invariant_balancesConsistent() public {
        // Sum of user balances <= contract token balance
    }
    
    function invariant_depositsMinusWithdrawals() public {
        // totalDeposits - totalWithdrawals == approximate balance
    }
}

contract PaymentChannelInvariant is Test {
    function invariant_tvlMatchesDeposits() public {
        // TVL == sum of open channel deposits
    }
    
    function invariant_withdrawnNeverExceedsDeposit() public {
        // For any channel: withdrawn <= deposit
    }
}
```

---

## Recommended Test File Structure

```
contracts/test/
├── ToolRegistry.t.sol              ✅ Exists
├── CreditSystem.t.sol              ✅ Exists
├── PaymentChannel.t.sol            ✅ Exists
├── Subscription.t.sol              ✅ Exists
├── X402RevenueSplitter.t.sol       ✅ Exists
├── TESTING_GUIDE.md                ✅ Created
│
├── mocks/                          ❌ Create
│   ├── MockUSDs.sol
│   ├── MockMaliciousToken.sol
│   └── MockPaymentRecipient.sol
│
├── upgrades/                       ❌ Create
│   ├── ToolRegistry.Upgrade.t.sol
│   ├── CreditSystem.Upgrade.t.sol
│   └── PaymentChannel.Upgrade.t.sol
│
├── integration/                    ❌ Create
│   ├── FullPaymentFlow.t.sol
│   ├── YieldAccumulation.t.sol
│   └── CrossContractInteraction.t.sol
│
├── security/                       ❌ Create
│   ├── Reentrancy.t.sol
│   └── AccessControl.t.sol
│
├── invariants/                     ❌ Create
│   ├── ToolRegistryInvariant.t.sol
│   ├── CreditSystemInvariant.t.sol
│   └── PaymentChannelInvariant.t.sol
│
└── gas/                            ❌ Create
    └── GasBenchmarks.t.sol
```

---

## Action Items by Priority

### Week 1 (P0 - Critical)
1. [ ] Create yield tracking tests for CreditSystem
2. [ ] Create dispute resolution tests for PaymentChannel
3. [ ] Create emergency function tests

### Week 2 (P1 - High)
4. [ ] Create upgrade tests for all UUPS contracts
5. [ ] Create multi-token support tests
6. [ ] Create batch operation edge case tests

### Week 3 (P2 - Medium)
7. [ ] Extend RevenueSplitter tests
8. [ ] Create expiration logic tests
9. [ ] Create reentrancy protection tests

### Week 4 (P3 - Polish)
10. [ ] Create gas benchmark tests
11. [ ] Create invariant tests
12. [ ] Run full coverage report and fill gaps

---

## Coverage Targets After Completion

| Contract | Current | Target | Gap |
|----------|---------|--------|-----|
| ToolRegistry | ~85% | 95% | +10% |
| X402CreditSystem | ~80% | 95% | +15% |
| X402PaymentChannel | ~82% | 95% | +13% |
| X402Subscription | ~78% | 90% | +12% |
| X402RevenueSplitter | ~65% | 90% | +25% |

---

## Running Gap Analysis

To identify specific untested lines:

```bash
# Generate detailed coverage report
cd contracts
forge coverage --report lcov

# Generate HTML report (requires lcov)
genhtml lcov.info -o coverage-report

# View in browser
open coverage-report/index.html
```

The HTML report will highlight:
- 🔴 Uncovered lines (red)
- 🟡 Partially covered branches (yellow)
- 🟢 Fully covered (green)

Focus on red lines in high-risk functions first.
