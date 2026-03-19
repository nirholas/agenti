export type SupportedChain = 'base-sepolia' | 'base' | 'ethereum';

export type SignerType = 'api-key' | 'email-otp';

export interface Config {
    testEmail: string;
    chain: SupportedChain;
    serverUrl: string;
    signerType: SignerType;
}

export interface LogEntry {
    timestamp: number;
    type: 'info' | 'success' | 'error' | 'warning';
    message: string;
}

export interface WalletState {
    wallet: any | null;
    isDeployed: boolean;
    deploymentTx: string;
    otpRequired: boolean;
    otpSent: boolean;
}

export interface OTPAuthHandlers {
    sendEmailWithOtp?: () => Promise<void>;
    verifyOtp?: (otp: string) => Promise<void>;
    reject?: () => void;
}

export interface BalanceState {
    eth: string | null;
    usdc: string | null;
    isLoading: boolean;
}

export interface ChainConfig {
    chain: any;
    rpc: string;
}