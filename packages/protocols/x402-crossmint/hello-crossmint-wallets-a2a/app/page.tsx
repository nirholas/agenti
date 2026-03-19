'use client';

import { useState } from 'react';
import { A2AClient } from "@a2a-js/sdk/client";
import { v4 as uuidv4 } from "uuid";
import { JsonRpcProvider, Contract } from "ethers";
import { CrossmintWallets, createCrossmint, EVMWallet } from "@crossmint/wallets-sdk";

const X402_EXTENSION_URI = "https://github.com/google-a2a/a2a-x402/v0.1";
const X402_STATUS_KEY = "x402.payment.status";
const X402_REQUIRED_KEY = "x402.payment.required";
const X402_PAYLOAD_KEY = "x402.payment.payload";
const X402_RECEIPTS_KEY = "x402.payment.receipts";

function resolveChainId(network: string) {
  const map: Record<string, number> = {
    "base": 8453,
    "base-sepolia": 84532,
    "ethereum": 1,
    "ethereum-sepolia": 11155111,
    "polygon": 137,
    "polygon-amoy": 80002,
    "optimism": 10,
    "optimism-sepolia": 11155420,
    "arbitrum": 42161,
    "arbitrum-sepolia": 421614,
    "scroll": 534352,
    "scroll-sepolia": 534351,
  };
  return map[String(network)] || undefined;
}

// ERC20 ABI for balance checking
const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

// RPC URLs for different networks
const RPC_URLS: Record<string, string> = {
  "base-sepolia": "https://sepolia.base.org",
  "base": "https://mainnet.base.org",
  "ethereum-sepolia": "https://sepolia.infura.io/v3/YOUR_INFURA_KEY", // You'd need to add your Infura key
  "polygon-amoy": "https://rpc-amoy.polygon.technology",
};

export default function Home() {
  const [apiKey, setApiKey] = useState('');
  const [userEmail, setUserEmail] = useState('');
  // Crossmint is the payer; no client EOA private key needed
  const [serverUrl, setServerUrl] = useState('http://localhost:10000');
  const [logs, setLogs] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [balances, setBalances] = useState<{
    userBalance: string;
    merchantBalance: string;
    network: string;
    tokenAddress: string;
    userAddress: string;
    merchantAddress: string;
  } | null>(null);
  const [isCheckingBalances, setIsCheckingBalances] = useState(false);

  const addLog = (message: string) => {
    const timestamp = new Date().toISOString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const checkBalances = async () => {
    if (!apiKey || !userEmail) {
      addLog('ERROR: Please fill in API key and user email');
      return;
    }

    setIsCheckingBalances(true);

    try {
      addLog('Fetching payment requirements...');

      // Get payment requirements from server first
      const cardUrl = `${serverUrl}/.well-known/agent-card.json`;
      const fetchWithExtension = (input: RequestInfo | URL, init: RequestInit = {}) => {
        const headers = { ...(init.headers || {}), "X-A2A-Extensions": X402_EXTENSION_URI };
        return fetch(input, { ...init, headers });
      };
      const client = await A2AClient.fromCardUrl(cardUrl, { fetchImpl: fetchWithExtension });

      const params = {
        message: {
          messageId: uuidv4(),
          role: "user" as const,
          parts: [{ kind: "text" as const, text: "Hello, merchant!" }],
          kind: "message" as const,
        },
        configuration: {
          blocking: true,
          acceptedOutputModes: ["text/plain"],
        },
      };

      const createdResp = (await client.sendMessage(params)) as any;
      const createdTask = createdResp?.result;
      const statusMessage = createdTask?.status?.message;
      const metadata = statusMessage?.metadata || {};

      if (metadata[X402_STATUS_KEY] !== "payment-required") {
        addLog("No payment requirements found");
        return;
      }

      const paymentRequired = metadata[X402_REQUIRED_KEY];
      const selected = paymentRequired.accepts[0];
      const network = String(selected.network);
      const tokenAddress = String(selected.asset).trim().toLowerCase();
      const merchantAddress = String(selected.payTo).trim().toLowerCase();

      // Get Crossmint wallet address for the user on the selected chain
      const crossmint = createCrossmint({ apiKey });
      const wallets = CrossmintWallets.from(crossmint);
      const evmChain = String(network);
      const cmWallet = await wallets.createWallet({
        chain: evmChain as any,
        signer: { type: "api-key" as const },
        owner: `email:${userEmail}`,
      });
      const userAddress = cmWallet.address;

      addLog(`Checking balances on ${network}...`);
      addLog(`Token: ${tokenAddress}`);
      addLog(`User: ${userAddress}`);
      addLog(`Merchant: ${merchantAddress}`);

      // Get RPC URL
      const rpcUrl = RPC_URLS[network];
      if (!rpcUrl) {
        addLog(`ERROR: No RPC URL configured for network: ${network}`);
        return;
      }

      // Create provider and contract
      const provider = new JsonRpcProvider(rpcUrl);
      const tokenContract = new Contract(tokenAddress, ERC20_ABI, provider);

      // Get balances
      const [userBalanceRaw, merchantBalanceRaw, decimals] = await Promise.all([
        tokenContract.balanceOf(userAddress),
        tokenContract.balanceOf(merchantAddress),
        tokenContract.decimals(),
      ]);

      // Format balances (assuming USDC with 6 decimals)
      const formatBalance = (balance: bigint, decimals: number) => {
        const divisor = BigInt(10 ** Number(decimals));
        const whole = balance / divisor;
        const fractional = balance % divisor;
        const fractionalStr = fractional.toString().padStart(Number(decimals), '0').replace(/0+$/, '') || '0';
        return `${whole.toString()}.${fractionalStr.slice(0, 6)}`;
      };

      const userBalance = formatBalance(userBalanceRaw, decimals);
      const merchantBalance = formatBalance(merchantBalanceRaw, decimals);

      setBalances({
        userBalance,
        merchantBalance,
        network,
        tokenAddress,
        userAddress,
        merchantAddress,
      });

      addLog(`✅ User balance: ${userBalance} USDC`);
      addLog(`✅ Merchant balance: ${merchantBalance} USDC`);

    } catch (error: any) {
      addLog(`ERROR checking balances: ${error?.message || error}`);
    } finally {
      setIsCheckingBalances(false);
    }
  };

  const handlePayment = async () => {
    if (!apiKey || !userEmail) {
      addLog('ERROR: Please fill in API key and user email');
      return;
    }

    setIsProcessing(true);

    try {
      addLog('Starting A2A payment flow...');

      const cardUrl = `${serverUrl}/.well-known/agent-card.json`;
      const fetchWithExtension = (input: RequestInfo | URL, init: RequestInit = {}) => {
        const headers = { ...(init.headers || {}), "X-A2A-Extensions": X402_EXTENSION_URI };
        return fetch(input, { ...init, headers });
      };
      const client = await A2AClient.fromCardUrl(cardUrl, { fetchImpl: fetchWithExtension });

      // Send initial message
      const params = {
        message: {
          messageId: uuidv4(),
          role: "user" as const,
          parts: [{ kind: "text" as const, text: "Hello, merchant!" }],
          kind: "message" as const,
        },
        configuration: {
          blocking: true,
          acceptedOutputModes: ["text/plain"],
        },
      };

      addLog('Sending initial message...');
      const createdResp = (await client.sendMessage(params)) as any;
      const createdTask = createdResp?.result;
      addLog(`Created Task: ${createdTask?.id} ${createdTask?.status?.state}`);

      // Check for payment requirement
      const statusMessage = createdTask?.status?.message;
      const metadata = statusMessage?.metadata || {};
      if (metadata[X402_STATUS_KEY] !== "payment-required") {
        addLog("No payment required. Exiting.");
        return;
      }

      const paymentRequired = metadata[X402_REQUIRED_KEY];
      const selected = paymentRequired.accepts[0];
      addLog(`Payment required: ${selected.maxAmountRequired} of ${selected.asset}`);

      // Initialize Crossmint Wallet
      addLog('Initializing Crossmint wallet...');
      const crossmint = createCrossmint({ apiKey });
      const wallets = CrossmintWallets.from(crossmint);
      const evmChain = String(selected.network);

      let crossmintWallet;

      // Use API key signer for wallet management, but force delegated signer approval for signatures
      const signerConfig = {
        type: "api-key" as const,
      };
      crossmintWallet = await wallets.createWallet({
        chain: evmChain as any,
        signer: signerConfig,
        owner: `email:${userEmail}`,
      });

      addLog(`Wallet ready: ${crossmintWallet.address}`);
      const evmWallet = EVMWallet.from(crossmintWallet);

      // No delegated signer needed; Crossmint wallet will sign and pay

      // Execute ERC-20 transfer directly from Crossmint wallet (direct-transfer scheme)
      const asset = String(selected.asset).trim().toLowerCase();
      const payTo = String(selected.payTo).trim().toLowerCase();
      addLog('Sending ERC-20 transfer from Crossmint wallet...');
      const transferTx = await evmWallet.sendTransaction({
        abi: [
          { type: "function", name: "transfer", stateMutability: "nonpayable",
            inputs: [{ name: "to", type: "address" }, { name: "value", type: "uint256" }],
            outputs: [{ type: "bool" }] }
        ],
        to: asset,
        functionName: "transfer",
        args: [payTo, String(selected.maxAmountRequired)],
      } as any);
      const txHash = transferTx.hash as string;
      if (!txHash) throw new Error('No transaction hash returned');
      addLog(`Transfer submitted: ${txHash}`);

      const paymentPayload = {
        x402Version: 1,
        scheme: selected.scheme,
        network: selected.network,
        payload: {
          transaction: txHash,
          payer: crossmintWallet.address,
          asset,
          payTo,
          value: String(selected.maxAmountRequired),
        },
      };

      // Submit payment payload
      addLog('Submitting payment...');
      const submissionResp = (await client.sendMessage({
        message: {
          messageId: uuidv4(),
          taskId: createdTask.id,
          role: "user" as const,
          parts: [{ kind: "text" as const, text: "Here is the payment authorization." }],
          kind: "message" as const,
          metadata: {
            [X402_STATUS_KEY]: "payment-submitted",
            [X402_PAYLOAD_KEY]: paymentPayload,
          },
        },
        configuration: {
          blocking: true,
          acceptedOutputModes: ["text/plain"],
        },
      })) as any;

      const submission = submissionResp?.result;
      addLog(`After payment submission, task state: ${submission?.status?.state}`);
      const finalMeta = submission?.status?.message?.metadata || {};
      addLog(`Payment status: ${finalMeta[X402_STATUS_KEY]}`);

      if (Array.isArray(finalMeta[X402_RECEIPTS_KEY])) {
        addLog(`Receipt: ${JSON.stringify(finalMeta[X402_RECEIPTS_KEY][0])}`);
      }

      addLog('Payment flow completed successfully!');

      // Refresh balances after payment
      if (submission?.status?.state === 'completed') {
        addLog('Refreshing balances after successful payment...');
        setTimeout(() => checkBalances(), 2000); // Wait 2 seconds for blockchain confirmation
      }

    } catch (error: any) {
      addLog(`ERROR: ${error?.message || error}`);
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Delegation flow removed: Crossmint wallet is the signer and payer

  return (
    <div className="container">
      <h1>A2A x402 Payment Client</h1>
      <p>Client for A2A protocol with x402 payment extension using Crossmint Wallets</p>

      <div className="card">
        <h2>Configuration</h2>
        <input
          type="text"
          placeholder="Crossmint API Key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="input"
        />
        <input
          type="email"
          placeholder="User Email"
          value={userEmail}
          onChange={(e) => setUserEmail(e.target.value)}
          className="input"
        />
        {/* No client private key field needed; Crossmint signs and pays */}
        <input
          type="text"
          placeholder="Server URL"
          value={serverUrl}
          onChange={(e) => setServerUrl(e.target.value)}
          className="input"
        />
        <button
          onClick={handlePayment}
          disabled={isProcessing || !apiKey || !userEmail}
          className="button"
        >
          {isProcessing ? 'Processing...' : 'Start Payment Flow'}
        </button>

        <button
          onClick={checkBalances}
          disabled={isCheckingBalances || !apiKey || !userEmail}
          className="button"
          style={{ marginLeft: '1rem', backgroundColor: '#28a745' }}
        >
          {isCheckingBalances ? 'Checking...' : 'Check USDC Balances'}
        </button>
      </div>

      {balances && (
        <div className="card">
          <h2>USDC Balances</h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1rem',
            marginBottom: '1rem'
          }}>
            <div style={{
              padding: '1.5rem',
              background: 'linear-gradient(135deg, #e8f5e8 0%, #f0fff0 100%)',
              borderRadius: '8px',
              border: '1px solid #d4edda'
            }}>
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#155724', fontSize: '1.1rem' }}>Your Balance</h3>
              <p style={{ margin: '0 0 0.75rem 0', fontSize: '2rem', fontWeight: 'bold', color: '#28a745' }}>
                {balances.userBalance} USDC
              </p>
              <div style={{
                background: 'rgba(255,255,255,0.7)',
                padding: '0.5rem',
                borderRadius: '4px',
                border: '1px solid #c3e6cb'
              }}>
                <p style={{
                  margin: '0',
                  fontSize: '0.75rem',
                  color: '#495057',
                  fontFamily: 'monospace',
                  wordBreak: 'break-all',
                  lineHeight: '1.2'
                }}>
                  {balances.userAddress}
                </p>
              </div>
            </div>
            <div style={{
              padding: '1.5rem',
              background: 'linear-gradient(135deg, #e3f2fd 0%, #f0f8ff 100%)',
              borderRadius: '8px',
              border: '1px solid #b8daff'
            }}>
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#004085', fontSize: '1.1rem' }}>Merchant Balance</h3>
              <p style={{ margin: '0 0 0.75rem 0', fontSize: '2rem', fontWeight: 'bold', color: '#007bff' }}>
                {balances.merchantBalance} USDC
              </p>
              <div style={{
                background: 'rgba(255,255,255,0.7)',
                padding: '0.5rem',
                borderRadius: '4px',
                border: '1px solid #abdcff'
              }}>
                <p style={{
                  margin: '0',
                  fontSize: '0.75rem',
                  color: '#495057',
                  fontFamily: 'monospace',
                  wordBreak: 'break-all',
                  lineHeight: '1.2'
                }}>
                  {balances.merchantAddress}
                </p>
              </div>
            </div>
          </div>
          <div style={{
            fontSize: '0.85rem',
            color: '#6c757d',
            textAlign: 'center',
            background: '#f8f9fa',
            padding: '0.75rem',
            borderRadius: '4px',
            marginBottom: '1rem',
            border: '1px solid #e9ecef'
          }}>
            <div style={{ marginBottom: '0.25rem' }}>
              <strong>Network:</strong> {balances.network}
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', wordBreak: 'break-all' }}>
              <strong>Token:</strong> {balances.tokenAddress}
            </div>
          </div>
          <button
            onClick={checkBalances}
            disabled={isCheckingBalances}
            className="button"
            style={{
              backgroundColor: '#17a2b8',
              width: '100%',
              padding: '0.75rem',
              fontSize: '1rem'
            }}
          >
            {isCheckingBalances ? 'Refreshing...' : '🔄 Refresh Balances'}
          </button>
        </div>
      )}

      {balances && parseFloat(balances.userBalance) < 1 && (
        <div className="card" style={{ border: '2px solid #ffc107', backgroundColor: '#fff3cd' }}>
          <h2 style={{ color: '#856404' }}>⚠️ Insufficient Balance</h2>
          <p style={{ color: '#856404', marginBottom: '1rem' }}>
            You need at least 1 USDC to complete the payment. Your current balance is {balances.userBalance} USDC.
          </p>
          <h3 style={{ color: '#856404', marginBottom: '0.5rem' }}>Get Base Sepolia USDC:</h3>
          <ul style={{ color: '#856404', marginLeft: '1rem' }}>
            <li>1. Get Base Sepolia USDC from <a href="https://faucet.circle.com/" target="_blank" rel="noopener noreferrer" style={{ color: '#007bff' }}>Circle Faucet</a></li>
            <li>2. Your address: <code>{balances.userAddress}</code></li>
          </ul>
        </div>
      )}

      <div className="card">
        <h2>Logs</h2>
        <div className="log">
          {logs.join('\n')}
        </div>
        <button
          onClick={() => setLogs([])}
          className="button"
          style={{ marginTop: '1rem' }}
        >
          Clear Logs
        </button>
      </div>
    </div>
  );
}
