## how to - crossmint api signer
1. [optional] follow quickstart in [faremeter's repo](https://github.com/faremeter/faremeter/blob/ce13cb645047e8a64ce6942c48dd4b3da8f448d0/QUICKSTART.md) to have the facilitator running locally or use facilitator url for this example (`https://facilitator.corbits.dev`)
2. Generate keypairs for the example
  ```
  mkdir keypairs
  ```
  ```
  solana-keygen new --no-bip39-passphrase -o keypairs/payer.json
  solana-keygen new --no-bip39-passphrase -o keypairs/payto.json
  ```
3. setup your `.env` according to the `.env.example`
4. fund your generated accounts with SOL and USDC. Use solana and circle faucet
  - solana faucet: https://faucet.solana.com
  - circle faucet: https://faucet.circle.com
5. Install deps:
  ```
  $ npm i
  ```

6. Build:
  ```
  $ npm run build
  ```
7. start the server:
  ```
  $ npm run start:server
  ```
8. start test script:
  ```
  $ npm run start:test
  ```

## how to - crossmint delegated wallet (an external private key signer to a crossmint smart wallet)

1. generate a keypair named `payer.json` inside `keypair/` directory in root
2. make sure it is funded (SOL and USDC) on devnet
3. create a new delegated wallet: `npm run create:wallet`: creates a new private key wallet - save this in your .env and make sure it is funded with SOL and USDC on solana devnet
    - this wallet will be the one doing the transactions. the `payer` in step 1 will be the one signing on these transactions as the admin signer
    - you can always run `npm run check:wallet` to see the configurations
4. terminal 1: make sure the facilitator is running locally
    - clone `faremeter`
    - follow quickstart
5. terminal 2: make sure the server is running locally (that hosts the paid endpoint)
6. run `npm run start:delegated`
