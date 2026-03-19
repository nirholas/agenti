#!/usr/bin/env node
/**
 * Solana Agent Kit - CLI
 * Command-line interface for AI agents to interact with Solana
 * 
 * Usage:
 *   solana-agent wallet create
 *   solana-agent wallet balance [--address <addr>]
 *   solana-agent wallet tokens
 *   solana-agent swap quote <from> <to> <amount>
 *   solana-agent swap execute <from> <to> <amount>
 *   solana-agent price <token>
 *   solana-agent transfer <to> <amount> [--token <mint>]
 */

const { Wallet } = require('./wallet');
const { Swapper, TOKENS } = require('./swap');
const { Transfer } = require('./transfer');
const { Staking, VALIDATORS } = require('./stake');
const path = require('path');
const fs = require('fs');

// Default wallet path
const DEFAULT_WALLET_PATH = process.env.SOLANA_WALLET_PATH || 
  path.join(process.env.HOME, '.config', 'solana', 'id.json');

// RPC URL
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

async function loadWallet() {
  if (!fs.existsSync(DEFAULT_WALLET_PATH)) {
    console.error(`Wallet not found at ${DEFAULT_WALLET_PATH}`);
    console.error('Create one with: solana-agent wallet create');
    process.exit(1);
  }
  return Wallet.fromFile(DEFAULT_WALLET_PATH, RPC_URL);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const subcommand = args[1];

  try {
    switch (command) {
      case 'wallet': {
        switch (subcommand) {
          case 'create': {
            const wallet = Wallet.create(RPC_URL);
            const savePath = args[2] || DEFAULT_WALLET_PATH;
            wallet.save(savePath);
            console.log(JSON.stringify({
              success: true,
              address: wallet.address,
              path: savePath,
              warning: 'Backup your wallet file! Loss means loss of funds.'
            }, null, 2));
            break;
          }

          case 'balance': {
            const wallet = await loadWallet();
            const balance = await wallet.getBalance();
            console.log(JSON.stringify({
              address: wallet.address,
              balance: balance,
              unit: 'SOL'
            }, null, 2));
            break;
          }

          case 'tokens': {
            const wallet = await loadWallet();
            const tokens = await wallet.getAllTokenBalances();
            console.log(JSON.stringify({
              address: wallet.address,
              tokens: tokens
            }, null, 2));
            break;
          }

          case 'address': {
            const wallet = await loadWallet();
            console.log(wallet.address);
            break;
          }

          default:
            console.error('Unknown wallet command. Use: create, balance, tokens, address');
            process.exit(1);
        }
        break;
      }

      case 'swap': {
        const wallet = await loadWallet();
        const swapper = new Swapper(wallet);

        switch (subcommand) {
          case 'quote': {
            const [, , from, to, amount] = args;
            if (!from || !to || !amount) {
              console.error('Usage: solana-agent swap quote <from> <to> <amount>');
              process.exit(1);
            }
            const quote = await swapper.getQuote(from, to, amount);
            console.log(JSON.stringify({
              from: from,
              to: to,
              inputAmount: quote.inAmount,
              outputAmount: quote.outAmount,
              priceImpact: quote.priceImpactPct,
              route: quote.routePlan?.map(r => r.swapInfo?.label).filter(Boolean)
            }, null, 2));
            break;
          }

          case 'execute': {
            const [, , from, to, amount] = args;
            if (!from || !to || !amount) {
              console.error('Usage: solana-agent swap execute <from> <to> <amount>');
              process.exit(1);
            }
            console.error(`Swapping ${amount} ${from} -> ${to}...`);
            const result = await swapper.swap(from, to, amount);
            console.log(JSON.stringify({
              success: true,
              signature: result.signature,
              inputAmount: result.inAmount,
              outputAmount: result.outAmount,
              explorer: result.explorerUrl
            }, null, 2));
            break;
          }

          default:
            console.error('Unknown swap command. Use: quote, execute');
            process.exit(1);
        }
        break;
      }

      case 'price': {
        const token = args[1];
        if (!token) {
          console.error('Usage: solana-agent price <token>');
          process.exit(1);
        }
        const wallet = await loadWallet();
        const swapper = new Swapper(wallet);
        const price = await swapper.getPrice(token);
        console.log(JSON.stringify({
          token: token,
          price: price,
          unit: 'USDC'
        }, null, 2));
        break;
      }

      case 'transfer': {
        const wallet = await loadWallet();
        const transfer = new Transfer(wallet);
        const [, to, amount] = args;
        
        // Check for --token flag
        const tokenIdx = args.indexOf('--token');
        const tokenMint = tokenIdx !== -1 ? args[tokenIdx + 1] : null;

        if (!to || !amount) {
          console.error('Usage: solana-agent transfer <to> <amount> [--token <mint>]');
          process.exit(1);
        }

        console.error(`Transferring ${amount} ${tokenMint || 'SOL'} to ${to}...`);
        const result = tokenMint 
          ? await transfer.sendToken(to, amount, tokenMint)
          : await transfer.sendSol(to, amount);
        
        console.log(JSON.stringify({
          success: true,
          signature: result.signature,
          to: to,
          amount: amount,
          token: tokenMint || 'SOL',
          explorer: result.explorerUrl
        }, null, 2));
        break;
      }

      case 'tokens': {
        // List known tokens
        console.log(JSON.stringify(TOKENS, null, 2));
        break;
      }

      case 'stake': {
        const wallet = await loadWallet();
        const staking = new Staking(wallet);

        switch (subcommand) {
          case 'delegate': {
            const [, , validator, amount] = args;
            if (!validator || !amount) {
              console.error('Usage: solana-agent stake delegate <validator> <amount_sol>');
              console.error('Validators:', Object.keys(VALIDATORS).join(', '));
              process.exit(1);
            }
            console.error(`Staking ${amount} SOL to ${validator}...`);
            const result = await staking.stake(validator, parseFloat(amount));
            console.log(JSON.stringify({
              success: true,
              ...result
            }, null, 2));
            break;
          }

          case 'list': {
            const accounts = await staking.getStakeAccounts();
            console.log(JSON.stringify({
              address: wallet.address,
              stakeAccounts: accounts,
              totalStaked: accounts.reduce((sum, a) => sum + a.sol, 0)
            }, null, 2));
            break;
          }

          case 'unstake': {
            const stakeAddr = args[2];
            if (!stakeAddr) {
              console.error('Usage: solana-agent stake unstake <stake_account_address>');
              process.exit(1);
            }
            console.error(`Deactivating stake account ${stakeAddr}...`);
            const result = await staking.unstake(stakeAddr);
            console.log(JSON.stringify({
              success: true,
              ...result
            }, null, 2));
            break;
          }

          case 'withdraw': {
            const stakeAddr = args[2];
            if (!stakeAddr) {
              console.error('Usage: solana-agent stake withdraw <stake_account_address>');
              process.exit(1);
            }
            console.error(`Withdrawing from ${stakeAddr}...`);
            const result = await staking.withdraw(stakeAddr);
            console.log(JSON.stringify({
              success: true,
              ...result
            }, null, 2));
            break;
          }

          case 'validators': {
            console.log(JSON.stringify(VALIDATORS, null, 2));
            break;
          }

          default:
            console.error('Unknown stake command. Use: delegate, list, unstake, withdraw, validators');
            process.exit(1);
        }
        break;
      }

      case 'help':
      default:
        console.log(`
Solana Agent Kit - CLI for AI agents

Commands:
  wallet create              Create a new wallet
  wallet balance             Get SOL balance
  wallet tokens              Get all token balances
  wallet address             Print wallet address

  swap quote <from> <to> <amount>     Get swap quote
  swap execute <from> <to> <amount>   Execute swap

  price <token>              Get token price in USDC

  transfer <to> <amount>     Send SOL
  transfer <to> <amount> --token <mint>  Send token

  stake delegate <validator> <amount>  Stake SOL to validator
  stake list                           List your stake accounts
  stake unstake <stake_account>        Start unstaking
  stake withdraw <stake_account>       Withdraw unstaked SOL
  stake validators                     List known validators

  tokens                     List known token symbols

Environment:
  SOLANA_WALLET_PATH    Path to wallet file (default: ~/.config/solana/id.json)
  SOLANA_RPC_URL        RPC endpoint (default: mainnet-beta)

Examples:
  solana-agent wallet balance
  solana-agent swap quote SOL USDC 1000000000
  solana-agent price SOL
  solana-agent transfer 9abc...xyz 0.1
  solana-agent stake delegate jito 1.0
`);
    }
  } catch (error) {
    console.error(JSON.stringify({
      success: false,
      error: error.message
    }, null, 2));
    process.exit(1);
  }
}

main();
