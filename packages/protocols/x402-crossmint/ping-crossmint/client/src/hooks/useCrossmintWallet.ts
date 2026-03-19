/**
 * Core Crossmint wallet functionality
 * Demonstrates the essential Crossmint SDK usage patterns
 */

import { useState, useCallback } from 'react';
import { CrossmintWallets, createCrossmint } from "@crossmint/wallets-sdk";
import { useAuth } from '@crossmint/client-sdk-react-ui';
import { checkWalletDeployment, deployWallet } from '../utils/walletGuards';
import type { WalletState, SupportedChain, SignerType, OTPAuthHandlers } from '../types';

interface UseCrossmintWalletProps {
  apiKey: string;
  email: string;
  chain: SupportedChain;
  signerType: SignerType;
  onLog: (message: string, type?: 'info' | 'success' | 'error' | 'warning') => void;
}

export function useCrossmintWallet({ apiKey, email, chain, signerType, onLog }: UseCrossmintWalletProps) {
  // Get JWT from CrossmintAuthProvider for email OTP signer
  const { jwt } = useAuth();

  const [walletState, setWalletState] = useState<WalletState>({
    wallet: null,
    isDeployed: false,
    deploymentTx: '',
    otpRequired: false,
    otpSent: false
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentOtp, setCurrentOtp] = useState('');
  const [otpHandlers, setOtpHandlers] = useState<OTPAuthHandlers>({});

  const handleEmailOTPAuth = useCallback(async (
    needsAuth: boolean,
    sendEmailWithOtp: () => Promise<void>,
    verifyOtp: (otp: string) => Promise<void>,
    reject: () => void
  ) => {
    onLog(`🔐 Email OTP authentication ${needsAuth ? 'required' : 'not required'}`, 'info');

    if (!needsAuth) {
      setWalletState(prev => ({ ...prev, otpRequired: false, otpSent: false }));
      return;
    }

    setWalletState(prev => ({ ...prev, otpRequired: true, otpSent: false }));
    setOtpHandlers({ sendEmailWithOtp, verifyOtp, reject });
  }, [onLog]);

  const sendOtp = useCallback(async () => {
    if (!otpHandlers.sendEmailWithOtp) {
      onLog("❌ OTP handlers not available", 'error');
      return;
    }

    try {
      onLog("📧 Sending OTP to email...", 'info');
      await otpHandlers.sendEmailWithOtp();
      setWalletState(prev => ({ ...prev, otpSent: true }));
      onLog("✅ OTP sent successfully!", 'success');
    } catch (error) {
      onLog(`❌ Failed to send OTP: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  }, [otpHandlers.sendEmailWithOtp, onLog]);

  const submitOtp = useCallback(async (otp: string) => {
    if (!otpHandlers.verifyOtp) {
      onLog("❌ OTP verification not available", 'error');
      return;
    }

    try {
      onLog("🔍 Verifying OTP...", 'info');
      await otpHandlers.verifyOtp(otp);
      setWalletState(prev => ({ ...prev, otpRequired: false, otpSent: false }));
      setCurrentOtp('');
      onLog("✅ OTP verified successfully!", 'success');
    } catch (error) {
      onLog(`❌ OTP verification failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  }, [otpHandlers.verifyOtp, onLog]);

  const rejectOtp = useCallback(() => {
    if (otpHandlers.reject) {
      otpHandlers.reject();
    }
    setWalletState(prev => ({ ...prev, otpRequired: false, otpSent: false }));
    setCurrentOtp('');
    onLog("❌ OTP authentication rejected", 'warning');
  }, [otpHandlers.reject, onLog]);

  const initializeWallet = useCallback(async () => {
    // Validate API key based on signer type
    if (signerType === 'api-key' && !apiKey.startsWith('sk_')) {
      onLog("❌ Invalid API key. Please use a server API key (starts with 'sk_')", 'error');
      return;
    }

    if (signerType === 'email-otp' && !apiKey.startsWith('ck_')) {
      onLog("❌ Invalid API key. Please use a client API key (starts with 'ck_')", 'error');
      return;
    }

    if (signerType === 'email-otp') {
      if (!jwt) {
        onLog("❌ Email OTP signer requires JWT authentication. Please log in first using the CrossmintAuthProvider.", 'error');
        onLog("📚 JWT is obtained from useAuth() hook and passed to createCrossmint({ apiKey, jwt })", 'info');
        return;
      }
      onLog(`🔐 Using JWT authentication for email OTP signer`, 'info');
    }

    try {
      setIsProcessing(true);
      onLog(`🚀 Initializing Crossmint wallet with ${signerType} signer...`);

      // Core Crossmint SDK usage - pass JWT for email OTP signer!
      // IMPORTANT: Email OTP signer reads JWT from experimental_customAuth.jwt, not from jwt directly
      const crossmint = createCrossmint({
        apiKey,
        ...(signerType === 'email-otp' && jwt ? {
          experimental_customAuth: {
            jwt,
            email
          }
        } : {})
      });
      const crossmintWallets = CrossmintWallets.from(crossmint);

      // Configure signer based on type
      const signerConfig = signerType === 'email-otp'
        ? {
            type: "email" as const,
            email: email,
            onAuthRequired: handleEmailOTPAuth
          }
        : { type: "api-key" as const };

      // Use the appropriate method based on signer type
      // Client-side email OTP signers use getOrCreateWallet
      // Server-side API key signers use createWallet
      const wallet = signerType === 'email-otp'
        ? await crossmintWallets.getOrCreateWallet({
            chain: chain as any,
            signer: signerConfig,
            owner: `email:${email}`,
          })
        : await crossmintWallets.createWallet({
            chain: chain as any,
            signer: signerConfig,
            owner: `email:${email}`,
          });

      onLog("✅ Crossmint wallet created!", 'success');
      onLog(`📍 Wallet address: ${wallet.address}`, 'success');

      // Check deployment status
      const isDeployed = await checkWalletDeployment(wallet.address, chain);
      onLog(`🏗️ Wallet status: ${isDeployed ? 'deployed' : 'pre-deployed'}`, 'info');

      setWalletState({
        wallet,
        isDeployed,
        deploymentTx: '',
        otpRequired: false,
        otpSent: false
      });

    } catch (error) {
      onLog(`❌ Wallet creation failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  }, [apiKey, email, chain, signerType, handleEmailOTPAuth, onLog]);

  const deployWalletOnChain = useCallback(async () => {
    if (!walletState.wallet) {
      onLog("❌ No wallet to deploy", 'error');
      return;
    }

    // Check JWT for email OTP signer
    if (signerType === 'email-otp' && !jwt) {
      onLog("❌ JWT token missing. Please log in again.", 'error');
      return;
    }

    try {
      setIsProcessing(true);
      onLog("🚀 Deploying wallet on-chain...");

      const txHash = await deployWallet(walletState.wallet);

      onLog("✅ Wallet deployed successfully!", 'success');
      onLog(`📝 Transaction: ${txHash}`, 'success');

      setWalletState(prev => ({
        ...prev,
        isDeployed: true,
        deploymentTx: txHash
      }));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      onLog(`❌ Deployment failed: ${errorMessage}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  }, [walletState.wallet, signerType, jwt, onLog]);

  const resetWallet = useCallback(() => {
    setWalletState({
      wallet: null,
      isDeployed: false,
      deploymentTx: '',
      otpRequired: false,
      otpSent: false
    });
    setCurrentOtp('');
    setOtpHandlers({});
    onLog("🔄 Wallet reset", 'info');
  }, [onLog]);

  return {
    walletState,
    isProcessing,
    initializeWallet,
    deployWalletOnChain,
    resetWallet,
    // OTP-related functions
    sendOtp,
    submitOtp,
    rejectOtp,
    currentOtp,
    setCurrentOtp
  };
}