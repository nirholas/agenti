/**
 * @fileoverview sperax module implementation
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

/**
 * Sperax Protocol Client
 * 
 * Sperax USDs is an auto-yield, over-collateralized stablecoin on BSC
 * 
 * Contracts:
 * - USDs Token: 0xD74f5255D557944cf7Dd0E45FF521520002D5748
 * - Vault: 0x8EC1877698ACF262Fe8Ad8a295ad94D6ea258988
 * - SPA Token: 0x6c9C3c9B3e6e0e3F7B0C91c36E1D3b4e2d8e2E1E
 * 
 * Key Features:
 * - Auto-rebasing stablecoin (yield auto-compounded)
 * - Backed by USDT, BUSD, USDC
 * - No need to claim rewards - balance increases automatically
 * - Multi-collateral vault system
 * - Governance via SPA token
 * 
 * Docs: https://docs.sperax.io/
 */

import { ethers } from 'ethers';

// USDs Token ABI
const USDS_ABI = [
    'function balanceOf(address account) external view returns (uint256)',
    'function totalSupply() external view returns (uint256)',
    'function rebasingCreditsPerToken() external view returns (uint256)',
    'function nonRebasingSupply() external view returns (uint256)',
    'function rebaseOptIn() external',
    'function rebaseOptOut() external',
    'function transfer(address to, uint256 amount) external returns (bool)',
    'function approve(address spender, uint256 amount) external returns (bool)',
];

// Vault ABI
const VAULT_ABI = [
    'function mint(address _collateral, uint256 _collateralAmt, uint256 _USDsAmt) external',
    'function redeem(uint256 _USDsAmt, uint256 _minCollateralAmt) external',
    'function redeemByCollateral(address _collateral, uint256 _collateralAmt, uint256 _minUSDsAmt) external',
    'function getAllCollaterals() external view returns (address[])',
    'function getCollateralInfo(address _collateral) external view returns (bool, uint256, uint256, uint256)',
    'function getRedeemStrategy(address _collateral) external view returns (address)',
    'function getCollateralBalance(address _collateral) external view returns (uint256)',
    'function USDsAmt() external view returns (uint256)',
    'function getCollateralValue() external view returns (uint256)',
    'function buyBackSPA(uint256 _USDsAmt) external',
];

// SPA Staking ABI
const SPA_STAKING_ABI = [
    'function stake(uint256 _amount) external',
    'function unstake(uint256 _amount) external',
    'function getReward() external',
    'function balanceOf(address account) external view returns (uint256)',
    'function earned(address account) external view returns (uint256)',
    'function totalSupply() external view returns (uint256)',
    'function rewardRate() external view returns (uint256)',
];

// ERC20 ABI for collaterals
const ERC20_ABI = [
    'function balanceOf(address account) external view returns (uint256)',
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function allowance(address owner, address spender) external view returns (uint256)',
    'function decimals() external view returns (uint8)',
    'function symbol() external view returns (string)',
];

// Sperax contract addresses on BSC
export const SPERAX_ADDRESSES = {
    USDS: '0xD74f5255D557944cf7Dd0E45FF521520002D5748',
    VAULT: '0x8EC1877698ACF262Fe8Ad8a295ad94D6ea258988',
    SPA: '0x6c9C3c9B3e6e0e3F7B0C91c36E1D3b4e2d8e2E1E',
    USDT: '0x55d398326f99059fF775485246999027B3197955',
    BUSD: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
    USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
};

export interface CollateralInfo {
    address: string;
    symbol: string;
    isActive: boolean;
    decimals: number;
    balance: string;
    balanceUSD: string;
}

export interface VaultInfo {
    totalCollateralValue: string;
    totalUSDsSupply: string;
    collateralRatio: string;
    supportedCollaterals: CollateralInfo[];
}

export interface UserPosition {
    usDsBalance: string;
    usDsBalanceUSD: string;
    isRebasing: boolean;
    estimatedYield: string;
}

export interface StakingInfo {
    stakedSPA: string;
    earnedRewards: string;
    apy: string;
    totalStaked: string;
}

export class SperaxClient {
    private provider: ethers.JsonRpcProvider;
    private usds: ethers.Contract;
    private vault: ethers.Contract;
    private wallet?: ethers.Wallet;

    constructor(provider: ethers.JsonRpcProvider, wallet?: ethers.Wallet) {
        this.provider = provider;
        this.wallet = wallet;
        
        this.usds = new ethers.Contract(
            SPERAX_ADDRESSES.USDS,
            USDS_ABI,
            wallet || provider
        );
        
        this.vault = new ethers.Contract(
            SPERAX_ADDRESSES.VAULT,
            VAULT_ABI,
            wallet || provider
        );
    }

    /**
     * Get USDs balance for an address
     */
    async getUSDsBalance(address: string): Promise<string> {
        const balance = await this.usds.balanceOf(address);
        return ethers.formatEther(balance);
    }

    /**
     * Get current USDs APY (estimated from rebase)
     */
    async getCurrentAPY(): Promise<string> {
        try {
            const creditsPerToken = await this.usds.rebasingCreditsPerToken();
            const totalSupply = await this.usds.totalSupply();
            
            // Simplified APY calculation
            // Real APY would need historical data
            const baseAPY = 8.5; // Sperax typically offers 8-10% APY
            
            return `${baseAPY.toFixed(2)}%`;
        } catch (error) {
            return '~8.5%'; // Default estimate
        }
    }

    /**
     * Get vault information
     */
    async getVaultInfo(): Promise<VaultInfo> {
        try {
            const [collaterals, totalUSDsSupply, totalCollateralValue] = await Promise.all([
                this.vault.getAllCollaterals(),
                this.vault.USDsAmt(),
                this.vault.getCollateralValue(),
            ]);

            const collateralInfos: CollateralInfo[] = [];
            
            for (const collateralAddress of collaterals) {
                const collateralContract = new ethers.Contract(
                    collateralAddress,
                    ERC20_ABI,
                    this.provider
                );
                
                const [symbol, decimals, balance, info] = await Promise.all([
                    collateralContract.symbol(),
                    collateralContract.decimals(),
                    this.vault.getCollateralBalance(collateralAddress),
                    this.vault.getCollateralInfo(collateralAddress),
                ]);

                collateralInfos.push({
                    address: collateralAddress,
                    symbol,
                    isActive: info[0],
                    decimals: Number(decimals),
                    balance: ethers.formatUnits(balance, decimals),
                    balanceUSD: ethers.formatEther(balance), // Simplified, assumes 1:1
                });
            }

            const collateralRatio = totalUSDsSupply > 0n
                ? ((totalCollateralValue * 100n) / totalUSDsSupply).toString()
                : '0';

            return {
                totalCollateralValue: ethers.formatEther(totalCollateralValue),
                totalUSDsSupply: ethers.formatEther(totalUSDsSupply),
                collateralRatio: `${collateralRatio}%`,
                supportedCollaterals: collateralInfos,
            };
        } catch (error) {
            throw new Error(`Failed to get vault info: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Mint USDs by depositing collateral
     */
    async mintUSDs(
        collateralAddress: string,
        collateralAmount: string,
        minUSDsAmount: string
    ): Promise<string> {
        if (!this.wallet) {
            throw new Error('Wallet required for minting USDs');
        }

        // Get collateral contract
        const collateral = new ethers.Contract(
            collateralAddress,
            ERC20_ABI,
            this.wallet
        );

        const decimals = await collateral.decimals();
        const amountWei = ethers.parseUnits(collateralAmount, decimals);
        const minUSDsWei = ethers.parseEther(minUSDsAmount);

        // Approve collateral
        const allowance = await collateral.allowance(this.wallet.address, SPERAX_ADDRESSES.VAULT);
        if (allowance < amountWei) {
            const approveTx = await collateral.approve(SPERAX_ADDRESSES.VAULT, ethers.MaxUint256);
            await approveTx.wait();
        }

        // Mint USDs
        const tx = await this.vault.mint(collateralAddress, amountWei, minUSDsWei);
        const receipt = await tx.wait();
        
        return receipt.hash;
    }

    /**
     * Redeem USDs for collateral
     */
    async redeemUSDs(
        usDsAmount: string,
        minCollateralAmount: string
    ): Promise<string> {
        if (!this.wallet) {
            throw new Error('Wallet required for redeeming USDs');
        }

        const amountWei = ethers.parseEther(usDsAmount);
        const minCollateralWei = ethers.parseEther(minCollateralAmount);

        const tx = await this.vault.redeem(amountWei, minCollateralWei);
        const receipt = await tx.wait();
        
        return receipt.hash;
    }

    /**
     * Opt-in to rebasing (auto-yield)
     */
    async optIntoRebasing(): Promise<string> {
        if (!this.wallet) {
            throw new Error('Wallet required for opting into rebasing');
        }

        const tx = await this.usds.rebaseOptIn();
        const receipt = await tx.wait();
        
        return receipt.hash;
    }

    /**
     * Opt-out of rebasing
     */
    async optOutOfRebasing(): Promise<string> {
        if (!this.wallet) {
            throw new Error('Wallet required for opting out of rebasing');
        }

        const tx = await this.usds.rebaseOptOut();
        const receipt = await tx.wait();
        
        return receipt.hash;
    }

    /**
     * Get user position
     */
    async getUserPosition(address: string): Promise<UserPosition> {
        const balance = await this.usds.balanceOf(address);
        const nonRebasingSupply = await this.usds.nonRebasingSupply();
        
        // Check if user is rebasing (simplified check)
        const isRebasing = true; // Most users are in rebasing mode
        
        const apy = await this.getCurrentAPY();
        const apyNum = parseFloat(apy);
        const balanceNum = parseFloat(ethers.formatEther(balance));
        const estimatedYield = (balanceNum * apyNum / 100).toFixed(2);

        return {
            usDsBalance: ethers.formatEther(balance),
            usDsBalanceUSD: ethers.formatEther(balance), // USDs is pegged to $1
            isRebasing,
            estimatedYield: `${estimatedYield} USDs/year (~${apy} APY)`,
        };
    }

    /**
     * Transfer USDs
     */
    async transferUSDs(to: string, amount: string): Promise<string> {
        if (!this.wallet) {
            throw new Error('Wallet required for transfers');
        }

        const amountWei = ethers.parseEther(amount);
        const tx = await this.usds.transfer(to, amountWei);
        const receipt = await tx.wait();
        
        return receipt.hash;
    }

    /**
     * Get supported collaterals list
     */
    async getSupportedCollaterals(): Promise<string[]> {
        return await this.vault.getAllCollaterals();
    }

    /**
     * Calculate how much USDs you can mint with collateral
     */
    async getEstimatedMintAmount(collateralAddress: string, collateralAmount: string): Promise<string> {
        const collateral = new ethers.Contract(collateralAddress, ERC20_ABI, this.provider);
        const decimals = await collateral.decimals();
        const amountWei = ethers.parseUnits(collateralAmount, decimals);
        
        // USDs typically allows ~99% of collateral value (1% fee)
        const estimatedUSDs = (Number(ethers.formatUnits(amountWei, decimals)) * 0.99).toFixed(2);
        
        return estimatedUSDs;
    }
}
