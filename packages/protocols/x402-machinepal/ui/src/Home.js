import React from 'react';

function Home() {
  return (
    <div>
      <h1>Dashboard</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '30px' }}>Welcome to your MachinePal dashboard.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        <div className="card">
          <h3 style={{ color: 'var(--accent-color)' }}>System Status</h3>
          <p>All systems operational</p>
          <div style={{ marginTop: '10px', fontSize: '24px', fontWeight: 'bold' }}>Online</div>
        </div>

        <div className="card">
          <h3 style={{ color: 'var(--accent-color)' }}>Active Connections</h3>
          <p>Currently connected clients</p>
          <div style={{ marginTop: '10px', fontSize: '24px', fontWeight: 'bold' }}>12</div>
        </div>

        <div className="card">
          <h3 style={{ color: 'var(--accent-color)' }}>Total Transactions</h3>
          <p>Processed in the last 24h</p>
          <div style={{ marginTop: '10px', fontSize: '24px', fontWeight: 'bold' }}>1,245</div>
        </div>
      </div>
    </div>
  );
}

export default Home;
