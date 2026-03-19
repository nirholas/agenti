import 'dotenv/config';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAccount, getAssociatedTokenAddress } from '@solana/spl-token';

const USDC_DEVNET = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
const USDC_MAINNET = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

const ACCOUNTS = [
  { name: 'admin', address: '9sHHeCu5t4Krns3ukcDdehPPBN9wJBY4Tho6j1qMKfg3' },
  { name: 'payer', address: 'AGsuEx7onpV1n4GJRvZuPLxMNnD7GzMJQociE3rwoNGU' },
  { name: 'payto', address: '95ZiDyYRVxdS5frkSHpv8siizRuE5pSsoT9x19VaRLXu' },
  ...(process.env.CROSSMINT_WALLET ? [{ name: 'crossmint-wallet', address: process.env.CROSSMINT_WALLET }] : [])
];

async function getUSDCBalance(connection: Connection, owner: PublicKey, usdcMint: PublicKey, allowOwnerOffCurve = false): Promise<number> {
  try {
    const ata = await getAssociatedTokenAddress(usdcMint, owner, allowOwnerOffCurve);
    const account = await getAccount(connection, ata);
    return Number(account.amount) / 1e6;
  } catch (error) {
    return 0;
  }
}

async function checkBalances(network: string, rpcUrl: string, usdcMint: PublicKey): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${network.toUpperCase()} BALANCES`);
  console.log('='.repeat(60));

  const connection = new Connection(rpcUrl, 'confirmed');

  for (const account of ACCOUNTS) {
    const owner = new PublicKey(account.address);

    const solBalance = await connection.getBalance(owner);
    const solBalanceFormatted = (solBalance / 1e9).toFixed(9);

    // Use allowOwnerOffCurve for smart wallets like Crossmint
    const isSmartWallet = account.name === 'crossmint-wallet';
    const usdcBalance = await getUSDCBalance(connection, owner, usdcMint, isSmartWallet);

    console.log(`\n${account.name.toUpperCase()}`);
    console.log(`  Address: ${account.address}`);
    console.log(`  SOL:     ${solBalanceFormatted} SOL`);
    console.log(`  USDC:    ${usdcBalance.toFixed(2)} USDC`);
  }
}

async function main() {
  console.log('\n🔍 Checking Solana Account Balances...\n');

  await checkBalances('devnet', 'https://api.devnet.solana.com', USDC_DEVNET);
  await checkBalances('mainnet', 'https://api.mainnet-beta.solana.com', USDC_MAINNET);

  console.log(`\n${'='.repeat(60)}\n`);
}

main().catch(console.error);
