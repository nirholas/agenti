# Account Modules Deployment Scripts

## Deploy.s.sol

Deploys the AutoTopUpExecutor and AutoCollectExecutor modules using Safe's Singleton Factory for deterministic addresses
across all chains.

### Usage

#### Predict Addresses (without deploying)

```bash
forge script script/Deploy.s.sol:Deploy --sig "predict()"
```

#### Deploy to a Network

```bash
# Set required environment variables
export PRIVATE_KEY=<your-private-key>

# Deploy to Base Sepolia
forge script script/Deploy.s.sol:Deploy \
  --rpc-url <base-sepolia-rpc-url> \
  --broadcast \
  --verify

# Deploy to Base Mainnet
forge script script/Deploy.s.sol:Deploy \
  --rpc-url <base-mainnet-rpc-url> \
  --broadcast \
  --verify
```

### Deployed Addresses

The modules will be deployed to the same addresses on all chains:

- **AutoTopUpExecutor**: `0x92Be8FA04bF1d9Ee311F4B2754Ca22252ccA18D4`
- **AutoCollectExecutor**: `0x6647fA97ff1f04614A0A960dcF499545c4DcC431`

### Notes

- The contracts are deployed as immutable singletons (no upgradeability, no owner)
- Addresses are deterministic using Safe Singleton Factory
- The factory is deployed on 250+ chains at: `0x914d7Fec6aaC8cd542e72Bca78B30650d45643d7`
