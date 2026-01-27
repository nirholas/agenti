/**
 * Code Block Component with Syntax Highlighting
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import * as React from 'react';
import { Check, Copy, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { copyToClipboard, downloadAsFile } from '@/lib/utils';
import { Button } from './button';

interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
  showLineNumbers?: boolean;
  maxHeight?: string;
  className?: string;
  showCopy?: boolean;
  showDownload?: boolean;
  onCopy?: () => void;
}

export function CodeBlock({
  code,
  language = 'typescript',
  filename,
  showLineNumbers = true,
  maxHeight = '400px',
  className,
  showCopy = true,
  showDownload = false,
  onCopy,
}: CodeBlockProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    const success = await copyToClipboard(code);
    if (success) {
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    const ext = language === 'typescript' ? 'ts' : language === 'json' ? 'json' : 'txt';
    downloadAsFile(code, filename || `code.${ext}`, 'text/plain');
  };

  const lines = code.split('\n');

  return (
    <div className={cn('group relative overflow-hidden rounded-xl border border-neutral-800', className)}>
      {/* Header */}
      {filename && (
        <div className="flex items-center justify-between border-b border-neutral-800 bg-neutral-900/50 px-4 py-2">
          <span className="font-mono text-xs text-neutral-400">{filename}</span>
          <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-600">{language}</span>
        </div>
      )}
      
      {/* Actions */}
      <div className="absolute right-2 top-2 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {showCopy && (
          <Button
            variant="secondary"
            size="icon-sm"
            onClick={handleCopy}
            className="h-7 w-7 shadow-sm"
            title="Copy code"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        )}
        {showDownload && (
          <Button
            variant="secondary"
            size="icon-sm"
            onClick={handleDownload}
            className="h-7 w-7 shadow-sm"
            title="Download file"
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Code */}
      <div 
        className="overflow-auto bg-black text-neutral-300"
        style={{ maxHeight }}
      >
        <pre className="p-4 font-mono text-[13px] leading-relaxed">
          <code>
            {showLineNumbers ? (
              <table className="w-full border-collapse">
                <tbody>
                  {lines.map((line, i) => (
                    <tr key={i} className="hover:bg-white/[0.03]">
                      <td className="w-10 select-none pr-4 text-right align-top text-neutral-700">
                        {i + 1}
                      </td>
                      <td className="whitespace-pre-wrap break-all">
                        {line || ' '}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              code
            )}
          </code>
        </pre>
      </div>
    </div>
  );
}
