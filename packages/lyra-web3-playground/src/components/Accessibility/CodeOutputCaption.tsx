/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Code output everyone can understand 📝
 */

import { ReactNode } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, Clock, Terminal } from 'lucide-react';
import { cn } from '@/utils/helpers';

type OutputType = 'success' | 'error' | 'warning' | 'info' | 'pending' | 'output';

interface CodeOutputCaptionProps {
  /** Type of output (affects icon and colors) */
  type: OutputType;
  /** Short summary for screen readers */
  summary: string;
  /** Detailed description (optional, for complex outputs) */
  description?: string;
  /** The actual output content */
  children?: ReactNode;
  /** Additional classes */
  className?: string;
  /** Timestamp of execution */
  timestamp?: Date;
  /** Execution duration in ms */
  duration?: number;
}

const typeConfig = {
  success: {
    icon: CheckCircle,
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    borderColor: 'border-green-200 dark:border-green-800',
    textColor: 'text-green-700 dark:text-green-300',
    iconColor: 'text-green-500',
    label: 'Success',
  },
  error: {
    icon: XCircle,
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-200 dark:border-red-800',
    textColor: 'text-red-700 dark:text-red-300',
    iconColor: 'text-red-500',
    label: 'Error',
  },
  warning: {
    icon: AlertTriangle,
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
    textColor: 'text-yellow-700 dark:text-yellow-300',
    iconColor: 'text-yellow-500',
    label: 'Warning',
  },
  info: {
    icon: Info,
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    textColor: 'text-blue-700 dark:text-blue-300',
    iconColor: 'text-blue-500',
    label: 'Info',
  },
  pending: {
    icon: Clock,
    bgColor: 'bg-gray-50 dark:bg-gray-800',
    borderColor: 'border-gray-200 dark:border-gray-700',
    textColor: 'text-gray-700 dark:text-gray-300',
    iconColor: 'text-gray-500',
    label: 'Pending',
  },
  output: {
    icon: Terminal,
    bgColor: 'bg-gray-900 dark:bg-gray-950',
    borderColor: 'border-gray-700 dark:border-gray-600',
    textColor: 'text-gray-100',
    iconColor: 'text-gray-400',
    label: 'Output',
  },
};

/**
 * CodeOutputCaption Component
 * 
 * Provides accessible captions for code execution results.
 * Essential for blind users who cannot see color-coded output.
 * 
 * WCAG 2.1 Compliance:
 * - 1.1.1 Non-text Content: Text alternatives for visual output
 * - 1.3.1 Info and Relationships: Proper structure
 * - 1.4.1 Use of Color: Doesn't rely on color alone
 * 
 * @example
 * <CodeOutputCaption
 *   type="success"
 *   summary="Compilation successful"
 *   description="Contract compiled with no errors in 1.2 seconds"
 * >
 *   <pre>Bytecode: 0x608060...</pre>
 * </CodeOutputCaption>
 */
export function CodeOutputCaption({
  type,
  summary,
  description,
  children,
  className,
  timestamp,
  duration,
}: CodeOutputCaptionProps) {
  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <div
      role="region"
      aria-label={`Code execution result: ${config.label}`}
      className={cn(
        'rounded-lg border overflow-hidden',
        config.bgColor,
        config.borderColor,
        className
      )}
    >
      {/* Header with icon and summary */}
      <div className={cn('flex items-center gap-2 px-4 py-2', config.textColor)}>
        <Icon 
          className={cn('w-5 h-5 flex-shrink-0', config.iconColor)} 
          aria-hidden="true" 
        />
        <span className="font-medium">{summary}</span>
        
        {/* Duration badge */}
        {duration !== undefined && (
          <span className="ml-auto text-xs opacity-70">
            {duration < 1000 ? `${duration}ms` : `${(duration / 1000).toFixed(2)}s`}
          </span>
        )}
      </div>

      {/* Description for additional context */}
      {description && (
        <div className={cn('px-4 pb-2 text-sm', config.textColor, 'opacity-80')}>
          {description}
        </div>
      )}

      {/* Output content */}
      {children && (
        <div className="border-t border-inherit">
          <div className="p-4 font-mono text-sm overflow-x-auto">
            {children}
          </div>
        </div>
      )}

      {/* Timestamp for screen readers */}
      {timestamp && (
        <span className="sr-only">
          Executed at {timestamp.toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}

/**
 * ExecutionLog Component
 * 
 * Renders a log of multiple execution steps with accessibility.
 * Great for showing compilation -> deployment -> verification steps.
 */
interface LogEntry {
  type: OutputType;
  message: string;
  timestamp?: Date;
  details?: string;
}

interface ExecutionLogProps {
  entries: LogEntry[];
  title?: string;
  className?: string;
}

export function ExecutionLog({ entries, title = 'Execution Log', className }: ExecutionLogProps) {
  return (
    <div 
      role="log" 
      aria-label={title}
      aria-live="polite"
      className={cn('space-y-2', className)}
    >
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
        {title}
      </h3>
      
      {entries.map((entry, index) => {
        const config = typeConfig[entry.type];
        const Icon = config.icon;
        
        return (
          <div
            key={index}
            className={cn(
              'flex items-start gap-3 p-3 rounded-lg text-sm',
              config.bgColor
            )}
          >
            <Icon 
              className={cn('w-4 h-4 flex-shrink-0 mt-0.5', config.iconColor)} 
              aria-hidden="true"
            />
            <div className="flex-1 min-w-0">
              <p className={config.textColor}>{entry.message}</p>
              {entry.details && (
                <p className="text-xs opacity-70 mt-1">{entry.details}</p>
              )}
            </div>
            {entry.timestamp && (
              <time 
                className="text-xs opacity-50 flex-shrink-0"
                dateTime={entry.timestamp.toISOString()}
              >
                {entry.timestamp.toLocaleTimeString()}
              </time>
            )}
          </div>
        );
      })}

      {entries.length === 0 && (
        <p className="text-sm text-gray-500 italic">No execution output yet</p>
      )}
    </div>
  );
}

/**
 * ConsoleOutput Component
 * 
 * Styled console output with proper semantics.
 * Includes line numbers and copy functionality.
 */
interface ConsoleOutputProps {
  output: string;
  language?: string;
  lineNumbers?: boolean;
  maxHeight?: string;
  className?: string;
}

export function ConsoleOutput({
  output,
  language = 'plaintext',
  lineNumbers = true,
  maxHeight = '400px',
  className,
}: ConsoleOutputProps) {
  const lines = output.split('\n');

  return (
    <div
      role="region"
      aria-label={`Console output, ${lines.length} lines`}
      className={cn(
        'bg-gray-900 rounded-lg overflow-hidden',
        className
      )}
    >
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <span className="text-xs text-gray-400 uppercase tracking-wide">
          {language} Output
        </span>
        <span className="text-xs text-gray-500">
          {lines.length} line{lines.length !== 1 ? 's' : ''}
        </span>
      </div>
      
      <pre
        className="p-4 overflow-auto text-sm"
        style={{ maxHeight }}
        tabIndex={0}
        aria-label="Console output content"
      >
        <code className="text-gray-100">
          {lineNumbers ? (
            lines.map((line, i) => (
              <div key={i} className="flex">
                <span 
                  className="select-none text-gray-600 text-right pr-4 w-12"
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <span className="flex-1">{line}</span>
              </div>
            ))
          ) : (
            output
          )}
        </code>
      </pre>
    </div>
  );
}

export default CodeOutputCaption;
