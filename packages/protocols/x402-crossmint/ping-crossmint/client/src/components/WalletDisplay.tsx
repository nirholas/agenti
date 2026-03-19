import React from 'react';
import type { WalletState, BalanceState, Config } from '../types';
import { USDC_ADDRESSES } from '../constants/chains';

interface WalletDisplayProps {
    walletState: WalletState;
    balanceState: BalanceState;
    config: Config;
}

export const WalletDisplay: React.FC<WalletDisplayProps> = ({
    walletState,
    balanceState,
    config
}) => {
    const { wallet, isDeployed, deploymentTx } = walletState;
    const { eth, usdc, isLoading } = balanceState;

    if (!wallet) {
        return (
            <div style={{
                border: '1px solid #ddd',
                borderRadius: '8px',
                padding: '1rem',
                backgroundColor: '#f9f9f9',
                textAlign: 'center',
                color: '#666'
            }}>
                <p>No wallet initialized</p>
            </div>
        );
    }

    return (
        <div style={{
            border: '1px solid #ddd',
            borderRadius: '8px',
            padding: '1rem',
            backgroundColor: '#f9f9f9'
        }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>🏦 Wallet Overview</h3>

            {/* Wallet Info Section */}
            <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'grid', gap: '8px', fontSize: '14px' }}>
                    <div>
                        <strong>Status:</strong> {isDeployed ? '✅ Deployed' : '⏳ Pre-deployed'}
                    </div>

                    <div style={{ wordBreak: 'break-all' }}>
                        <strong>Address:</strong> {wallet.address}
                    </div>

                    {deploymentTx && (
                        <div style={{ wordBreak: 'break-all' }}>
                            <strong>Deployment Tx:</strong> {deploymentTx}
                        </div>
                    )}
                </div>
            </div>

            {/* Balance Section */}
            <div style={{
                paddingTop: '16px',
                borderTop: '1px solid #ddd'
            }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#666' }}>💰 Balances</h4>

                <div style={{ display: 'grid', gap: '8px', fontSize: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>ETH:</span>
                        <span style={{ fontFamily: 'monospace' }}>
                            {isLoading ? '⏳ Loading...' : (eth || '0.0000')}
                        </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>USDC:</span>
                        <span style={{ fontFamily: 'monospace' }}>
                            {isLoading ? '⏳ Loading...' : (usdc || '0.00')}
                        </span>
                    </div>
                </div>
            </div>

            {/* Chain Info Section */}
            <div style={{
                marginTop: '16px',
                paddingTop: '12px',
                borderTop: '1px solid #ddd',
                fontSize: '12px',
                color: '#666'
            }}>
                <div><strong>Chain:</strong> {config.chain}</div>
                <div><strong>USDC Contract:</strong> {USDC_ADDRESSES[config.chain]}</div>
            </div>
        </div>
    );
};