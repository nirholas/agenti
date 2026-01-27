/**
 * Payment Modal Component (X402 Protocol)
 * 
 * Handles:
 * - X402 payment requests
 * - Multi-token payments (USDC, USDT, DAI, ETH, BNB, MATIC)
 * - QR code display
 * - Payment confirmation
 * - Revenue splitting
 */

'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, QrCode, DollarSign, CheckCircle } from 'lucide-react';
import { useAccount } from 'wagmi';
import { executeX402Payment } from '@/lib/x402-client';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  paymentDetails: {
    amount: string;
    currency: string;
    recipient: string;
    description: string;
    toolId: string;
  };
  onPaymentComplete: () => void;
}

export function PaymentModal({
  isOpen,
  onClose,
  paymentDetails,
  onPaymentComplete,
}: PaymentModalProps) {
  const { address } = useAccount();
  const [selectedToken, setSelectedToken] = useState(paymentDetails.currency || 'USDC');
  const [isPaying, setIsPaying] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [txHash, setTxHash] = useState('');

  const PAYMENT_TOKENS = [
    { symbol: 'USDs', name: 'Sperax USD (Yield-Bearing)', decimals: 18, featured: true, apy: '~10%' },
    { symbol: 'USDC', name: 'USD Coin', decimals: 6 },
    { symbol: 'USDT', name: 'Tether USD', decimals: 6 },
    { symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18 },
    { symbol: 'ETH', name: 'Ethereum', decimals: 18 },
    { symbol: 'MATIC', name: 'Polygon', decimals: 18 },
  ];

  const handlePayment = async () => {
    setIsPaying(true);

    try {
      const result = await executeX402Payment({
        amount: paymentDetails.amount,
        token: selectedToken,
        recipient: paymentDetails.recipient,
        description: paymentDetails.description,
        toolId: paymentDetails.toolId,
        payer: address!,
      });

      setTxHash(result.txHash);
      setPaymentSuccess(true);

      setTimeout(() => {
        onPaymentComplete();
        onClose();
      }, 2000);
    } catch (error: any) {
      alert('Payment failed: ' + error.message);
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-400" />
            Payment Required
          </DialogTitle>
        </DialogHeader>

        {paymentSuccess ? (
          <div className="space-y-4 py-6">
            <div className="flex flex-col items-center gap-3">
              <CheckCircle className="w-16 h-16 text-green-400" />
              <h3 className="text-xl font-semibold">Payment Successful!</h3>
              <p className="text-sm text-slate-400 text-center">
                Your transaction has been confirmed
              </p>
            </div>

            {txHash && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                <label className="text-xs text-slate-400 block mb-1">
                  Transaction Hash
                </label>
                <code className="text-xs text-green-400 break-all">
                  {txHash}
                </code>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Payment Details */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-slate-400">Description</span>
                <span className="text-sm text-white">
                  {paymentDetails.description}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-400">Amount</span>
                <span className="text-lg font-bold text-white">
                  {paymentDetails.amount} {paymentDetails.currency}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-400">Recipient</span>
                <code className="text-xs text-slate-300">
                  {paymentDetails.recipient.slice(0, 6)}...
                  {paymentDetails.recipient.slice(-4)}
                </code>
              </div>
            </div>

            {/* Token Selector */}
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Pay with</label>
              <Select value={selectedToken} onValueChange={setSelectedToken}>
                <SelectTrigger className="bg-slate-800 border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  {PAYMENT_TOKENS.map((token) => (
                    <SelectItem key={token.symbol} value={token.symbol}>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-xs font-bold">
                          {token.symbol[0]}
                        </div>
                        <div>
                          <div className="font-medium">{token.symbol}</div>
                          <div className="text-xs text-slate-400">{token.name}</div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Payment Button */}
            <Button
              onClick={handlePayment}
              disabled={isPaying}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            >
              {isPaying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing Payment...
                </>
              ) : (
                <>
                  <DollarSign className="mr-2 h-4 w-4" />
                  Pay {paymentDetails.amount} {selectedToken}
                </>
              )}
            </Button>

            {/* Info */}
            <p className="text-xs text-slate-500 text-center">
              Powered by X402 Protocol • Secure on-chain payments
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
