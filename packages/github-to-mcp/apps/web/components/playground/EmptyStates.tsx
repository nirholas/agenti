/**
 * EmptyStates Component - Empty state displays for playground
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  Plug,
  Wrench,
  FileText,
  MessageSquare,
  Rocket,
  ArrowRight,
  Sparkles,
  Terminal,
  Globe,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type EmptyStateType =
  | 'not-connected'
  | 'no-tools'
  | 'no-resources'
  | 'no-prompts'
  | 'first-time';

export interface EmptyStatesProps {
  /** Type of empty state to display */
  type: EmptyStateType;
  /** Callback when primary action is clicked */
  onAction?: () => void;
  /** Additional CSS classes */
  className?: string;
}

interface EmptyStateConfig {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: string;
  secondaryText?: string;
}

const EMPTY_STATE_CONFIG: Record<EmptyStateType, EmptyStateConfig> = {
  'not-connected': {
    icon: <Plug className="w-12 h-12" />,
    title: 'Not Connected',
    description:
      'Configure your transport settings and connect to an MCP server to start testing.',
    action: 'Connect',
  },
  'no-tools': {
    icon: <Wrench className="w-12 h-12" />,
    title: 'No Tools Available',
    description:
      'This MCP server doesn\'t expose any tools, or tools capability is not enabled.',
    secondaryText: 'Check the server configuration or try a different server.',
  },
  'no-resources': {
    icon: <FileText className="w-12 h-12" />,
    title: 'No Resources Available',
    description:
      'This MCP server doesn\'t expose any resources, or resources capability is not enabled.',
    secondaryText: 'Check the server configuration or try a different server.',
  },
  'no-prompts': {
    icon: <MessageSquare className="w-12 h-12" />,
    title: 'No Prompts Available',
    description:
      'This MCP server doesn\'t expose any prompts, or prompts capability is not enabled.',
    secondaryText: 'Check the server configuration or try a different server.',
  },
  'first-time': {
    icon: <Rocket className="w-12 h-12" />,
    title: 'Welcome to MCP Playground',
    description:
      'Test and debug MCP servers interactively. Connect to a server using stdio, SSE, or streamable HTTP transport.',
    action: 'Get Started',
  },
};

/**
 * EmptyStates - Display contextual empty states
 */
export default function EmptyStates({
  type,
  onAction,
  className = '',
}: EmptyStatesProps) {
  const config = EMPTY_STATE_CONFIG[type];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex flex-col items-center justify-center text-center p-8',
        className
      )}
    >
      <div className="text-neutral-600 mb-4">{config.icon}</div>
      <h3 className="text-lg font-semibold text-white mb-2">{config.title}</h3>
      <p className="text-sm text-neutral-400 max-w-md mb-4">
        {config.description}
      </p>
      {config.secondaryText && (
        <p className="text-xs text-neutral-500 max-w-md mb-4">
          {config.secondaryText}
        </p>
      )}
      {config.action && onAction && (
        <Button
          onClick={onAction}
          rightIcon={<ArrowRight className="w-4 h-4" />}
        >
          {config.action}
        </Button>
      )}
    </motion.div>
  );
}

/**
 * First-time user guide component with more details
 */
export function FirstTimeGuide({
  onGetStarted,
  className = '',
}: {
  onGetStarted?: () => void;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('p-8', className)}
    >
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 text-sm mb-4">
            <Sparkles className="w-4 h-4" />
            MCP Playground
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Test MCP Servers Interactively
          </h1>
          <p className="text-neutral-400">
            Connect to any MCP server and explore its tools, resources, and
            prompts.
          </p>
        </div>

        {/* Transport options */}
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/50">
            <Terminal className="w-8 h-8 text-blue-400 mb-3" />
            <h3 className="font-medium text-white mb-1">STDIO</h3>
            <p className="text-xs text-neutral-400">
              Run a local MCP server command and communicate via standard I/O.
            </p>
          </div>
          <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/50">
            <Globe className="w-8 h-8 text-green-400 mb-3" />
            <h3 className="font-medium text-white mb-1">SSE</h3>
            <p className="text-xs text-neutral-400">
              Connect to a remote MCP server using Server-Sent Events.
            </p>
          </div>
          <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/50">
            <Zap className="w-8 h-8 text-purple-400 mb-3" />
            <h3 className="font-medium text-white mb-1">Streamable HTTP</h3>
            <p className="text-xs text-neutral-400">
              Connect to a remote MCP server using streamable HTTP transport.
            </p>
          </div>
        </div>

        {/* Quick start steps */}
        <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900/50 mb-8">
          <h3 className="font-medium text-white mb-4">Quick Start</h3>
          <ol className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white/10 text-white text-xs flex items-center justify-center">
                1
              </span>
              <div>
                <p className="text-neutral-300">Choose a transport type</p>
                <p className="text-neutral-500 text-xs">
                  Select STDIO for local servers or SSE/HTTP for remote ones.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white/10 text-white text-xs flex items-center justify-center">
                2
              </span>
              <div>
                <p className="text-neutral-300">Configure connection settings</p>
                <p className="text-neutral-500 text-xs">
                  Enter the command, URL, or paste generated server code.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white/10 text-white text-xs flex items-center justify-center">
                3
              </span>
              <div>
                <p className="text-neutral-300">Connect and explore</p>
                <p className="text-neutral-500 text-xs">
                  Browse tools, resources, and prompts exposed by the server.
                </p>
              </div>
            </li>
          </ol>
        </div>

        {/* CTA */}
        {onGetStarted && (
          <div className="text-center">
            <Button
              size="lg"
              onClick={onGetStarted}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Get Started
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/**
 * Connecting state display
 */
export function ConnectingState({ className = '' }: { className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn(
        'flex flex-col items-center justify-center text-center p-8',
        className
      )}
    >
      <div className="relative mb-4">
        <Plug className="w-12 h-12 text-neutral-600" />
        <motion.div
          className="absolute inset-0 border-2 border-yellow-400 rounded-full"
          animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">Connecting...</h3>
      <p className="text-sm text-neutral-400 max-w-md">
        Establishing connection to the MCP server. This may take a few seconds.
      </p>
    </motion.div>
  );
}

/**
 * Error state display
 */
export function ErrorState({
  error,
  onRetry,
  className = '',
}: {
  error: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex flex-col items-center justify-center text-center p-8',
        className
      )}
    >
      <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
        <Plug className="w-6 h-6 text-red-400" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">Connection Failed</h3>
      <p className="text-sm text-red-300 max-w-md mb-4">{error}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try Again
        </Button>
      )}
    </motion.div>
  );
}
