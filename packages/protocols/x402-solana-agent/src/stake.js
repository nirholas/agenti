/**
 * Solana Agent Kit - Staking Module
 * Native SOL staking to validators
 */

const {
  PublicKey,
  Transaction,
  StakeProgram,
  Authorized,
  Lockup,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  Keypair
} = require('@solana/web3.js');

// Popular validators (can be expanded)
const VALIDATORS = {
  'jito': 'J1to1yufRnoWn81KYg1XkTWzmKjnYSnmE2VY8DGUJ9Qv',
  'marinade': 'mrgn28BhocwdAUEenen3Sw2MR9cPKDpLkDvzDdR7DBD',
  'solflare': 'SoLFLaReRVNagJzYYGppSkqzkhmHZ5ZR8EUpzqLEAaL',
  'everstake': 'EverSFw9uN5t1V8kS3ficHUcKffSjwpGzUSGd7mgmSks'
};

class Staking {
  constructor(wallet) {
    this.wallet = wallet;
  }

  /**
   * Resolve validator name or vote account address
   */
  resolveValidator(validatorOrAddress) {
    if (VALIDATORS[validatorOrAddress.toLowerCase()]) {
      return VALIDATORS[validatorOrAddress.toLowerCase()];
    }
    return validatorOrAddress;
  }

  /**
   * Create a stake account and delegate to a validator
   */
  async stake(validatorVoteAccount, amountSol) {
    const voteAccount = new PublicKey(this.resolveValidator(validatorVoteAccount));
    const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

    // Create a new stake account keypair
    const stakeAccount = Keypair.generate();

    // Minimum for rent exemption + stake
    const rentExemption = await this.wallet.connection.getMinimumBalanceForRentExemption(
      StakeProgram.space
    );

    const totalLamports = lamports + rentExemption;

    // Create stake account
    const createStakeAccountTx = StakeProgram.createAccount({
      fromPubkey: this.wallet.keypair.publicKey,
      stakePubkey: stakeAccount.publicKey,
      authorized: new Authorized(
        this.wallet.keypair.publicKey, // staker
        this.wallet.keypair.publicKey  // withdrawer
      ),
      lockup: new Lockup(0, 0, this.wallet.keypair.publicKey),
      lamports: totalLamports
    });

    // Delegate stake
    const delegateTx = StakeProgram.delegate({
      stakePubkey: stakeAccount.publicKey,
      authorizedPubkey: this.wallet.keypair.publicKey,
      votePubkey: voteAccount
    });

    // Combine transactions
    const transaction = new Transaction()
      .add(createStakeAccountTx)
      .add(delegateTx);

    const signature = await sendAndConfirmTransaction(
      this.wallet.connection,
      transaction,
      [this.wallet.keypair, stakeAccount]
    );

    return {
      signature,
      stakeAccount: stakeAccount.publicKey.toBase58(),
      validator: voteAccount.toBase58(),
      amount: amountSol,
      explorerUrl: `https://solscan.io/tx/${signature}`
    };
  }

  /**
   * Get all stake accounts for this wallet
   */
  async getStakeAccounts() {
    const stakeAccounts = await this.wallet.connection.getParsedProgramAccounts(
      StakeProgram.programId,
      {
        filters: [
          {
            memcmp: {
              offset: 12, // Authorized staker offset
              bytes: this.wallet.keypair.publicKey.toBase58()
            }
          }
        ]
      }
    );

    return stakeAccounts.map(({ pubkey, account }) => {
      const data = account.data.parsed.info;
      return {
        address: pubkey.toBase58(),
        lamports: account.lamports,
        sol: account.lamports / LAMPORTS_PER_SOL,
        state: data.stake?.delegation ? 'delegated' : 'inactive',
        validator: data.stake?.delegation?.voter || null,
        activationEpoch: data.stake?.delegation?.activationEpoch || null
      };
    });
  }

  /**
   * Deactivate a stake account (start unstaking)
   */
  async unstake(stakeAccountAddress) {
    const stakeAccount = new PublicKey(stakeAccountAddress);

    const transaction = new Transaction().add(
      StakeProgram.deactivate({
        stakePubkey: stakeAccount,
        authorizedPubkey: this.wallet.keypair.publicKey
      })
    );

    const signature = await sendAndConfirmTransaction(
      this.wallet.connection,
      transaction,
      [this.wallet.keypair]
    );

    return {
      signature,
      stakeAccount: stakeAccountAddress,
      status: 'deactivating',
      note: 'Stake will be withdrawable after the current epoch ends',
      explorerUrl: `https://solscan.io/tx/${signature}`
    };
  }

  /**
   * Withdraw from a deactivated stake account
   */
  async withdraw(stakeAccountAddress) {
    const stakeAccount = new PublicKey(stakeAccountAddress);
    
    const stakeBalance = await this.wallet.connection.getBalance(stakeAccount);

    const transaction = new Transaction().add(
      StakeProgram.withdraw({
        stakePubkey: stakeAccount,
        authorizedPubkey: this.wallet.keypair.publicKey,
        toPubkey: this.wallet.keypair.publicKey,
        lamports: stakeBalance
      })
    );

    const signature = await sendAndConfirmTransaction(
      this.wallet.connection,
      transaction,
      [this.wallet.keypair]
    );

    return {
      signature,
      stakeAccount: stakeAccountAddress,
      withdrawn: stakeBalance / LAMPORTS_PER_SOL,
      explorerUrl: `https://solscan.io/tx/${signature}`
    };
  }

  /**
   * List known validators
   */
  static listValidators() {
    return VALIDATORS;
  }
}

module.exports = { Staking, VALIDATORS };
