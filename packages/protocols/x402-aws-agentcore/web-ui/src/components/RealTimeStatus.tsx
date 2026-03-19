/**
 * RealTimeStatus Component
 * 
 * Displays real-time status updates during the payment flow, including:
 * - Live event stream with timestamps
 * - Elapsed time tracking
 * - Connection status indicator
 * - Auto-scrolling event log
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import './RealTimeStatus.css';

export type StatusEventType = 
  | 'info'
  | 'request'
  | 'response'
  | 'payment'
  | 'agent'
  | 'success'
  | 'error'
  | 'warning';

export interface StatusEvent {
  id: string;
  type: StatusEventType;
  message: string;
  timestamp: Date;
  details?: Record<string, unknown>;
  duration?: number;
}

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

interface RealTimeStatusProps {
  /** Array of status events to display */
  events: StatusEvent[];
  /** Current connection status */
  connectionStatus?: ConnectionStatus;
  /** Whether the flow is currently active */
  isActive: boolean;
  /** Start time of the current flow */
  flowStartTime?: Date;
  /** Maximum number of events to display */
  maxEvents?: number;
  /** Whether to auto-scroll to new events */
  autoScroll?: boolean;
  /** Callback when user clears events */
  onClear?: () => void;
  /** Title for the status panel */
  title?: string;
}

// Icons for different event types
const EVENT_ICONS: Record<StatusEventType, string> = {
  info: 'ℹ️',
  request: '📤',
  response: '📥',
  payment: '💳',
  agent: '🤖',
  success: '✅',
  error: '❌',
  warning: '⚠️',
};

// Colors for different event types
const EVENT_COLORS: Record<StatusEventType, string> = {
  info: '#64b5f6',
  request: '#ce93d8',
  response: '#81c784',
  payment: '#ffd54f',
  agent: '#ba68c8',
  success: '#4caf50',
  error: '#f44336',
  warning: '#ff9800',
};

export function RealTimeStatus({
  events,
  connectionStatus = 'connected',
  isActive,
  flowStartTime,
  maxEvents = 50,
  autoScroll = true,
  onClear,
  title = 'Real-Time Status',
}: RealTimeStatusProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastEventCountRef = useRef(events.length);

  // Update elapsed time
  useEffect(() => {
    if (!isActive || !flowStartTime || isPaused) {
      return;
    }

    const interval = setInterval(() => {
      setElapsedTime(Date.now() - flowStartTime.getTime());
    }, 100);

    return () => clearInterval(interval);
  }, [isActive, flowStartTime, isPaused]);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (autoScroll && containerRef.current && events.length > lastEventCountRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
    lastEventCountRef.current = events.length;
  }, [events, autoScroll]);

  // Format elapsed time
  const formatElapsedTime = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}m ${seconds}s`;
  };

  // Format timestamp
  const formatTimestamp = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
  };

  // Get connection status indicator
  const getConnectionIndicator = () => {
    switch (connectionStatus) {
      case 'connected':
        return { color: '#4caf50', label: 'Connected', pulse: false };
      case 'connecting':
        return { color: '#ffc107', label: 'Connecting...', pulse: true };
      case 'disconnected':
        return { color: '#9e9e9e', label: 'Disconnected', pulse: false };
      case 'error':
        return { color: '#f44336', label: 'Error', pulse: false };
    }
  };

  const connectionIndicator = getConnectionIndicator();
  const displayEvents = events.slice(-maxEvents);

  return (
    <div className={`realtime-status ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="realtime-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="realtime-title">
          <span className="realtime-icon">📡</span>
          <span>{title}</span>
          {isActive && (
            <span className="live-indicator">
              <span className="live-dot" />
              LIVE
            </span>
          )}
        </div>
        
        <div className="realtime-controls">
          {/* Connection Status */}
          <div className="connection-status">
            <span 
              className={`connection-dot ${connectionIndicator.pulse ? 'pulse' : ''}`}
              style={{ background: connectionIndicator.color }}
            />
            <span className="connection-label">{connectionIndicator.label}</span>
          </div>

          {/* Elapsed Time */}
          {flowStartTime && (
            <div className="elapsed-time">
              <span className="elapsed-label">Elapsed:</span>
              <span className="elapsed-value">{formatElapsedTime(elapsedTime)}</span>
            </div>
          )}

          {/* Event Count */}
          <span className="event-count">{events.length} events</span>

          {/* Toggle Button */}
          <button 
            className="toggle-btn" 
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
            onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        </div>
      </div>

      {isExpanded && (
        <>
          {/* Control Bar */}
          <div className="realtime-control-bar">
            <button 
              className={`control-btn ${isPaused ? 'active' : ''}`}
              onClick={() => setIsPaused(!isPaused)}
              title={isPaused ? 'Resume' : 'Pause'}
            >
              {isPaused ? '▶' : '⏸'}
            </button>
            {onClear && (
              <button 
                className="control-btn"
                onClick={onClear}
                title="Clear events"
              >
                🗑️
              </button>
            )}
            <div className="control-spacer" />
            <span className="auto-scroll-label">
              Auto-scroll: {autoScroll ? 'On' : 'Off'}
            </span>
          </div>

          {/* Event Stream */}
          <div className="realtime-events" ref={containerRef}>
            {displayEvents.length === 0 ? (
              <div className="no-events">
                <span className="no-events-icon">📭</span>
                <span>Waiting for events...</span>
              </div>
            ) : (
              displayEvents.map((event, index) => (
                <StatusEventItem 
                  key={event.id} 
                  event={event}
                  isLatest={index === displayEvents.length - 1 && isActive}
                  formatTimestamp={formatTimestamp}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Individual event item component
interface StatusEventItemProps {
  event: StatusEvent;
  isLatest: boolean;
  formatTimestamp: (date: Date) => string;
}

function StatusEventItem({ event, isLatest, formatTimestamp }: StatusEventItemProps) {
  const [showDetails, setShowDetails] = useState(false);
  const hasDetails = event.details && Object.keys(event.details).length > 0;

  return (
    <div 
      className={`status-event event-${event.type} ${isLatest ? 'latest' : ''}`}
      style={{ '--event-color': EVENT_COLORS[event.type] } as React.CSSProperties}
    >
      <div className="event-timeline">
        <span className="event-timestamp">{formatTimestamp(event.timestamp)}</span>
        <span className="event-dot" />
      </div>
      
      <div className="event-content">
        <div className="event-header">
          <span className="event-icon">{EVENT_ICONS[event.type]}</span>
          <span className="event-message">{event.message}</span>
          {event.duration !== undefined && (
            <span className="event-duration">{event.duration}ms</span>
          )}
        </div>
        
        {hasDetails && (
          <>
            <button 
              className="event-details-toggle"
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? 'Hide details' : 'Show details'}
            </button>
            
            {showDetails && (
              <pre className="event-details">
                {JSON.stringify(event.details, null, 2)}
              </pre>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Hook for managing real-time status events
export function useRealTimeStatus() {
  const [events, setEvents] = useState<StatusEvent[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [flowStartTime, setFlowStartTime] = useState<Date | null>(null);
  const [isActive, setIsActive] = useState(false);
  const eventIdRef = useRef(0);

  const addEvent = useCallback((
    type: StatusEventType,
    message: string,
    details?: Record<string, unknown>,
    duration?: number
  ) => {
    const event: StatusEvent = {
      id: `event-${++eventIdRef.current}`,
      type,
      message,
      timestamp: new Date(),
      details,
      duration,
    };
    setEvents(prev => [...prev, event]);
    return event;
  }, []);

  const startFlow = useCallback(() => {
    setFlowStartTime(new Date());
    setIsActive(true);
    setConnectionStatus('connected');
    addEvent('info', 'Flow started');
  }, [addEvent]);

  const endFlow = useCallback((success: boolean) => {
    setIsActive(false);
    if (success) {
      addEvent('success', 'Flow completed successfully');
    } else {
      addEvent('error', 'Flow ended with error');
    }
  }, [addEvent]);

  const clearEvents = useCallback(() => {
    setEvents([]);
    eventIdRef.current = 0;
  }, []);

  const reset = useCallback(() => {
    clearEvents();
    setFlowStartTime(null);
    setIsActive(false);
    setConnectionStatus('disconnected');
  }, [clearEvents]);

  return {
    events,
    connectionStatus,
    flowStartTime,
    isActive,
    addEvent,
    startFlow,
    endFlow,
    clearEvents,
    reset,
    setConnectionStatus,
  };
}

export default RealTimeStatus;
