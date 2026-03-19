import { useState } from 'react';
import { CrossmintProvider, CrossmintAuthProvider, CrossmintWalletProvider } from '@crossmint/client-sdk-react-ui';
import { CrossmintPing } from './CrossmintPing';
import { useConfiguration } from '../hooks/useConfiguration';

export function App() {
  const [apiKey, setApiKey] = useState('');

  // Lift configuration state to App level so it persists when providers mount/unmount
  const configContext = useConfiguration();

  // Check if we have a valid API key
  const hasValidApiKey = apiKey.startsWith('ck_') || apiKey.startsWith('sk_');

  // Shared component - render with or without providers
  const content = <CrossmintPing apiKey={apiKey} setApiKey={setApiKey} configContext={configContext} />;

  // If no valid API key, render without providers
  if (!hasValidApiKey) {
    return content;
  }

  // With valid API key, wrap in providers
  return (
    <CrossmintProvider apiKey={apiKey}>
      <CrossmintAuthProvider loginMethods={["email", "google"]}>
        <CrossmintWalletProvider createOnLogin={{ chain: 'base-sepolia' as any, signer: { type: 'email' } }}>
          {content}
        </CrossmintWalletProvider>
      </CrossmintAuthProvider>
    </CrossmintProvider>
  );
}


