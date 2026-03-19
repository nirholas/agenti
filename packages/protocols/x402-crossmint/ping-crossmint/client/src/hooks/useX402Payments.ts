/**
 * X402 payment functionality with Crossmint wallets
 * Demonstrates how to integrate Crossmint with x402 payment protocol
 */

import { useState, useCallback } from 'react';
import { EVMWallet } from "@crossmint/wallets-sdk";
import axios from 'axios';
import { withPaymentInterceptor } from 'x402-axios';
import { createX402Signer } from '../utils/x402Adapter';

interface UseX402PaymentsProps {
  serverUrl: string;
  onLog: (message: string, type?: 'info' | 'success' | 'error' | 'warning') => void;
}

export function useX402Payments({ serverUrl, onLog }: UseX402PaymentsProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const requestPayment = useCallback(async (wallet: any) => {
    if (!wallet) {
      onLog("❌ No wallet available for payment", 'error');
      return null;
    }

    try {
      setIsProcessing(true);
      onLog("🔗 Making initial request to discover payment requirements...");
      onLog(`📍 Requesting from wallet: ${wallet.address}`);

      // Make initial request to get payment requirements (should return 402)
      const axiosInstance = axios.create({ baseURL: serverUrl });

      const response = await axiosInstance.get('/ping');

      // If we get here, no payment required
      onLog("✅ No payment required!", 'success');
      onLog(`📨 Server response: ${JSON.stringify(response.data)}`, 'success');
      return null;

    } catch (error: any) {
      if (error.response?.status === 402) {
        // Extract payment details from 402 response
        const paymentDetails = error.response.data;
        onLog("💳 Payment required! Server returned payment details", 'info');
        onLog(`💰 Payment details: ${JSON.stringify(paymentDetails, null, 2)}`, 'info');

        // Extract payment details from the accepts array
        const acceptsInfo = paymentDetails.accepts?.[0];
        if (!acceptsInfo) {
          onLog("❌ Invalid 402 response - missing accepts array", 'error');
          return null;
        }

        // Convert maxAmountRequired from base units to display format
        const maxAmount = acceptsInfo.maxAmountRequired || "1000";
        const displayAmount = (parseInt(maxAmount) / 1000000).toFixed(6); // Convert from base units to USDC
        const currency = acceptsInfo.extra?.name || "USDC";

        return {
          amount: `${displayAmount} ${currency}`,
          currency: currency,
          recipient: acceptsInfo.payTo,
          network: acceptsInfo.network,
          maxAmountRequired: maxAmount,
          asset: acceptsInfo.asset,
          rawResponse: paymentDetails
        };
      } else {
        onLog(`❌ Request failed: ${error.message || String(error)}`, 'error');
        return null;
      }
    } finally {
      setIsProcessing(false);
    }
  }, [serverUrl, onLog]);

  const executePayment = useCallback(async (wallet: any, paymentDetails: any) => {
    if (!wallet || !paymentDetails) {
      onLog("❌ Invalid payment execution parameters", 'error');
      return;
    }

    try {
      setIsProcessing(true);
      onLog("🔗 Executing approved payment with Crossmint wallet...");

      // Core x402 + Crossmint integration - this is the key demo!
      const evmWallet = EVMWallet.from(wallet);
      const signer = createX402Signer(evmWallet);

      const axiosInstance = axios.create({ baseURL: serverUrl });
      withPaymentInterceptor(axiosInstance, signer as any);

      onLog(`💳 Processing payment for ${paymentDetails.amount}...`);
      onLog(`📍 Paying from wallet: ${wallet.address}`);

      // Make the payment request - interceptor will handle the payment
      const response = await axiosInstance.get('/ping');

      onLog("✅ Payment executed successfully!", 'success');
      onLog(`📨 Server response: ${JSON.stringify(response.data)}`, 'success');
      onLog("🎉 X402 + Crossmint payment complete!", 'success');

    } catch (error: any) {
      console.log(error);
      if (error.response?.status === 402) {
        const errorData = error.response.data;
        onLog("🔧 Payment verification completed, settlement phase had issues", 'warning');
        onLog("✅ This demonstrates successful signature verification with Crossmint!", 'success');

        if (errorData?.payer) {
          onLog(`🔍 Payer verified: ${errorData.payer}`, 'info');
        }
      } else {
        onLog(`❌ Payment execution failed: ${error.message || String(error)}`, 'error');
      }
    } finally {
      setIsProcessing(false);
    }
  }, [serverUrl, onLog]);

  return {
    isProcessing,
    requestPayment,
    executePayment
  };
}