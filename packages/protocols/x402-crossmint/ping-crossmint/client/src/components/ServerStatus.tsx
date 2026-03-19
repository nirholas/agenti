import React, { useState, useEffect } from 'react';
import { checkServerStatus, formatServerStatus, type ServerStatus as ServerStatusType } from '../utils/serverStatus';

interface ServerStatusProps {
  serverUrl: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export const ServerStatus: React.FC<ServerStatusProps> = ({
  serverUrl,
  autoRefresh = true,
  refreshInterval = 30000 // 30 seconds
}) => {
  const [status, setStatus] = useState<ServerStatusType>({ isOnline: false, error: 'Checking...' });
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkStatus = async () => {
    try {
      const newStatus = await checkServerStatus(serverUrl);
      setStatus(newStatus);
      setLastChecked(new Date());
    } catch (error) {
      setStatus({
        isOnline: false,
        error: 'Failed to check server status'
      });
    }
  };

  useEffect(() => {
    checkStatus(); // Check immediately

    if (autoRefresh) {
      const interval = setInterval(checkStatus, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [serverUrl, autoRefresh, refreshInterval]);

  const { indicator, message, color } = formatServerStatus(status);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 12px',
      backgroundColor: '#f8f9fa',
      border: '1px solid #dee2e6',
      borderRadius: '6px',
      fontSize: '13px'
    }}>
      <span>{indicator}</span>
      <span style={{ color, fontWeight: '500' }}>{message}</span>

      {lastChecked && (
        <span style={{
          color: '#6c757d',
          fontSize: '11px',
          marginLeft: 'auto'
        }}>
          {lastChecked.toLocaleTimeString()}
        </span>
      )}

      <button
        onClick={checkStatus}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '2px',
          fontSize: '12px',
          opacity: 0.7
        }}
        title="Refresh server status"
      >
        🔄
      </button>
    </div>
  );
};