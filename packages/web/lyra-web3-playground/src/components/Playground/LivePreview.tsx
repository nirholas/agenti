/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Trust the process, enjoy the journey 🎢
 */

import { useState, useEffect, useRef } from 'react';
import { RefreshCw, ExternalLink, Smartphone, Monitor, Tablet, AlertCircle } from 'lucide-react';

interface LivePreviewProps {
  html?: string;
  css?: string;
  javascript?: string;
  title?: string;
  allowFullscreen?: boolean;
}

type ViewportSize = 'mobile' | 'tablet' | 'desktop' | 'full';

export default function LivePreview({
  html = '',
  css = '',
  javascript = '',
  title = 'Live Preview',
  allowFullscreen = true
}: LivePreviewProps) {
  const [viewport, setViewport] = useState<ViewportSize>('full');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const viewportSizes: Record<ViewportSize, { width: string; label: string; icon: React.ReactNode }> = {
    mobile: { width: '375px', label: 'Mobile', icon: <Smartphone className="w-4 h-4" /> },
    tablet: { width: '768px', label: 'Tablet', icon: <Tablet className="w-4 h-4" /> },
    desktop: { width: '1024px', label: 'Desktop', icon: <Monitor className="w-4 h-4" /> },
    full: { width: '100%', label: 'Full', icon: <Monitor className="w-4 h-4" /> }
  };

  useEffect(() => {
    updatePreview();
  }, [html, css, javascript]);

  const updatePreview = () => {
    if (!iframeRef.current) return;

    try {
      setError(null);
      const iframe = iframeRef.current;
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;

      if (!iframeDoc) {
        setError('Unable to access preview document');
        return;
      }

      const content = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${title}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
              line-height: 1.6;
              color: #333;
              padding: 1rem;
            }
            ${css}
          </style>
        </head>
        <body>
          ${html}
          <script>
            // Error handler
            window.onerror = function(msg, url, lineNo, columnNo, error) {
              console.error('Error: ' + msg + ' at line ' + lineNo);
              return false;
            };

            // Console capture
            (function() {
              const originalLog = console.log;
              const originalError = console.error;
              const originalWarn = console.warn;

              console.log = function(...args) {
                window.parent.postMessage({ type: 'console', level: 'log', args }, '*');
                originalLog.apply(console, args);
              };

              console.error = function(...args) {
                window.parent.postMessage({ type: 'console', level: 'error', args }, '*');
                originalError.apply(console, args);
              };

              console.warn = function(...args) {
                window.parent.postMessage({ type: 'console', level: 'warn', args }, '*');
                originalWarn.apply(console, args);
              };
            })();

            // User script
            try {
              ${javascript}
            } catch (error) {
              console.error('Script error:', error.message);
            }
          </script>
        </body>
        </html>
      `;

      iframeDoc.open();
      iframeDoc.write(content);
      iframeDoc.close();
    } catch (err: any) {
      setError(err.message || 'Failed to render preview');
      console.error('Preview error:', err);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    updatePreview();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleOpenInNewTab = () => {
    const content = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>${css}</style>
      </head>
      <body>
        ${html}
        <script>${javascript}</script>
      </body>
      </html>
    `;

    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');

    // Clean up after a delay
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">
            {title}
          </h3>

          {/* Viewport Buttons */}
          <div className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
            {(Object.keys(viewportSizes) as ViewportSize[]).map((size) => (
              <button
                key={size}
                onClick={() => setViewport(size)}
                className={`
                  p-1.5 rounded transition-colors
                  ${viewport === size
                    ? 'bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }
                `}
                title={viewportSizes[size].label}
              >
                {viewportSizes[size].icon}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh preview"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          {allowFullscreen && (
            <button
              onClick={handleOpenInNewTab}
              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Open in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Preview Area */}
      <div className="flex-1 bg-gray-100 dark:bg-gray-950 flex items-center justify-center overflow-auto">
        {error ? (
          <div className="flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="font-medium">Preview Error</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        ) : (
          <div
            className="bg-white shadow-lg transition-all duration-300 h-full"
            style={{
              width: viewportSizes[viewport].width,
              maxWidth: '100%'
            }}
          >
            <iframe
              ref={iframeRef}
              title={title}
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin allow-modals"
            />
          </div>
        )}
      </div>
    </div>
  );
}
