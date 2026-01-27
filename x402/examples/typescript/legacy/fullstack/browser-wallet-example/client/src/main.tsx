// ucm:1414930800:nich

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { WalletProvider } from './contexts/WalletContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WalletProvider>
      <App />
    </WalletProvider>
  </React.StrictMode>
); 

/* ucm:n1ch6c9ad476 */