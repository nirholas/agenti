import Link from 'next/link';

export default function Home() {
  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      {/* Header */}
      <header style={{ textAlign: 'center', marginBottom: '4rem' }}>
        <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>
          🌙 Lyra Registry
        </h1>
        <p style={{ fontSize: '1.5rem', color: 'var(--secondary)', maxWidth: '600px', margin: '0 auto' }}>
          The NPM for Crypto AI Tools
        </p>
        <p style={{ marginTop: '1rem', color: 'var(--secondary)' }}>
          Discover, evaluate, and integrate 280+ crypto & DeFi MCP tools
        </p>
      </header>

      {/* Quick Stats */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '4rem' }}>
        <StatCard title="Total Tools" value="280+" icon="🔧" />
        <StatCard title="Categories" value="15+" icon="📁" />
        <StatCard title="Blockchains" value="10+" icon="⛓️" />
        <StatCard title="Protocols" value="25+" icon="🏦" />
      </section>

      {/* API Endpoints */}
      <section style={{ marginBottom: '4rem' }}>
        <h2 style={{ fontSize: '1.75rem', marginBottom: '1.5rem' }}>📡 API Endpoints</h2>
        <div style={{ background: 'var(--border)', padding: '1.5rem', borderRadius: '12px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--secondary)' }}>
                <th style={{ textAlign: 'left', padding: '0.75rem' }}>Method</th>
                <th style={{ textAlign: 'left', padding: '0.75rem' }}>Endpoint</th>
                <th style={{ textAlign: 'left', padding: '0.75rem' }}>Description</th>
              </tr>
            </thead>
            <tbody>
              <EndpointRow method="GET" endpoint="/api/tools" description="List and filter all tools" />
              <EndpointRow method="POST" endpoint="/api/tools" description="Register a new tool" />
              <EndpointRow method="GET" endpoint="/api/tools/:id" description="Get tool details" />
              <EndpointRow method="GET" endpoint="/api/search?q=" description="Search tools by name/description" />
              <EndpointRow method="GET" endpoint="/api/trending" description="Get trending tools" />
              <EndpointRow method="GET" endpoint="/api/categories" description="List all categories" />
              <EndpointRow method="GET" endpoint="/api/health" description="Health check and stats" />
              <EndpointRow method="POST" endpoint="/api/discovery" description="Submit tool for review" />
            </tbody>
          </table>
        </div>
      </section>

      {/* Trust Score */}
      <section style={{ marginBottom: '4rem' }}>
        <h2 style={{ fontSize: '1.75rem', marginBottom: '1.5rem' }}>⭐ Trust Score Algorithm</h2>
        <p style={{ marginBottom: '1rem' }}>
          Every tool is scored using the SperaxOS trust algorithm. The score is based on:
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
          <ScoreItem weight={20} name="Validated" description="Verified by community contributors" required />
          <ScoreItem weight={15} name="Has Tools" description="Tool definitions specified" required />
          <ScoreItem weight={15} name="Deployment" description="Deployment options available" required />
          <ScoreItem weight={12} name="Auto Deploy" description="Automated deployment" />
          <ScoreItem weight={10} name="Documentation" description="README provided" required />
          <ScoreItem weight={8} name="License" description="Open source license" />
          <ScoreItem weight={8} name="Prompts" description="Prompt templates included" />
          <ScoreItem weight={8} name="Resources" description="Additional resources" />
          <ScoreItem weight={4} name="Claimed" description="Claimed by developer" />
        </div>
        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
          <GradeBadge grade="A" description="80%+ (All required met)" color="#22c55e" />
          <GradeBadge grade="B" description="60-79% (All required met)" color="#f59e0b" />
          <GradeBadge grade="F" description="<60% or missing required" color="#ef4444" />
        </div>
      </section>

      {/* Quick Start */}
      <section style={{ marginBottom: '4rem' }}>
        <h2 style={{ fontSize: '1.75rem', marginBottom: '1.5rem' }}>🚀 Quick Start</h2>
        <pre>
          <code>{`# Search for DeFi tools
curl "https://lyra-registry.vercel.app/api/search?q=defi&category=defi"

# Get trending tools this week
curl "https://lyra-registry.vercel.app/api/trending?period=week&limit=10"

# Get tool by ID
curl "https://lyra-registry.vercel.app/api/tools/[uuid]"

# Register a new tool
curl -X POST "https://lyra-registry.vercel.app/api/tools" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "my-tool", "description": "...", "category": "defi", "inputSchema": {}}'`}</code>
        </pre>
      </section>

      {/* Footer */}
      <footer style={{ textAlign: 'center', padding: '2rem', borderTop: '1px solid var(--border)' }}>
        <p style={{ color: 'var(--secondary)' }}>
          Part of the <Link href="https://github.com/nirholas/Lyra">Lyra Ecosystem</Link> | 
          Made with 🤍 by nich
        </p>
      </footer>
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string; value: string; icon: string }) {
  return (
    <div style={{
      background: 'var(--border)',
      padding: '1.5rem',
      borderRadius: '12px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{icon}</div>
      <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{value}</div>
      <div style={{ color: 'var(--secondary)' }}>{title}</div>
    </div>
  );
}

function EndpointRow({ method, endpoint, description }: { method: string; endpoint: string; description: string }) {
  const methodColor = method === 'GET' ? '#22c55e' : method === 'POST' ? '#3b82f6' : '#f59e0b';
  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
      <td style={{ padding: '0.75rem' }}>
        <span style={{
          background: methodColor,
          color: 'white',
          padding: '0.25rem 0.5rem',
          borderRadius: '4px',
          fontSize: '0.8rem',
          fontWeight: 'bold',
        }}>
          {method}
        </span>
      </td>
      <td style={{ padding: '0.75rem' }}>
        <code>{endpoint}</code>
      </td>
      <td style={{ padding: '0.75rem', color: 'var(--secondary)' }}>{description}</td>
    </tr>
  );
}

function ScoreItem({ weight, name, description, required }: { weight: number; name: string; description: string; required?: boolean }) {
  return (
    <div style={{
      background: 'var(--border)',
      padding: '1rem',
      borderRadius: '8px',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
    }}>
      <div style={{
        background: 'var(--primary)',
        color: 'white',
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold',
        fontSize: '0.9rem',
      }}>
        {weight}
      </div>
      <div>
        <div style={{ fontWeight: '600' }}>
          {name}
          {required && <span style={{ color: 'var(--error)', marginLeft: '4px' }}>*</span>}
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--secondary)' }}>{description}</div>
      </div>
    </div>
  );
}

function GradeBadge({ grade, description, color }: { grade: string; description: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <span style={{
        background: color,
        color: 'white',
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold',
      }}>
        {grade}
      </span>
      <span style={{ fontSize: '0.9rem', color: 'var(--secondary)' }}>{description}</span>
    </div>
  );
}
