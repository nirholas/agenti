import { createRoot } from "react-dom/client";
import { ClientApp } from './client';
import MyMcp from './pages/MyMcp';

export function App() {
  try {
    const params = new URL(location.href).searchParams;
    const view = params.get('view');
    if (view === 'my-mcp') {
      return <MyMcp />;
    }
    // Default app - Guest wallet is created server-side by the Guest agent
    return <ClientApp />;
  } catch (error) {
    console.error('App render error:', error);
    return (
      <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
        <h1>Error Loading App</h1>
        <p>Check browser console for details</p>
        <pre style={{ background: '#f5f5f5', padding: '1rem', borderRadius: '4px' }}>
          {String(error)}
        </pre>
      </div>
    );
  }
}

// Render app with error boundary
const root = document.getElementById("root");
if (root) {
  try {
    createRoot(root).render(<App />);
    console.log('✅ App rendered successfully');
  } catch (error) {
    console.error('❌ Failed to render app:', error);
    root.innerHTML = `
      <div style="padding: 2rem; font-family: system-ui;">
        <h1>Failed to Load</h1>
        <p>Error: ${String(error)}</p>
        <p>Check browser console for details</p>
      </div>
    `;
  }
}
