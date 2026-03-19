import React from 'react';

interface PaymentApprovalProps {
    paymentRequest: {
        amount: string;
        currency: string;
        recipient: string;
        network: string;
        rawResponse: any;
    };
    onApprove: () => void;
    onDecline: () => void;
    isProcessing: boolean;
}

export const PaymentApproval: React.FC<PaymentApprovalProps> = ({
    paymentRequest,
    onApprove,
    onDecline,
    isProcessing
}) => {
    return (
        <div style={{
            border: '2px solid #ff8800',
            borderRadius: '8px',
            padding: '1rem',
            backgroundColor: '#fff8f0',
            marginBottom: '1rem'
        }}>
            <h3 style={{
                margin: '0 0 16px 0',
                fontSize: '16px',
                color: '#cc6600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
            }}>
                💳 Payment Required
                <span style={{
                    fontSize: '12px',
                    backgroundColor: '#ff8800',
                    color: 'white',
                    padding: '2px 6px',
                    borderRadius: '4px'
                }}>
                    HTTP 402
                </span>
            </h3>

            <div style={{
                marginBottom: '16px',
                fontSize: '14px',
                lineHeight: '1.5'
            }}>
                <p style={{ margin: '0 0 12px 0', fontWeight: 'bold' }}>
                    The server requires payment to access this resource:
                </p>

                <div style={{
                    display: 'grid',
                    gap: '8px',
                    backgroundColor: 'white',
                    padding: '12px',
                    borderRadius: '4px',
                    border: '1px solid #ddd'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <strong>💰 Amount:</strong>
                        <span style={{ fontFamily: 'monospace', color: '#cc6600' }}>
                            {paymentRequest.amount}
                        </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <strong>🏦 Recipient:</strong>
                        <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                            {paymentRequest.recipient ?
                                `${paymentRequest.recipient.substring(0, 10)}...${paymentRequest.recipient.substring(paymentRequest.recipient.length - 8)}`
                                : 'Not specified'
                            }
                        </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <strong>⛓️ Network:</strong>
                        <span>{paymentRequest.network}</span>
                    </div>
                </div>
            </div>

            <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'center'
            }}>
                <button
                    onClick={onApprove}
                    disabled={isProcessing}
                    style={{
                        padding: '12px 24px',
                        backgroundColor: isProcessing ? '#ccc' : '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: isProcessing ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        minWidth: '120px'
                    }}
                >
                    {isProcessing ? '⏳ Processing...' : '✅ Approve Payment'}
                </button>

                <button
                    onClick={onDecline}
                    disabled={isProcessing}
                    style={{
                        padding: '12px 24px',
                        backgroundColor: isProcessing ? '#ccc' : '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: isProcessing ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        minWidth: '120px'
                    }}
                >
                    {isProcessing ? '⏳ Wait...' : '❌ Decline Payment'}
                </button>
            </div>

            <div style={{
                marginTop: '12px',
                fontSize: '12px',
                color: '#666',
                textAlign: 'center'
            }}>
                💡 This payment will be signed by your Crossmint wallet and submitted to the x402 facilitator
            </div>
        </div>
    );
};