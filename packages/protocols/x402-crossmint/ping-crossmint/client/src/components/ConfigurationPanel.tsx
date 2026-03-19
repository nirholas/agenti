import React from 'react';
import type { Config, SupportedChain, SignerType } from '../types';
import { SUPPORTED_CHAINS } from '../constants/chains';

interface ConfigurationPanelProps {
    config: Config;
    onUpdateEmail: (email: string) => void;
    onUpdateChain: (chain: SupportedChain) => void;
    onUpdateServerUrl: (serverUrl: string) => void;
    onUpdateSignerType: (signerType: SignerType) => void;
    apiKey: string;
    onUpdateApiKey: (apiKey: string) => void;
    isMinimal?: boolean;
    // OTP-related props
    otpRequired?: boolean;
    otpSent?: boolean;
    currentOtp?: string;
    onOtpChange?: (otp: string) => void;
    onSendOtp?: () => void;
    onSubmitOtp?: () => void;
    onRejectOtp?: () => void;
    // Logged-in user email (for email-otp signer type)
    loggedInUserEmail?: string;
}

export const ConfigurationPanel: React.FC<ConfigurationPanelProps> = ({
    config,
    onUpdateEmail,
    onUpdateChain,
    onUpdateServerUrl,
    onUpdateSignerType,
    apiKey,
    onUpdateApiKey,
    isMinimal = false,
    otpRequired = false,
    otpSent = false,
    currentOtp = '',
    onOtpChange,
    onSendOtp,
    onSubmitOtp,
    onRejectOtp,
    loggedInUserEmail
}) => {
    // Determine the effective email based on signer type
    const effectiveEmail = config.signerType === 'email-otp' && loggedInUserEmail
        ? loggedInUserEmail
        : config.testEmail;
    if (isMinimal) {
        return (
            <div style={{
                maxWidth: 720,
                // margin: '2rem auto',
                fontFamily: 'Inter, system-ui, sans-serif',
                padding: '0 1rem'
            }}>
                <h1>ping-crossmint</h1>
                <p>Configure your setup to get started</p>

                <div style={{ display: 'grid', gap: '12px' }}>
                    <div>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>
                            🔐 Signer Type:
                        </label>
                        <select
                            value={config.signerType}
                            onChange={e => onUpdateSignerType(e.target.value as SignerType)}
                            style={{
                                width: '100%',
                                padding: '8px',
                                fontSize: '14px',
                                border: '1px solid #ddd',
                                borderRadius: '4px'
                            }}
                        >
                            <option value="api-key">API Key (Server-side)</option>
                            <option value="email-otp">Email OTP (User-controlled)</option>
                        </select>
                        <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>
                            {config.signerType === 'api-key'
                                ? '🔑 Uses server API key for instant wallet creation'
                                : '📧 Requires email verification AND JWT Authentication enabled on your client API key'
                            }
                        </div>
                    </div>

                    {config.signerType === 'api-key' && (
                        <div>
                            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>
                                🔑 Crossmint Server API Key:
                            </label>
                            <input
                                type="password"
                                placeholder="sk_staging_..."
                                value={apiKey}
                                onChange={e => onUpdateApiKey(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '8px',
                                    fontSize: '14px',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    fontFamily: 'monospace'
                                }}
                            />
                            {apiKey && !apiKey.startsWith('sk_') && (
                                <div style={{ color: '#cc0000', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                                    ⚠️ Please use a server API key (starts with 'sk_')
                                </div>
                            )}
                        </div>
                    )}

                    {config.signerType === 'email-otp' && (
                        <div>
                            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>
                                🔑 Crossmint Client API Key:
                            </label>
                            <input
                                type="password"
                                placeholder="ck_staging_..."
                                value={apiKey}
                                onChange={e => onUpdateApiKey(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '8px',
                                    fontSize: '14px',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    fontFamily: 'monospace'
                                }}
                            />
                            {apiKey && !apiKey.startsWith('ck_') && (
                                <div style={{ color: '#cc0000', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                                    ⚠️ Please use a client API key (starts with 'ck_')
                                </div>
                            )}
                            {apiKey && apiKey.startsWith('ck_') && (
                                <div style={{ color: '#ff9500', fontSize: '0.75rem', marginTop: '0.25rem', padding: '0.5rem', backgroundColor: '#fff9f0', borderRadius: '4px', border: '1px solid #ffeaa7' }}>
                                    <strong>⚠️ Important:</strong> Email OTP requires JWT Authentication enabled on this API key.
                                    <br />
                                    <a href="https://docs.crossmint.com/introduction/platform/api-keys/jwt-authentication" target="_blank" rel="noopener noreferrer" style={{ color: '#007bff', textDecoration: 'underline' }}>
                                        Setup JWT Auth in Console →
                                    </a>
                                </div>
                            )}
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: config.signerType === 'email-otp' ? '1fr 1fr' : '1fr 1fr 1fr', gap: '12px' }}>
                        {config.signerType === 'api-key' && (
                            <div>
                                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>
                                    📧 Test Email:
                                </label>
                                <input
                                    type="email"
                                    placeholder="user@example.com"
                                    value={config.testEmail}
                                    onChange={e => onUpdateEmail(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '8px',
                                        fontSize: '14px',
                                        border: '1px solid #ddd',
                                        borderRadius: '4px'
                                    }}
                                />
                                <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
                                    Owner identifier for the wallet
                                </div>
                            </div>
                        )}

                        <div>
                            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>
                                ⛓️ Chain:
                            </label>
                            <select
                                value={config.chain}
                                onChange={e => onUpdateChain(e.target.value as SupportedChain)}
                                style={{
                                    width: '100%',
                                    padding: '8px',
                                    fontSize: '14px',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px'
                                }}
                            >
                                {SUPPORTED_CHAINS.map(chain => (
                                    <option key={chain} value={chain}>{chain}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>
                                🌐 Server URL:
                            </label>
                            <input
                                type="url"
                                placeholder="https://ping-crossmint-server.vercel.app/"
                                value={config.serverUrl}
                                onChange={e => onUpdateServerUrl(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '8px',
                                    fontSize: '14px',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px'
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* OTP UI - appears when OTP is required */}
                {otpRequired && (
                    <div style={{
                        padding: '1rem',
                        border: '2px solid #ff9500',
                        borderRadius: '8px',
                        marginTop: '1rem',
                        backgroundColor: '#fff9f0'
                    }}>
                        <h3 style={{ margin: '0 0 0.5rem 0' }}>📧 Email OTP Verification Required</h3>
                        <p style={{ margin: '0 0 1rem 0', fontSize: '14px' }}>
                            Please verify your email address to continue.
                        </p>

                        {!otpSent ? (
                            <div>
                                <p style={{ margin: '0 0 0.5rem 0', fontSize: '14px' }}>
                                    Click below to send a verification code to <strong>{effectiveEmail}</strong>
                                </p>
                                <button
                                    onClick={onSendOtp}
                                    style={{
                                        padding: '8px 16px',
                                        backgroundColor: '#007bff',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '14px'
                                    }}
                                >
                                    Send OTP to {effectiveEmail}
                                </button>
                            </div>
                        ) : (
                            <div>
                                <p style={{ margin: '0 0 0.5rem 0', fontSize: '14px' }}>
                                    ✅ OTP sent to <strong>{effectiveEmail}</strong>
                                </p>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <input
                                        type="text"
                                        placeholder="Enter 9-digit OTP"
                                        maxLength={9}
                                        value={currentOtp}
                                        onChange={e => onOtpChange?.(e.target.value)}
                                        style={{
                                            padding: '8px',
                                            width: '140px',
                                            fontSize: '14px',
                                            border: '1px solid #ddd',
                                            borderRadius: '4px',
                                            fontFamily: 'monospace'
                                        }}
                                    />
                                    <button
                                        onClick={onSubmitOtp}
                                        disabled={currentOtp.length !== 9}
                                        style={{
                                            padding: '8px 16px',
                                            backgroundColor: currentOtp.length === 9 ? '#28a745' : '#ccc',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: currentOtp.length === 9 ? 'pointer' : 'not-allowed',
                                            fontSize: '14px'
                                        }}
                                    >
                                        Verify OTP
                                    </button>
                                    <button
                                        onClick={onRejectOtp}
                                        style={{
                                            padding: '8px 16px',
                                            backgroundColor: '#dc3545',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontSize: '14px'
                                        }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'grid', gap: '16px' }}>
                <div>
                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', fontSize: '14px' }}>
                        🔐 Signer Type:
                    </label>
                    <select
                        value={config.signerType}
                        onChange={e => onUpdateSignerType(e.target.value as SignerType)}
                        style={{
                            width: '100%',
                            padding: '8px',
                            fontSize: '14px',
                            border: '1px solid #ddd',
                            borderRadius: '4px'
                        }}
                    >
                        <option value="api-key">API Key (Server-side)</option>
                        <option value="email-otp">Email OTP (User-controlled)</option>
                    </select>
                </div>

                {config.signerType === 'api-key' && (
                    <div>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', fontSize: '14px' }}>
                            🔑 Crossmint Server API Key:
                        </label>
                        <input
                            type="password"
                            placeholder="sk_staging_..."
                            value={apiKey}
                            onChange={e => onUpdateApiKey(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '8px',
                                fontSize: '14px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontFamily: 'monospace'
                            }}
                        />
                        {apiKey && !apiKey.startsWith('sk_') && (
                            <div style={{ color: '#cc0000', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                                ⚠️ Please use a server API key (starts with 'sk_')
                            </div>
                        )}
                    </div>
                )}

                {config.signerType === 'email-otp' && (
                    <div>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', fontSize: '14px' }}>
                            🔑 Crossmint Client API Key:
                        </label>
                        <input
                            type="password"
                            placeholder="ck_staging_..."
                            value={apiKey}
                            onChange={e => onUpdateApiKey(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '8px',
                                fontSize: '14px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontFamily: 'monospace'
                            }}
                        />
                        {apiKey && !apiKey.startsWith('ck_') && (
                            <div style={{ color: '#cc0000', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                                ⚠️ Please use a client API key (starts with 'ck_')
                            </div>
                        )}
                    </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: config.signerType === 'email-otp' ? '1fr 1fr' : '1fr 1fr 1fr', gap: '16px' }}>
                    {config.signerType === 'api-key' && (
                        <div>
                            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', fontSize: '14px' }}>
                                📧 Test Email:
                            </label>
                            <input
                                type="email"
                                placeholder="user@example.com"
                                value={config.testEmail}
                                onChange={e => onUpdateEmail(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '8px',
                                    fontSize: '14px',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px'
                                }}
                            />
                        </div>
                    )}

                    <div>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', fontSize: '14px' }}>
                            ⛓️ Chain:
                        </label>
                        <select
                            value={config.chain}
                            onChange={e => onUpdateChain(e.target.value as SupportedChain)}
                            style={{
                                width: '100%',
                                padding: '8px',
                                fontSize: '14px',
                                border: '1px solid #ddd',
                                borderRadius: '4px'
                            }}
                        >
                            {SUPPORTED_CHAINS.map(chain => (
                                <option key={chain} value={chain}>{chain}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', fontSize: '14px' }}>
                            🌐 Server URL:
                        </label>
                        <input
                            type="url"
                            placeholder="https://ping-crossmint-server.vercel.app/"
                            value={config.serverUrl}
                            onChange={e => onUpdateServerUrl(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '8px',
                                fontSize: '14px',
                                border: '1px solid #ddd',
                                borderRadius: '4px'
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};