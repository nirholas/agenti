/**
 * Authentication Status Component
 * 
 * Displays the current authentication status and method for the Gateway API.
 * Provides a refresh button for re-authenticating when using Cognito.
 */

import { useState } from 'react';
import type { AuthMethod } from '../api';
import './AuthStatus.css';

interface AuthStatusProps {
  /** Whether the user is authenticated */
  isAuthenticated: boolean;
  /** Current authentication method */
  authMethod: AuthMethod;
  /** Callback to refresh authentication */
  onRefresh?: () => Promise<void>;
  /** Whether to show detailed status */
  showDetails?: boolean;
}

const AUTH_METHOD_LABELS: Record<AuthMethod, string> = {
  cognito: 'AWS Cognito',
  proxy: 'Backend Proxy',
  'api-key': 'API Key',
  none: 'No Auth',
};

const AUTH_METHOD_ICONS: Record<AuthMethod, string> = {
  cognito: '🔐',
  proxy: '🔄',
  'api-key': '🔑',
  none: '🔓',
};

export function AuthStatus({
  isAuthenticated,
  authMethod,
  onRefresh,
  showDetails = false,
}: AuthStatusProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const handleRefresh = async () => {
    if (!onRefresh || isRefreshing) return;
    
    setIsRefreshing(true);
    setRefreshError(null);
    
    try {
      await onRefresh();
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : 'Refresh failed');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className={`auth-status ${isAuthenticated ? 'authenticated' : 'unauthenticated'}`}>
      <div className="auth-status-main">
        <span className="auth-icon">
          {AUTH_METHOD_ICONS[authMethod]}
        </span>
        <span className="auth-label">
          {AUTH_METHOD_LABELS[authMethod]}
        </span>
        <span className={`auth-indicator ${isAuthenticated ? 'active' : 'inactive'}`}>
          {isAuthenticated ? '●' : '○'}
        </span>
      </div>
      
      {showDetails && (
        <div className="auth-status-details">
          <div className="auth-detail">
            <span className="detail-label">Status:</span>
            <span className={`detail-value ${isAuthenticated ? 'success' : 'warning'}`}>
              {isAuthenticated ? 'Connected' : 'Not Connected'}
            </span>
          </div>
          <div className="auth-detail">
            <span className="detail-label">Method:</span>
            <span className="detail-value">{AUTH_METHOD_LABELS[authMethod]}</span>
          </div>
          
          {authMethod === 'cognito' && onRefresh && (
            <button
              className="auth-refresh-btn"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              {isRefreshing ? 'Refreshing...' : 'Refresh Credentials'}
            </button>
          )}
          
          {refreshError && (
            <div className="auth-error">
              {refreshError}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AuthStatus;
