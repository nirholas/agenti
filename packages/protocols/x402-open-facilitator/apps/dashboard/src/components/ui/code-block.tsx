'use client';

import { useState, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Highlight, themes } from 'prism-react-renderer';

interface CodeBlockProps {
  code: string;
  language?: string;
  showCopy?: boolean;
  className?: string;
}

export function CodeBlock({
  code,
  language = 'typescript',
  showCopy = true,
  className
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Map common language names to prism languages
  const prismLanguage = language === 'bash' || language === 'shell' ? 'bash' :
                        language === 'ts' ? 'typescript' :
                        language === 'js' ? 'javascript' :
                        language;

  return (
    <div className={cn("relative", className)}>
      <Highlight
        theme={themes.nightOwl}
        code={code.trim()}
        language={prismLanguage as 'typescript' | 'javascript' | 'bash'}
      >
        {({ className: preClassName, style, tokens, getLineProps, getTokenProps }) => (
          <pre
            className={cn(
              preClassName,
              "rounded-lg p-4 pr-12 overflow-x-auto text-[13px] font-mono leading-relaxed border border-zinc-800"
            )}
            style={{ ...style, backgroundColor: '#0d1117' }}
          >
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })}>
                {line.map((token, key) => (
                  <span key={key} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
      {showCopy && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-2 top-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700/50"
          onClick={handleCopy}
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      )}
    </div>
  );
}
