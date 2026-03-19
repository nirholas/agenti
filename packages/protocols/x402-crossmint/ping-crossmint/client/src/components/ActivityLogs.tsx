import React from 'react';
import type { LogEntry } from '../types';

interface ActivityLogsProps {
    logs: LogEntry[];
}

export const ActivityLogs: React.FC<ActivityLogsProps> = ({ logs }) => {
    const getLogStyle = (type: LogEntry['type']) => {
        const baseStyle = {
            padding: '8px 12px',
            margin: '4px 0',
            borderRadius: '4px',
            fontSize: '13px',
            borderLeft: '4px solid'
        };

        switch (type) {
            case 'success':
                return {
                    ...baseStyle,
                    backgroundColor: '#d4edda',
                    borderLeftColor: '#28a745',
                    color: '#155724'
                };
            case 'error':
                return {
                    ...baseStyle,
                    backgroundColor: '#f8d7da',
                    borderLeftColor: '#dc3545',
                    color: '#721c24'
                };
            case 'warning':
                return {
                    ...baseStyle,
                    backgroundColor: '#fff3cd',
                    borderLeftColor: '#ffc107',
                    color: '#856404'
                };
            default:
                return {
                    ...baseStyle,
                    backgroundColor: '#e2e3e5',
                    borderLeftColor: '#6c757d',
                    color: '#383d41'
                };
        }
    };

    const formatTimestamp = (timestamp: number) => {
        return new Date(timestamp).toLocaleTimeString();
    };

    return (
        <div style={{
            border: '1px solid #ddd',
            borderRadius: '8px',
            backgroundColor: '#f9f9f9',
            height: '100%',
            display: 'flex',
            flexDirection: 'column'
        }}>
            <div style={{
                padding: '12px',
                borderBottom: '1px solid #ddd',
                backgroundColor: '#fff',
                borderTopLeftRadius: '8px',
                borderTopRightRadius: '8px',
                flexShrink: 0
            }}>
                <h3 style={{ margin: 0, fontSize: '16px' }}>📋 Activity Logs</h3>
            </div>

            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '8px',
                minHeight: '200px'
            }}>
                {logs.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        color: '#666',
                        padding: '20px',
                        fontStyle: 'italic'
                    }}>
                        No activity yet
                    </div>
                ) : (
                    logs.slice().reverse().map((log, index) => (
                        <div key={index} style={getLogStyle(log.type)}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                gap: '8px'
                            }}>
                                <span style={{ flex: 1 }}>{log.message}</span>
                                <span style={{
                                    fontSize: '11px',
                                    opacity: 0.7,
                                    whiteSpace: 'nowrap'
                                }}>
                                    {formatTimestamp(log.timestamp)}
                                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};