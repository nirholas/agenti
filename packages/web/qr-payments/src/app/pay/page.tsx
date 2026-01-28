'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAccount, useBalance, useSendTransaction } from 'wagmi';
import { parseEther, formatEther, formatUnits } from 'viem';
import { decodeQRUrl } from '@/lib/qr/generator';
import { QRCodeData, Token, ChainId } from '@/lib/types';

export default function PayPage() {
  const searchParams = useSearchParams();
  const { address, isConnected, chain } = useAccount();
  const { data: balance } = useBalance({ address });
  
  const [paymentData, setPaymentData] = useState<QRCodeData | null>(null);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [inputAmount, setInputAmount] = useState('');
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Parse QR code data from URL
  useEffect(() => {
    const to = searchParams.get('to');
    if (to) {
      try {
        const data: QRCodeData = {
          version: 1,
          type: 'payment',
          recipient: to,
          username: searchParams.get('u') || undefined,
          amount: searchParams.get('amt') || undefined,
          chainId: (parseInt(searchParams.get('c') || '1') as ChainId) || 1,
          memo: searchParams.get('m') || undefined,
        };
        setPaymentData(data);
      } catch (e) {
        setError('Invalid payment link');
      }
    }
  }, [searchParams]);

  // Fetch quote when input changes
  useEffect(() => {
    if (!selectedToken || !inputAmount || !address || !paymentData) return;

    const fetchQuote = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            inputToken: selectedToken,
            inputAmount: parseEther(inputAmount).toString(),
            chainId: paymentData.chainId,
            userAddress: address,
          }),
        });
        
        if (!response.ok) throw new Error('Failed to fetch quote');
        
        const data = await response.json();
        setQuote(data);
      } catch (e) {
        setError('Failed to fetch quote');
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchQuote, 500);
    return () => clearTimeout(debounce);
  }, [selectedToken, inputAmount, address, paymentData]);

  if (!paymentData) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Invalid Payment Link</h1>
          <p className="text-gray-400">Please scan a valid QR code or use a valid payment link.</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white p-6">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Complete Payment</h1>
          <p className="text-gray-400">
            Pay {paymentData.username ? `@${paymentData.username}` : paymentData.recipient.slice(0, 10) + '...'}
          </p>
        </div>

        {/* Payment Details */}
        <div className="bg-gray-800 rounded-2xl p-6 mb-6">
          <div className="space-y-4">
            {/* Recipient */}
            <div className="flex justify-between items-center">
              <span className="text-gray-400">To</span>
              <span className="font-mono">
                {paymentData.username ? (
                  <span className="text-blue-400">@{paymentData.username}</span>
                ) : (
                  `${paymentData.recipient.slice(0, 8)}...${paymentData.recipient.slice(-6)}`
                )}
              </span>
            </div>

            {/* Requested Amount */}
            {paymentData.amount && (
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Requested</span>
                <span className="text-xl font-bold">${paymentData.amount} USDC</span>
              </div>
            )}

            {/* Memo */}
            {paymentData.memo && (
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Memo</span>
                <span className="text-sm">{paymentData.memo}</span>
              </div>
            )}
          </div>
        </div>

        {/* Token Selection */}
        <div className="bg-gray-800 rounded-2xl p-6 mb-6">
          <h3 className="font-semibold mb-4">Pay With</h3>
          
          <div className="space-y-3">
            <TokenOption
              symbol="ETH"
              balance={balance ? formatEther(balance.value) : '0'}
              selected={selectedToken?.symbol === 'ETH'}
              onClick={() => setSelectedToken({
                address: '0x0000000000000000000000000000000000000000',
                symbol: 'ETH',
                decimals: 18,
                chainId: paymentData.chainId,
              })}
            />
            {/* Add more token options */}
          </div>

          {/* Amount Input */}
          {selectedToken && (
            <div className="mt-4">
              <input
                type="number"
                value={inputAmount}
                onChange={(e) => setInputAmount(e.target.value)}
                placeholder="Amount to send"
                className="w-full px-4 py-3 bg-gray-900 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* Quote Display */}
        {quote && (
          <div className="bg-gray-800 rounded-2xl p-6 mb-6">
            <h3 className="font-semibold mb-4">Quote</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">You Send</span>
                <span>{inputAmount} {selectedToken?.symbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Recipient Gets</span>
                <span className="text-green-400">
                  {formatUnits(BigInt(quote.quote.netOutputAmount), 6)} USDC
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Platform Fee</span>
                <span>{formatUnits(BigInt(quote.fees.platform), 6)} USDC (0.3%)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Route</span>
                <span>{quote.quote.aggregator}</span>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-900/50 text-red-400 rounded-lg p-4 mb-6">
            {error}
          </div>
        )}

        {/* Action Button */}
        {!isConnected ? (
          <button className="w-full py-4 bg-blue-600 rounded-xl font-semibold hover:bg-blue-500 transition">
            Connect Wallet
          </button>
        ) : (
          <button
            disabled={!quote || loading}
            className="w-full py-4 bg-blue-600 rounded-xl font-semibold hover:bg-blue-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Getting Quote...' : 'Confirm Payment'}
          </button>
        )}

        <p className="text-xs text-gray-500 text-center mt-4">
          By confirming, you agree to swap your tokens and send USDC to the recipient.
        </p>
      </div>
    </main>
  );
}

function TokenOption({ 
  symbol, 
  balance, 
  selected, 
  onClick 
}: { 
  symbol: string; 
  balance: string; 
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between p-4 rounded-xl transition ${
        selected 
          ? 'bg-blue-600/20 border border-blue-500' 
          : 'bg-gray-900 hover:bg-gray-700 border border-transparent'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
          {symbol.charAt(0)}
        </div>
        <span className="font-medium">{symbol}</span>
      </div>
      <span className="text-gray-400">
        {parseFloat(balance).toFixed(4)}
      </span>
    </button>
  );
}
