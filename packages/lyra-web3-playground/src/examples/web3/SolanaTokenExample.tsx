/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Turning ideas into reality, one function at a time 💭
 */

import { useState } from 'react';
import { Coins, Send, Wallet } from 'lucide-react';

export default function SolanaTokenExample() {
  const [balance] = useState(10.5);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [splTokens] = useState([
    { mint: 'EPjF...X7VL', symbol: 'USDC', balance: 1000, decimals: 6 },
    { mint: 'Es9v...YmaD', symbol: 'USDT', balance: 500, decimals: 6 },
    { mint: 'mSoL...vv4J', symbol: 'mSOL', balance: 5, decimals: 9 },
  ]);

  const handleSendSOL = () => {
    if (!recipient || !amount) {
      alert('Please fill all fields');
      return;
    }
    alert(`Sent ${amount} SOL to ${recipient}`);
    setRecipient('');
    setAmount('');
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Solana SPL Tokens</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Work with SOL and SPL tokens on Solana blockchain
        </p>
      </div>

      {/* SOL Balance */}
      <div className="card mb-8">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-gray-600 dark:text-gray-400">SOL Balance</span>
          <Wallet className="w-5 h-5 text-purple-600" />
        </div>
        <p className="text-3xl font-bold mb-6">{balance} SOL</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Recipient Address</label>
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="Enter Solana address"
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Amount (SOL)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            />
          </div>

          <button onClick={handleSendSOL} className="w-full btn-primary flex items-center justify-center gap-2">
            <Send className="w-4 h-4" />
            Send SOL
          </button>
        </div>
      </div>

      {/* SPL Tokens */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4 flex items-center">
          <Coins className="w-5 h-5 mr-2" />
          SPL Token Balances
        </h2>
        
        <div className="space-y-3">
          {splTokens.map((token, idx) => (
            <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div>
                <p className="font-bold">{token.symbol}</p>
                <p className="text-xs text-gray-500 font-mono">{token.mint}</p>
              </div>
              <div className="text-right">
                <p className="font-bold">{token.balance.toLocaleString()}</p>
                <p className="text-xs text-gray-500">{token.decimals} decimals</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sample Code */}
      <div className="card mt-8">
        <h2 className="text-xl font-bold mb-4">Sample Solana Code</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs">
{`import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';

// Connect to Solana
const connection = new Connection('https://api.mainnet-beta.solana.com');

// Transfer SOL
async function transferSOL(from, to, amount) {
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: from.publicKey,
      toPubkey: new PublicKey(to),
      lamports: amount * 1e9, // Convert to lamports
    })
  );
  
  const signature = await connection.sendTransaction(transaction, [from]);
  await connection.confirmTransaction(signature);
  return signature;
}`}
        </pre>
      </div>

      {/* Demo Notice */}
      <div className="card bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 mt-6">
        <p className="text-sm text-blue-900 dark:text-blue-200">
          <strong>Demo Mode:</strong> This demonstrates Solana's SPL token standard, similar to ERC-20 but optimized for Solana's high-speed blockchain. 
          SPL tokens are commonly used for stablecoins, DeFi tokens, and more on Solana.
        </p>
      </div>
    </div>
  );
}
