import React from 'react';

interface ChatHeaderProps {
  nerdMode: boolean;
  onToggleNerdMode: () => void;
  mcpConnected: boolean;
  onStatusClick?: () => void;
  showNerdToggle?: boolean;
}

export function ChatHeader({ nerdMode, onToggleNerdMode, mcpConnected, onStatusClick, showNerdToggle = false }: ChatHeaderProps) {
  return (
    <div className="chat-header">
      <div className="chat-header-top">
        <h1>Events Concierge</h1>
        <div className="chat-header-actions">
          <button
            className="status-pill"
            onClick={onStatusClick}
            aria-label={mcpConnected ? 'Connected' : 'Disconnected'}
            type="button"
          >
            <span className={`status-dot ${mcpConnected ? 'connected' : 'disconnected'}`} />
            {mcpConnected ? 'Connected' : 'Disconnected'}
          </button>
          {showNerdToggle && (
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: 500,
            color: '#475569'
          }}>
            <span>nerd mode</span>
            <div style={{
              position: 'relative',
              width: '44px',
              height: '24px',
              background: nerdMode ? '#3b82f6' : '#cbd5e1',
              borderRadius: '12px',
              transition: 'background 0.2s',
              cursor: 'pointer'
            }}>
              <input
                type="checkbox"
                checked={nerdMode}
                onChange={onToggleNerdMode}
                style={{
                  position: 'absolute',
                  opacity: 0,
                  width: '100%',
                  height: '100%',
                  cursor: 'pointer'
                }}
              />
              <div style={{
                position: 'absolute',
                top: '2px',
                left: nerdMode ? '22px' : '2px',
                width: '20px',
                height: '20px',
                background: 'white',
                borderRadius: '10px',
                transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)'
              }} />
            </div>
          </label>
          )}
        </div>
      </div>
      <p className="subtitle">
        Paid event RSVP system powered by Crossmint smart wallets and x402 protocol
      </p>
    </div>
  );
}
