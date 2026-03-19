/**
 * Utilities for checking server availability and health status
 */

export interface ServerHealth {
  status: 'healthy' | 'unhealthy';
  timestamp?: string;
  uptime?: number;
  port?: number;
  network?: string;
  payTo?: string;
  endpoints?: Record<string, string>;
}

export interface ServerStatus {
  isOnline: boolean;
  health?: ServerHealth;
  error?: string;
  responseTime?: number;
}

/**
 * Check if the server is available and healthy
 */
export async function checkServerStatus(serverUrl: string): Promise<ServerStatus> {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(`${serverUrl}/health`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      }
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      return {
        isOnline: false,
        error: `Server responded with ${response.status} ${response.statusText}`,
        responseTime
      };
    }

    const health: ServerHealth = await response.json();

    return {
      isOnline: true,
      health,
      responseTime
    };

  } catch (error) {
    const responseTime = Date.now() - startTime;
    let errorMessage = 'Unknown error';

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMessage = 'Request timeout (5s)';
      } else {
        errorMessage = error.message;
      }
    }

    return {
      isOnline: false,
      error: errorMessage,
      responseTime
    };
  }
}

/**
 * Format server status for display
 */
export function formatServerStatus(status: ServerStatus): {
  indicator: string;
  message: string;
  color: string;
} {
  if (!status.isOnline) {
    return {
      indicator: '🔴',
      message: `Server offline${status.error ? `: ${status.error}` : ''}`,
      color: '#dc3545'
    };
  }

  if (status.health?.status === 'healthy') {
    const uptime = status.health.uptime ? Math.floor(status.health.uptime / 60) : 0;
    const responseTime = status.responseTime || 0;
    return {
      indicator: '🟢',
      message: `Server online (${responseTime}ms, uptime: ${uptime}m)`,
      color: '#28a745'
    };
  }

  return {
    indicator: '🟡',
    message: 'Server responding but status unknown',
    color: '#ffc107'
  };
}