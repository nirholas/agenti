import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import Home from './Home';
import Transactions from './Transactions';
import Resources from './Resources';
import Reports from './Reports';

function App() {
  return (
    <Router>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        {/* Left Menu Sidebar */}
        <div className="sidebar">
          <div className="sidebar-header">
            <span>MachinePal</span>
          </div>
          <nav className="sidebar-nav">
            <NavLink
              to="/"
              className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}
              end
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/transactions"
              className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}
            >
              Transactions
            </NavLink>
            <NavLink
              to="/resources"
              className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}
            >
              Resources
            </NavLink>
            <NavLink
              to="/reports"
              className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}
            >
              Reports
            </NavLink>
          </nav>

          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px', marginTop: 'auto' }}>
            Built with <span role="img" aria-label="love">❤️</span> by SKALE Labs
          </div>
        </div>

        {/* Main Content Area */}
        <div className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/resources" element={<Resources />} />
            <Route path="/reports" element={<Reports />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
