#!/usr/bin/env node
/**
 * Solana Agent Kit - HTTP Server
 * REST API for AI agents that can't shell out
 * 
 * Endpoints:
 *   GET  /health              - Health check
 *   GET  /wallet/address      - Get wallet address
 *   GET  /wallet/balance      - Get SOL balance
 *   GET  /wallet/tokens       - Get all token balances
 *   POST /swap/quote          - Get swap quote
 *   POST /swap/execute        - Execute swap
 *   POST /transfer/sol        - Send SOL
 *   POST /transfer/token      - Send SPL token
 *   POST /stake/delegate      - Stake SOL
 *   GET  /stake/list          - List stake accounts
 */

const http = require('http');
const { Wallet } = require('./wallet');
const { Swapper, TOKENS } = require('./swap');
const { Transfer } = require('./transfer');
const { Staking, VALIDATORS } = require('./stake');
const fs = require('fs');
const path = require('path');

const DEFAULT_PORT = process.env.SOLANA_AGENT_PORT || 3030;
const DEFAULT_WALLET_PATH = process.env.SOLANA_WALLET_PATH || 
  path.join(process.env.HOME, '.config', 'solana', 'id.json');
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

let wallet = null;
let swapper = null;
let transfer = null;
let staking = null;

function loadWallet() {
  if (!fs.existsSync(DEFAULT_WALLET_PATH)) {
    throw new Error(`Wallet not found at ${DEFAULT_WALLET_PATH}`);
  }
  wallet = Wallet.fromFile(DEFAULT_WALLET_PATH, RPC_URL);
  swapper = new Swapper(wallet);
  transfer = new Transfer(wallet);
  staking = new Staking(wallet);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function error(res, message, status = 400) {
  json(res, { success: false, error: message }, status);
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  const method = req.method;

  try {
    // Health check
    if (pathname === '/health' && method === 'GET') {
      return json(res, { 
        status: 'ok', 
        wallet: wallet?.address || null,
        version: '1.0.0'
      });
    }

    // Ensure wallet is loaded for other endpoints
    if (!wallet) {
      return error(res, 'Wallet not loaded', 500);
    }

    // Wallet endpoints
    if (pathname === '/wallet/address' && method === 'GET') {
      return json(res, { address: wallet.address });
    }

    if (pathname === '/wallet/balance' && method === 'GET') {
      const balance = await wallet.getBalance();
      return json(res, { address: wallet.address, balance, unit: 'SOL' });
    }

    if (pathname === '/wallet/tokens' && method === 'GET') {
      const tokens = await wallet.getAllTokenBalances();
      return json(res, { address: wallet.address, tokens });
    }

    // Swap endpoints
    if (pathname === '/swap/quote' && method === 'POST') {
      const body = await parseBody(req);
      if (!body.from || !body.to || !body.amount) {
        return error(res, 'Missing required fields: from, to, amount');
      }
      const quote = await swapper.getQuote(body.from, body.to, body.amount, body.slippage || 50);
      return json(res, { success: true, quote });
    }

    if (pathname === '/swap/execute' && method === 'POST') {
      const body = await parseBody(req);
      if (!body.from || !body.to || !body.amount) {
        return error(res, 'Missing required fields: from, to, amount');
      }
      const result = await swapper.swap(body.from, body.to, body.amount, body.slippage || 50);
      return json(res, { success: true, ...result });
    }

    if (pathname === '/price' && method === 'GET') {
      const token = url.searchParams.get('token');
      if (!token) {
        return error(res, 'Missing token parameter');
      }
      const price = await swapper.getPrice(token);
      return json(res, { token, price, unit: 'USDC' });
    }

    // Transfer endpoints
    if (pathname === '/transfer/sol' && method === 'POST') {
      const body = await parseBody(req);
      if (!body.to || !body.amount) {
        return error(res, 'Missing required fields: to, amount');
      }
      const result = await transfer.sendSol(body.to, parseFloat(body.amount));
      return json(res, { success: true, ...result });
    }

    if (pathname === '/transfer/token' && method === 'POST') {
      const body = await parseBody(req);
      if (!body.to || !body.amount || !body.mint) {
        return error(res, 'Missing required fields: to, amount, mint');
      }
      const result = await transfer.sendToken(body.to, body.amount, body.mint);
      return json(res, { success: true, ...result });
    }

    // Staking endpoints
    if (pathname === '/stake/delegate' && method === 'POST') {
      const body = await parseBody(req);
      if (!body.validator || !body.amount) {
        return error(res, 'Missing required fields: validator, amount');
      }
      const result = await staking.stake(body.validator, parseFloat(body.amount));
      return json(res, { success: true, ...result });
    }

    if (pathname === '/stake/list' && method === 'GET') {
      const accounts = await staking.getStakeAccounts();
      return json(res, { 
        address: wallet.address, 
        stakeAccounts: accounts,
        totalStaked: accounts.reduce((sum, a) => sum + a.sol, 0)
      });
    }

    if (pathname === '/stake/unstake' && method === 'POST') {
      const body = await parseBody(req);
      if (!body.stakeAccount) {
        return error(res, 'Missing required field: stakeAccount');
      }
      const result = await staking.unstake(body.stakeAccount);
      return json(res, { success: true, ...result });
    }

    if (pathname === '/stake/withdraw' && method === 'POST') {
      const body = await parseBody(req);
      if (!body.stakeAccount) {
        return error(res, 'Missing required field: stakeAccount');
      }
      const result = await staking.withdraw(body.stakeAccount);
      return json(res, { success: true, ...result });
    }

    // Token list
    if (pathname === '/tokens' && method === 'GET') {
      return json(res, TOKENS);
    }

    // Validators list
    if (pathname === '/validators' && method === 'GET') {
      return json(res, VALIDATORS);
    }

    // 404
    return error(res, 'Not found', 404);

  } catch (e) {
    console.error('Error:', e.message);
    return error(res, e.message, 500);
  }
}

function startServer(port = DEFAULT_PORT) {
  try {
    loadWallet();
    console.log(`Wallet loaded: ${wallet.address}`);
  } catch (e) {
    console.error(`Warning: ${e.message}`);
    console.error('Server will start but wallet operations will fail.');
  }

  const server = http.createServer(handleRequest);
  
  server.listen(port, () => {
    console.log(`Solana Agent Kit server running on http://localhost:${port}`);
    console.log('');
    console.log('Endpoints:');
    console.log('  GET  /health              Health check');
    console.log('  GET  /wallet/address      Get wallet address');
    console.log('  GET  /wallet/balance      Get SOL balance');
    console.log('  GET  /wallet/tokens       Get all token balances');
    console.log('  POST /swap/quote          Get swap quote');
    console.log('  POST /swap/execute        Execute swap');
    console.log('  GET  /price?token=SOL     Get token price');
    console.log('  POST /transfer/sol        Send SOL');
    console.log('  POST /transfer/token      Send SPL token');
    console.log('  POST /stake/delegate      Stake SOL');
    console.log('  GET  /stake/list          List stake accounts');
    console.log('  POST /stake/unstake       Start unstaking');
    console.log('  POST /stake/withdraw      Withdraw unstaked');
  });

  return server;
}

// Run if called directly
if (require.main === module) {
  const port = process.argv[2] || DEFAULT_PORT;
  startServer(parseInt(port));
}

module.exports = { startServer };
