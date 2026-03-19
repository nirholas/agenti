import { useState } from 'react';
import './ContentRequest.css';

const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT || 'http://localhost:8080';

export interface ContentItem {
  id: string;
  path: string;
  title: string;
  description: string;
  price: string;
  currency: string;
}

export interface DebugLogEntry {
  timestamp: string;
  type: 'request' | 'response' | 'info' | 'error';
  title: string;
  data: unknown;
}

interface PaymentDetails {
  scheme: string;
  network: string;
  amount: string;
  asset: string;
  currency: string;
  recipient: string;
  description: string;
  maxTimeoutSeconds: number;
}

interface ContentRequestProps {
  walletConnected: boolean;
}

// All 6 content items from the seller
const AVAILABLE_CONTENT: ContentItem[] = [
  {
    id: 'weather-data',
    path: '/api/weather-data',
    title: 'Weather Data',
    description: 'Current weather conditions and forecast',
    price: '0.0005',
    currency: 'USDC',
  },
  {
    id: 'premium-article',
    path: '/api/premium-article',
    title: 'Premium Article',
    description: 'AI and blockchain convergence',
    price: '0.001',
    currency: 'USDC',
  },
  {
    id: 'market-analysis',
    path: '/api/market-analysis',
    title: 'Market Analysis',
    description: 'Real-time market data and analysis',
    price: '0.002',
    currency: 'USDC',
  },
  {
    id: 'tutorial',
    path: '/api/tutorial',
    title: 'Smart Contract Tutorial',
    description: 'Advanced smart contract guide',
    price: '0.003',
    currency: 'USDC',
  },
  {
    id: 'research-report',
    path: '/api/research-report',
    title: 'Research Report',
    description: 'Blockchain technology trends',
    price: '0.005',
    currency: 'USDC',
  },
  {
    id: 'dataset',
    path: '/api/dataset',
    title: 'Premium Dataset',
    description: 'ML/analytics curated dataset',
    price: '0.01',
    currency: 'USDC',
  },
];

const SELLER_URL = import.meta.env.VITE_SELLER_URL || 'https://dkqgvbdj13uv7.cloudfront.net';

type FlowStep = 'idle' | 'requesting' | 'payment_required' | 'confirming' | 'paying' | 'showing_data' | 'complete' | 'error';

export function ContentRequest({ walletConnected }: ContentRequestProps) {
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
  const [flowStep, setFlowStep] = useState<FlowStep>('idle');
  const [debugLogs, setDebugLogs] = useState<DebugLogEntry[]>([]);
  const [agentResponse, setAgentResponse] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
  const [purchasedContent, setPurchasedContent] = useState<string | null>(null);

  const addLog = (type: DebugLogEntry['type'], title: string, data: unknown) => {
    setDebugLogs(prev => [...prev, {
      timestamp: new Date().toISOString(),
      type,
      title,
      data,
    }]);
  };

  const handleSelectContent = (item: ContentItem) => {
    setSelectedItem(item);
    setFlowStep('idle');
    setDebugLogs([]);
    setAgentResponse(null);
    setPaymentDetails(null);
    setPurchasedContent(null);
  };

  const callAgent = async (message: string): Promise<{ completion?: string; error?: string; session_id?: string }> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

    try {
      addLog('request', 'Agent Request', { message: message.substring(0, 100) + '...' });

      const response = await fetch(`${API_ENDPOINT}/invoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, session_id: sessionId }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      addLog('info', 'Response Status', { status: response.status });

      const responseText = await response.text();
      
      try {
        const data = JSON.parse(responseText);
        addLog('response', 'Agent Response', data);
        return data;
      } catch {
        addLog('error', 'Parse Error', { raw: responseText.substring(0, 500) });
        return { error: 'Failed to parse response' };
      }
    } catch (error) {
      clearTimeout(timeoutId);
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isAborted = error instanceof Error && error.name === 'AbortError';
      const isNetworkError = errorMessage === 'Failed to fetch';
      
      addLog('error', 'Request Failed', { error: errorMessage, aborted: isAborted });
      
      if (isAborted) {
        return { error: 'Request timed out after 60 seconds' };
      } else if (isNetworkError) {
        return { error: 'Network error - API Gateway may have timed out (29s limit). The request may still be processing.' };
      }
      return { error: errorMessage };
    }
  };

  // Step 1: Request content (expect 402)
  const handleRequestContent = async () => {
    if (!selectedItem || !walletConnected) return;

    setFlowStep('requesting');
    setDebugLogs([]);
    setAgentResponse(null);
    setPaymentDetails(null);

    const contentUrl = `${SELLER_URL}${selectedItem.path}`;
    const message = `Use the request_content tool to fetch content from ${contentUrl}. Just make the request and tell me what you get back - do NOT proceed with payment yet.`;

    const result = await callAgent(message);
    
    if (result.session_id) setSessionId(result.session_id);

    if (result.error) {
      setFlowStep('error');
      setAgentResponse(`Error: ${result.error}`);
      return;
    }

    // Check if response indicates 402 / payment required
    const completion = result.completion || '';
    setAgentResponse(completion);

    // Try to extract payment details from the response
    // The agent should return structured info about the 402
    if (completion.toLowerCase().includes('402') || 
        completion.toLowerCase().includes('payment required') ||
        completion.toLowerCase().includes('payment_required')) {
      
      // Parse payment details from agent response
      // Look for amount, recipient, network info
      const amountMatch = completion.match(/amount[:\s]+["']?(\d+(?:\.\d+)?)/i) || 
                          completion.match(/(\d+)\s*(?:atomic units|wei)/i);
      const recipientMatch = completion.match(/(?:recipient|payTo)[:\s]+["']?(0x[a-fA-F0-9]{40})/i);
      const networkMatch = completion.match(/network[:\s]+["']?([^"'\s,}]+)/i);
      
      if (amountMatch || recipientMatch) {
        setPaymentDetails({
          scheme: 'exact',
          network: networkMatch?.[1] || 'eip155:84532',
          amount: amountMatch?.[1] || selectedItem.price,
          asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
          currency: 'USDC',
          recipient: recipientMatch?.[1] || '',
          description: selectedItem.title,
          maxTimeoutSeconds: 60,
        });
      }
      setFlowStep('payment_required');
    } else if (completion.toLowerCase().includes('200') || 
               completion.toLowerCase().includes('success')) {
      // Content was free or already paid
      setFlowStep('complete');
    } else {
      // Unknown state - show response and let user decide
      setFlowStep('payment_required');
    }
  };

  // Step 2: Confirm and execute payment
  const handleConfirmPayment = async () => {
    if (!selectedItem || !walletConnected) return;

    setFlowStep('paying');

    const contentUrl = `${SELLER_URL}${selectedItem.path}`;
    const message = `The content at ${contentUrl} requires payment. Please:
1. Sign the payment using sign_payment tool
2. Then use request_content_with_payment to send the signed payment and get the content

Proceed with the payment now.`;

    const result = await callAgent(message);
    
    if (result.session_id) setSessionId(result.session_id);

    if (result.error) {
      setFlowStep('error');
      setAgentResponse(prev => (prev ? prev + '\n\n' : '') + `Payment Error: ${result.error}`);
      return;
    }

    setAgentResponse(prev => (prev ? prev + '\n\n--- Payment Result ---\n\n' : '') + (result.completion || ''));
    
    // Check if payment succeeded
    const completion = result.completion || '';
    if (completion.toLowerCase().includes('200') || 
        completion.toLowerCase().includes('success') ||
        completion.toLowerCase().includes('content') ||
        completion.toLowerCase().includes('delivered')) {
      // Payment succeeded - move to showing data step
      setFlowStep('showing_data');
    } else {
      setFlowStep('error');
    }
  };

  // Step 3: Show the purchased content
  const handleShowContent = async () => {
    if (!selectedItem) return;

    setFlowStep('requesting'); // Reuse requesting state for loading indicator

    const message = `Please present the content data you just received from the successful payment in a clean, readable format. Show me the actual data/content that was purchased.`;

    const result = await callAgent(message);
    
    if (result.session_id) setSessionId(result.session_id);

    if (result.error) {
      setFlowStep('error');
      setAgentResponse(prev => (prev ? prev + '\n\n' : '') + `Error: ${result.error}`);
      return;
    }

    setPurchasedContent(result.completion || 'No content received');
    setFlowStep('complete');
  };

  const handleReset = () => {
    setSelectedItem(null);
    setFlowStep('idle');
    setDebugLogs([]);
    setAgentResponse(null);
    setSessionId(null);
    setPaymentDetails(null);
    setPurchasedContent(null);
  };

  const isLoading = flowStep === 'requesting' || flowStep === 'paying';

  return (
    <div className="content-request">
      <div className="content-header">
        <h3>Premium Content</h3>
        <p>Select content to purchase via x402 payment (step-by-step)</p>
      </div>

      <div className="content-grid">
        {AVAILABLE_CONTENT.map((item) => (
          <button
            key={item.id}
            className={`content-card ${selectedItem?.id === item.id ? 'selected' : ''}`}
            onClick={() => handleSelectContent(item)}
            disabled={isLoading}
          >
            <div className="content-card-title">{item.title}</div>
            <div className="content-card-description">{item.description}</div>
            <div className="content-card-price">
              {item.price} {item.currency}
            </div>
          </button>
        ))}
      </div>

      {selectedItem && (
        <div className="selected-content">
          <div className="selected-info">
            <span className="selected-title">{selectedItem.title}</span>
            <span className="selected-price">
              {selectedItem.price} {selectedItem.currency}
            </span>
            <span className="flow-status">
              {flowStep === 'idle' && '📋 Ready to request'}
              {flowStep === 'requesting' && '🔄 Requesting content...'}
              {flowStep === 'payment_required' && '💳 Payment required - confirm to proceed'}
              {flowStep === 'paying' && '💸 Processing payment...'}
              {flowStep === 'showing_data' && '📦 Payment complete - view your content'}
              {flowStep === 'complete' && '✅ Complete!'}
              {flowStep === 'error' && '❌ Error occurred'}
            </span>
          </div>
          
          <div className="action-buttons">
            {flowStep === 'idle' && (
              <button
                className="request-btn"
                onClick={handleRequestContent}
                disabled={!walletConnected}
              >
                Step 1: Request Content
              </button>
            )}
            
            {flowStep === 'payment_required' && (
              <button
                className="confirm-btn"
                onClick={handleConfirmPayment}
                disabled={!walletConnected}
              >
                Step 2: Confirm Payment ({selectedItem.price} USDC)
              </button>
            )}
            
            {flowStep === 'showing_data' && (
              <button
                className="show-content-btn"
                onClick={handleShowContent}
                disabled={!walletConnected}
              >
                Step 3: View Purchased Content
              </button>
            )}
            
            {(flowStep === 'complete' || flowStep === 'error') && (
              <button className="reset-btn" onClick={handleReset}>
                Start Over
              </button>
            )}
            
            {flowStep !== 'idle' && flowStep !== 'complete' && flowStep !== 'error' && (
              <button className="reset-btn" onClick={handleReset} disabled={isLoading}>
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {paymentDetails && flowStep === 'payment_required' && (
        <div className="payment-details">
          <h5>Payment Details (from 402 response)</h5>
          <div className="payment-details-grid">
            <div className="detail-item">
              <span className="detail-label">Amount</span>
              <span className="detail-value highlight">{selectedItem?.price} USDC</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Network</span>
              <span className="detail-value">{paymentDetails.network}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Recipient</span>
              <span className="detail-value address">{paymentDetails.recipient || 'From 402 response'}</span>
            </div>
          </div>
        </div>
      )}

      {agentResponse && (
        <div className="agent-response">
          <h4>🤖 Agent Response</h4>
          <pre>{agentResponse}</pre>
        </div>
      )}

      {purchasedContent && (
        <div className="purchased-content">
          <h4>📄 Purchased Content</h4>
          <pre>{purchasedContent}</pre>
        </div>
      )}

      {debugLogs.length > 0 && (
        <div className="debug-logs">
          <h4>📋 Debug Log</h4>
          {debugLogs.map((log, index) => (
            <div key={index} className={`debug-entry debug-${log.type}`}>
              <div className="debug-header">
                <span className="debug-type">{log.type.toUpperCase()}</span>
                <span className="debug-title">{log.title}</span>
              </div>
              <pre className="debug-data">
                {typeof log.data === 'string' ? log.data : JSON.stringify(log.data, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ContentRequest;
