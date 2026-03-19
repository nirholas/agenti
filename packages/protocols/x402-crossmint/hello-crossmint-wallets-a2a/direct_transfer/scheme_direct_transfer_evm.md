# Scheme: `direct-transfer` `EVM`

## Summary

The `direct-transfer` scheme on EVM uses an ERC‑20 `transfer(payTo, amount)` executed by the payer. The `X-PAYMENT` payload contains the transaction hash and details so a resource server (or facilitator) can verify on-chain and accept payment.

## `X-Payment` header payload

The `payload` field of `X-PAYMENT` must contain:

- `transaction`: Transaction hash of the ERC‑20 transfer
- `payer`: Payer address (sender of the ERC‑20 Transfer event)
- `asset`: ERC‑20 token contract address
- `payTo`: Recipient address
- `value`: Amount in atomic units as string

Example:

```json
{
  "transaction": "0x771ca89b6b06d62fe3728e52fb8386c923d4f28a86f27685ea846277ec1d38e5",
  "payer": "0xPayerAddress",
  "asset": "0xTokenAddress",
  "payTo": "0xMerchantEOA",
  "value": "1000000"
}
```

Full `X-PAYMENT` header:

```json
{
  "x402Version": 1,
  "scheme": "direct-transfer",
  "network": "base-sepolia",
  "payload": {
    "transaction": "0x771ca89b6b06d62fe3728e52fb8386c923d4f28a86f27685ea846277ec1d38e5",
    "payer": "0xPayerAddress",
    "asset": "0xTokenAddress",
    "payTo": "0xMerchantEOA",
    "value": "1000000"
  }
}
```

## Verification

1. Fetch the transaction receipt by hash.
2. Confirm status is success.
3. Parse logs for the ERC‑20 `Transfer(address,address,uint256)` emitted by `asset`.
4. Ensure:
   - `from == payer`
   - `to == payTo`
   - `value == paymentRequirements.maxAmountRequired`
5. Optionally ensure the receipt timestamp is within `maxTimeoutSeconds` from the `paymentRequirements` issuance.

## Settlement

- None required: the transfer is already executed by the payer. The resource server records the receipt and marks payment as completed.

## Appendix

- Proxies/multicall: validation MUST rely on Transfer logs emitted by `asset`, not `receipt.to`.
- Chain finality: implement minimal receipt polling/backoff for UX; facilitator may wait for additional confirmations based on risk tolerance.
