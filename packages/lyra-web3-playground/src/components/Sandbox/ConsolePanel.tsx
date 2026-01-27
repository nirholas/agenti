/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Creating connections through code 🔗
 */

import { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  Trash2,
  Download,
  Search,
  AlertCircle,
  Info,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';interface Log {
  id: string;
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
  timestamp: number;
}

interface ConsolePanelProps {
  logs: Log[];
  onClear: () => void;
}

export default function ConsolePanel({ logs, onClear }: ConsolePanelProps) {
  const [filter, setFilter] = useState<'all' | 'info' | 'success' | 'error' | 'warning'>('all');
  const [search, setSearch] = useState('');
  const consoleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom when new logs are added
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs]);

  const filteredLogs = logs.filter(log => {
    if (filter !== 'all' && log.type !== filter) return false;
    if (search && !log.message.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const getLogIcon = (type: Log['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getLogColor = (type: Log['type']) => {
    switch (type) {
      case 'success':
        return 'text-green-700 dark:text-green-300';
      case 'error':
        return 'text-red-700 dark:text-red-300';
      case 'warning':
        return 'text-orange-700 dark:text-orange-300';
      default:
        return 'text-blue-700 dark:text-blue-300';
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const time = date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    const ms = date.getMilliseconds().toString().padStart(3, '0');
    return `${time}.${ms}`;
  };

  const handleExport = () => {
    const text = logs.map(log => 
      `[${formatTimestamp(log.timestamp)}] [${log.type.toUpperCase()}] ${log.message}`
    ).join('\n');
    
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `console-${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filterOptions = [
    { value: 'all', label: 'All', count: logs.length },
    { value: 'info', label: 'Info', count: logs.filter(l => l.type === 'info').length },
    { value: 'success', label: 'Success', count: logs.filter(l => l.type === 'success').length },
    { value: 'warning', label: 'Warning', count: logs.filter(l => l.type === 'warning').length },
    { value: 'error', label: 'Error', count: logs.filter(l => l.type === 'error').length },
  ];

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Toolbar */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-2 mb-2">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search logs..."
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
            />
          </div>

          {/* Actions */}
          <button
            onClick={handleExport}
            disabled={logs.length === 0}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-50"
            title="Export logs"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={onClear}
            disabled={logs.length === 0}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-50"
            title="Clear console"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Buttons */}
        <div className="flex gap-1">
          {filterOptions.map(option => (
            <button
              key={option.value}
              onClick={() => setFilter(option.value as any)}
              className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${
                filter === option.value
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {option.label}
              <span className="px-1 bg-gray-200 dark:bg-gray-600 rounded">
                {option.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Console Output */}
      <div 
        ref={consoleRef}
        className="flex-1 overflow-y-auto p-2 font-mono text-sm"
      >
        {filteredLogs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Terminal className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>
                {logs.length === 0 
                  ? 'Console is empty' 
                  : 'No logs match your filter'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className="flex gap-2 px-2 py-1 hover:bg-white dark:hover:bg-gray-800 rounded"
              >
                <span className="text-gray-400 text-xs flex-shrink-0">
                  {formatTimestamp(log.timestamp)}
                </span>
                <div className="flex-shrink-0">
                  {getLogIcon(log.type)}
                </div>
                <span className={`flex-1 ${getLogColor(log.type)}`}>
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-500">
        {filteredLogs.length} / {logs.length} logs
      </div>
    </div>
  );
}
