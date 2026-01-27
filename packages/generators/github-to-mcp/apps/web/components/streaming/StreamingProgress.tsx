/**
 * Streaming Progress Component - Real-time conversion progress via SSE
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Github,
  Code2,
  Package,
  Terminal,
  Check,
  Loader2,
  AlertCircle,
  Wifi,
  WifiOff,
  Play,
  Pause,
  X,
  RefreshCw,
  Zap,
  FileJson,
  Database,
  Search,
} from 'lucide-react';
import type { 
  StreamingEvent, 
  StreamingProgressData, 
  StreamingToolData,
  StreamingStatus,
  Tool,
  ConversionResult,
} from '@/types';

interface StreamingProgressProps {
  url: string;
  onComplete: (result: ConversionResult) => void;
  onError: (error: string) => void;
  onCancel?: () => void;
  autoStart?: boolean;
}

const STEP_ICONS: Record<string, typeof Github> = {
  'fetch': Github,
  'clone': Github,
  'analyze': Search,
  'parse': Code2,
  'extract': Package,
  'generate': Terminal,
  'openapi': FileJson,
  'graphql': Database,
  'readme': FileJson,
  'code': Code2,
  'complete': Check,
};

const STEP_COLORS: Record<string, string> = {
  'fetch': 'from-blue-500/20 to-blue-600/10',
  'clone': 'from-blue-500/20 to-blue-600/10',
  'analyze': 'from-purple-500/20 to-purple-600/10',
  'parse': 'from-green-500/20 to-green-600/10',
  'extract': 'from-orange-500/20 to-orange-600/10',
  'generate': 'from-pink-500/20 to-pink-600/10',
  'complete': 'from-emerald-500/20 to-emerald-600/10',
};

export default function StreamingProgress({
  url,
  onComplete,
  onError,
  onCancel,
  autoStart = true,
}: StreamingProgressProps) {
  const [status, setStatus] = useState<StreamingStatus>('idle');
  const [currentProgress, setCurrentProgress] = useState<StreamingProgressData | null>(null);
  const [discoveredTools, setDiscoveredTools] = useState<Tool[]>([]);
  const [logs, setLogs] = useState<Array<{ message: string; timestamp: string; type: 'info' | 'tool' | 'error' }>>([]);
  const [overallProgress, setOverallProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Elapsed time timer
  useEffect(() => {
    if (status === 'streaming' && !isPaused) {
      startTimeRef.current = startTimeRef.current || Date.now();
      timerRef.current = setInterval(() => {
        if (startTimeRef.current) {
          setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }
      }, 100);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [status, isPaused]);

  const addLog = useCallback((message: string, type: 'info' | 'tool' | 'error' = 'info') => {
    setLogs(prev => [...prev, { 
      message, 
      timestamp: new Date().toISOString(),
      type,
    }].slice(-50)); // Keep last 50 logs
  }, []);

  const startStreaming = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setStatus('connecting');
    setDiscoveredTools([]);
    setLogs([]);
    setOverallProgress(0);
    setElapsedTime(0);
    startTimeRef.current = null;
    addLog('Connecting to conversion stream...');

    const encodedUrl = encodeURIComponent(url);
    const eventSource = new EventSource(`/api/stream?url=${encodedUrl}`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setStatus('streaming');
      addLog('Connected. Starting conversion...');
    };

    eventSource.onmessage = (event) => {
      try {
        const data: StreamingEvent = JSON.parse(event.data);
        
        switch (data.type) {
          case 'progress': {
            const progressData = data.data as StreamingProgressData;
            setCurrentProgress(progressData);
            setOverallProgress(progressData.progress);
            addLog(`${progressData.step}: ${progressData.description}`);
            break;
          }
          
          case 'tool': {
            const toolData = data.data as StreamingToolData;
            setDiscoveredTools(prev => [...prev, toolData.tool]);
            setOverallProgress(Math.min(90, 50 + (toolData.index / toolData.total) * 40));
            addLog(`Discovered tool: ${toolData.tool.name}`, 'tool');
            break;
          }
          
          case 'complete': {
            const completeData = data.data as { result: ConversionResult; totalTime: number };
            setStatus('complete');
            setOverallProgress(100);
            addLog(`Conversion complete! Found ${completeData.result.tools.length} tools in ${(completeData.totalTime / 1000).toFixed(1)}s`);
            eventSource.close();
            onComplete(completeData.result);
            break;
          }
          
          case 'error': {
            const errorData = data.data as { error: string; code: string };
            setStatus('error');
            addLog(`Error: ${errorData.error}`, 'error');
            eventSource.close();
            onError(errorData.error);
            break;
          }
        }
      } catch (err) {
        console.error('Failed to parse streaming event:', err);
      }
    };

    eventSource.onerror = () => {
      if (status !== 'complete' && status !== 'error') {
        setStatus('error');
        addLog('Connection lost. Please try again.', 'error');
        eventSource.close();
        onError('Connection to server lost');
      }
    };
  }, [url, onComplete, onError, addLog, status]);

  const stopStreaming = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setStatus('idle');
    addLog('Conversion cancelled');
    onCancel?.();
  }, [onCancel, addLog]);

  const togglePause = useCallback(() => {
    setIsPaused(prev => !prev);
    // Note: True pause would require server-side support
    // This just pauses the UI timer
  }, []);

  // Auto-start if configured
  useEffect(() => {
    if (autoStart && status === 'idle' && url) {
      startStreaming();
    }
    
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [autoStart, url]); // Intentionally not including startStreaming to prevent loops

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'connecting':
        return <Wifi className="w-5 h-5 text-blue-400 animate-pulse" />;
      case 'streaming':
        return <Zap className="w-5 h-5 text-green-400 animate-pulse" />;
      case 'complete':
        return <Check className="w-5 h-5 text-green-400" />;
      case 'error':
        return <WifiOff className="w-5 h-5 text-red-400" />;
      default:
        return <Loader2 className="w-5 h-5 text-neutral-400" />;
    }
  };

  const StepIcon = currentProgress?.step ? (STEP_ICONS[currentProgress.step] || Code2) : Code2;
  const stepColor = currentProgress?.step ? (STEP_COLORS[currentProgress.step] || 'from-neutral-500/20 to-neutral-600/10') : 'from-neutral-500/20 to-neutral-600/10';

  return (
    <div className="space-y-6">
      {/* Main progress card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-neutral-800 bg-neutral-900/50 backdrop-blur-xl overflow-hidden"
      >
        {/* Header */}
        <div className={`p-6 bg-gradient-to-br ${stepColor}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {getStatusIcon()}
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {status === 'connecting' && 'Connecting...'}
                  {status === 'streaming' && 'Converting Repository'}
                  {status === 'complete' && 'Conversion Complete'}
                  {status === 'error' && 'Conversion Failed'}
                  {status === 'idle' && 'Ready to Convert'}
                </h3>
                <p className="text-sm text-neutral-400">
                  {status === 'streaming' && `Elapsed: ${formatTime(elapsedTime)}`}
                  {status === 'complete' && `Completed in ${formatTime(elapsedTime)}`}
                  {status === 'idle' && 'Click start to begin'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {status === 'streaming' && (
                <>
                  <button
                    onClick={togglePause}
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                    title={isPaused ? 'Resume' : 'Pause'}
                  >
                    {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={stopStreaming}
                    className="p-2 rounded-lg bg-white/10 hover:bg-red-500/20 transition-colors"
                    title="Cancel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              )}
              {(status === 'error' || status === 'idle') && (
                <button
                  onClick={startStreaming}
                  className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg font-medium hover:bg-neutral-200 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  {status === 'error' ? 'Retry' : 'Start'}
                </button>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="relative h-2 bg-black/30 rounded-full overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 bg-white rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${overallProgress}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
            {status === 'streaming' && (
              <motion.div
                className="absolute inset-y-0 w-20 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                animate={{ x: ['-100%', '500%'] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              />
            )}
          </div>
          <div className="flex justify-between mt-2 text-xs text-neutral-400">
            <span>{currentProgress?.description || 'Waiting...'}</span>
            <span>{Math.round(overallProgress)}%</span>
          </div>
        </div>

        {/* Current step detail */}
        {currentProgress && status === 'streaming' && (
          <div className="p-4 border-t border-neutral-800">
            <div className="flex items-center gap-4">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="w-12 h-12 rounded-xl bg-white/5 border border-neutral-700 flex items-center justify-center"
              >
                <StepIcon className="w-6 h-6 text-white" />
              </motion.div>
              <div className="flex-1">
                <div className="font-medium text-white capitalize">{currentProgress.step}</div>
                <div className="text-sm text-neutral-400">{currentProgress.description}</div>
                {currentProgress.details && (
                  <div className="text-xs text-neutral-500 mt-1 font-mono">{currentProgress.details}</div>
                )}
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Discovered tools */}
      <AnimatePresence>
        {discoveredTools.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl border border-neutral-800 bg-neutral-900/50 backdrop-blur-xl overflow-hidden"
          >
            <div className="p-4 border-b border-neutral-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-green-400" />
                  <span className="font-medium text-white">Discovered Tools</span>
                </div>
                <span className="text-sm text-neutral-400">{discoveredTools.length} found</span>
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto">
              <div className="p-2 space-y-1">
                {discoveredTools.map((tool, index) => (
                  <motion.div
                    key={`${tool.name}-${index}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center">
                      <Check className="w-3 h-3 text-green-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-sm text-white truncate">{tool.name}</div>
                      <div className="text-xs text-neutral-500 truncate">{tool.description}</div>
                    </div>
                    <span className="text-xs text-neutral-600 px-1.5 py-0.5 bg-white/5 rounded">
                      {tool.source?.type || 'unknown'}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live logs */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="rounded-xl border border-neutral-800 bg-black/50 overflow-hidden"
      >
        <div className="flex items-center justify-between p-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-neutral-500" />
            <span className="text-sm font-medium text-neutral-400">Live Log</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-neutral-500">Live</span>
          </div>
        </div>
        <div className="h-40 overflow-y-auto font-mono text-xs p-3 space-y-1 scrollbar-thin">
          {logs.map((log, index) => (
            <div
              key={index}
              className={`flex gap-2 ${
                log.type === 'error' ? 'text-red-400' : 
                log.type === 'tool' ? 'text-green-400' : 
                'text-neutral-500'
              }`}
            >
              <span className="text-neutral-600 flex-shrink-0">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span>{log.message}</span>
            </div>
          ))}
          {logs.length === 0 && (
            <div className="text-neutral-600">Waiting for events...</div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
