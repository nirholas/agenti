import { useState, useEffect, useCallback } from 'react';
import { WalletDisplay, ContentRequest } from './components';
import type { WalletInfo } from './components';
import './App.css';

const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT || 'http://localhost:8080';

function App() {
  const [wallet, setWallet] = useState<WalletInfo | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWallet = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_ENDPOINT}/wallet`);
      if (!response.ok) {
        throw new Error(`Failed to fetch wallet: ${response.statusText}`);
      }
      const data = await response.json();
      setWallet({
        address: data.address,
        balance: data.balance,
        network: data.network,
        currency: data.currency,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load wallet');
      setWallet(undefined);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  const handleRefresh = () => {
    fetchWallet();
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>x402 Payment Demo</h1>
        <p>AI-powered content payments on AWS using Bedrock AgentCore, Lambda, and CloudFront</p>
      </header>

      <main className="app-main">
        <section className="wallet-section">
          <h2>Agent Wallet</h2>
          {error && <div className="wallet-error">{error}</div>}
          <WalletDisplay 
            wallet={wallet} 
            isLoading={isLoading}
            onRefresh={handleRefresh}
          />
        </section>

        <section className="content-section">
          <h2>Content</h2>
          <ContentRequest walletConnected={!!wallet} />
        </section>
      </main>

      <footer className="app-footer">
        <a 
          href="https://github.com/aws-samples/sample-agentcore-cloudfront-x402-payments" 
          target="_blank" 
          rel="noopener noreferrer"
          className="repo-link"
        >
          Explore the Project →
        </a>
      </footer>
    </div>
  );
}

export default App;
