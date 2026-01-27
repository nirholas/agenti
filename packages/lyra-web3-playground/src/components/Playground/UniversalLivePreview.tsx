/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Embrace the bugs, they make you stronger 🦋
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { LiveProvider, LivePreview as ReactLivePreview, LiveError } from 'react-live';
import { RefreshCw, ExternalLink, Smartphone, Monitor, Tablet, AlertCircle, Play, Loader } from 'lucide-react';

interface CodeTab {
  id: string;
  label: string;
  language: string;
  code: string;
}

interface UniversalLivePreviewProps {
  tabs: CodeTab[];
  activeTabId?: string;
  title?: string;
  allowFullscreen?: boolean;
  scope?: Record<string, any>;
}

type ViewportSize = 'mobile' | 'tablet' | 'desktop' | 'full';

// Scope for react-live to access common libraries
const defaultScope = {
  useState,
  useEffect,
  useRef,
  useMemo,
};

export default function UniversalLivePreview({
  tabs,
  activeTabId,
  title = 'Live Preview',
  allowFullscreen = true,
  scope = {}
}: UniversalLivePreviewProps) {
  const [viewport, setViewport] = useState<ViewportSize>('full');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPyodideLoading, setIsPyodideLoading] = useState(false);
  const [pythonOutput, setPythonOutput] = useState<string[]>([]);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const pyodideRef = useRef<any>(null);

  const viewportSizes: Record<ViewportSize, { width: string; label: string; icon: React.ReactNode }> = {
    mobile: { width: '375px', label: 'Mobile', icon: <Smartphone className="w-4 h-4" /> },
    tablet: { width: '768px', label: 'Tablet', icon: <Tablet className="w-4 h-4" /> },
    desktop: { width: '1024px', label: 'Desktop', icon: <Monitor className="w-4 h-4" /> },
    full: { width: '100%', label: 'Full', icon: <Monitor className="w-4 h-4" /> }
  };

  // Determine the active tab for preview
  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];
  const language = activeTab?.language || 'javascript';

  // Get HTML/CSS/JS tabs for vanilla preview
  const htmlTab = tabs.find(t => t.language === 'html' || t.id === 'html');
  const cssTab = tabs.find(t => t.language === 'css' || t.id === 'css');
  const jsTab = tabs.find(t => t.language === 'javascript' || t.id === 'javascript' || t.id === 'js');

  // Determine preview type based on active tab or available tabs
  const getPreviewType = (): 'html' | 'react' | 'vue' | 'python' | 'solidity' | 'unsupported' => {
    // If we have HTML tab with CSS/JS, use iframe preview
    if (htmlTab) return 'html';
    
    // Check active tab language
    switch (language) {
      case 'typescript':
      case 'tsx':
      case 'jsx':
        return 'react';
      case 'vue':
        return 'vue';
      case 'python':
        return 'python';
      case 'solidity':
        return 'solidity';
      case 'html':
      case 'javascript':
        return 'html';
      default:
        return 'unsupported';
    }
  };

  const previewType = getPreviewType();

  // Update HTML/JS/CSS preview
  useEffect(() => {
    if (previewType === 'html') {
      updateHtmlPreview();
    }
  }, [htmlTab?.code, cssTab?.code, jsTab?.code, previewType]);

  const updateHtmlPreview = () => {
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
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; }
            ${cssTab?.code || ''}
          </style>
        </head>
        <body>
          ${htmlTab?.code || ''}
          <script>
            window.onerror = function(msg, url, lineNo) {
              console.error('Error: ' + msg + ' at line ' + lineNo);
              return false;
            };
            try {
              ${jsTab?.code || ''}
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
    }
  };

  // Load Pyodide for Python execution
  const loadPyodide = async () => {
    if (pyodideRef.current) return pyodideRef.current;
    
    setIsPyodideLoading(true);
    try {
      // @ts-ignore - Pyodide is loaded via CDN
      const pyodide = await (window as any).loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/"
      });
      pyodideRef.current = pyodide;
      setIsPyodideLoading(false);
      return pyodide;
    } catch (err: any) {
      setIsPyodideLoading(false);
      setError('Failed to load Python runtime: ' + err.message);
      return null;
    }
  };

  // Execute Python code
  const runPython = async () => {
    setPythonOutput([]);
    setError(null);
    
    const pyodide = await loadPyodide();
    if (!pyodide) return;

    try {
      // Redirect stdout
      pyodide.runPython(`
        import sys
        from io import StringIO
        sys.stdout = StringIO()
      `);

      // Run user code
      const pythonCode = activeTab?.code || '';
      pyodide.runPython(pythonCode);

      // Get output
      const output = pyodide.runPython('sys.stdout.getvalue()');
      setPythonOutput(output.split('\n').filter((line: string) => line));
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Transform React/TypeScript code for react-live
  const transformReactCode = (code: string): string => {
    // Remove import statements (react-live doesn't need them)
    let transformed = code
      .replace(/^import\s+.*?from\s+['"].*?['"];?\s*$/gm, '')
      .replace(/^import\s+['"].*?['"];?\s*$/gm, '')
      .replace(/^export\s+default\s+/gm, '')
      .replace(/^export\s+/gm, '');
    
    // If it's a function component, wrap it for rendering
    if (transformed.includes('function') || transformed.includes('=>')) {
      // Check if it ends with just a component name
      const componentMatch = transformed.match(/function\s+(\w+)/);
      if (componentMatch) {
        const componentName = componentMatch[1];
        // Add render call at the end if not present
        if (!transformed.includes(`<${componentName}`)) {
          transformed = `${transformed}\n\nrender(<${componentName} />)`;
        }
      }
    }
    
    return transformed.trim();
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    if (previewType === 'html') {
      updateHtmlPreview();
    } else if (previewType === 'python') {
      runPython();
    }
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleOpenInNewTab = () => {
    if (previewType !== 'html') return;
    
    const content = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <style>${cssTab?.code || ''}</style>
      </head>
      <body>
        ${htmlTab?.code || ''}
        <script>${jsTab?.code || ''}</script>
      </body>
      </html>
    `;

    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  // Render React preview using react-live
  const renderReactPreview = () => {
    const code = transformReactCode(activeTab?.code || '');
    const combinedScope = { ...defaultScope, ...scope };

    return (
      <div className="h-full flex flex-col">
        <LiveProvider code={code} scope={combinedScope} noInline>
          <div className="flex-1 p-4 bg-white overflow-auto">
            <ReactLivePreview />
          </div>
          <LiveError className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-mono" />
        </LiveProvider>
      </div>
    );
  };

  // Render Vue preview (basic support via iframe)
  const renderVuePreview = () => {
    const vueCode = activeTab?.code || '';
    
    // Create a simple Vue 3 environment in iframe
    const vueHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
        <style>
          body { font-family: -apple-system, sans-serif; padding: 1rem; }
          .demo { padding: 1rem; border: 1px solid #e2e8f0; border-radius: 8px; }
        </style>
      </head>
      <body>
        <div id="app"></div>
        <script>
          const { createApp, ref, computed, onMounted, reactive } = Vue;
          
          try {
            ${vueCode}
            
            // Try to mount if app is defined
            if (typeof app !== 'undefined') {
              app.mount('#app');
            } else if (typeof App !== 'undefined') {
              createApp(App).mount('#app');
            }
          } catch (error) {
            document.getElementById('app').innerHTML = '<pre style="color: red;">' + error.message + '</pre>';
          }
        </script>
      </body>
      </html>
    `;

    return (
      <iframe
        ref={iframeRef}
        srcDoc={vueHtml}
        title="Vue Preview"
        className="w-full h-full border-0 bg-white"
        sandbox="allow-scripts"
      />
    );
  };

  // Render Python output
  const renderPythonPreview = () => {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={runPython}
            disabled={isPyodideLoading}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {isPyodideLoading ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Loading Python...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run Python
              </>
            )}
          </button>
          <p className="mt-2 text-xs text-gray-500">
            Powered by Pyodide - Python runs directly in your browser!
          </p>
        </div>
        <div className="flex-1 bg-gray-900 p-4 font-mono text-sm overflow-auto">
          {error ? (
            <div className="text-red-400">{error}</div>
          ) : pythonOutput.length > 0 ? (
            pythonOutput.map((line, i) => (
              <div key={i} className="text-green-400">{line}</div>
            ))
          ) : (
            <div className="text-gray-500">Click "Run Python" to execute the code</div>
          )}
        </div>
      </div>
    );
  };

  // Render Solidity preview (contract info)
  const renderSolidityPreview = () => {
    const code = activeTab?.code || '';
    
    // Extract contract name
    const contractMatch = code.match(/contract\s+(\w+)/);
    const contractName = contractMatch ? contractMatch[1] : 'Unknown';
    
    // Extract functions
    const functionMatches = code.matchAll(/function\s+(\w+)\s*\([^)]*\)\s*(public|external|internal|private)?/g);
    const functions = Array.from(functionMatches).map(m => ({
      name: m[1],
      visibility: m[2] || 'public'
    }));

    // Extract events
    const eventMatches = code.matchAll(/event\s+(\w+)\s*\([^)]*\)/g);
    const events = Array.from(eventMatches).map(m => m[1]);

    return (
      <div className="h-full p-4 bg-gray-50 dark:bg-gray-800 overflow-auto">
        <div className="space-y-4">
          <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span className="text-purple-500">◆</span>
              {contractName}
            </h3>
            <p className="text-sm text-gray-500 mt-1">Solidity Smart Contract</p>
          </div>

          {functions.length > 0 && (
            <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Functions</h4>
              <div className="space-y-1">
                {functions.map((fn, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm font-mono">
                    <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-xs">
                      {fn.visibility}
                    </span>
                    <span className="text-gray-900 dark:text-white">{fn.name}()</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {events.length > 0 && (
            <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Events</h4>
              <div className="space-y-1">
                {events.map((event, i) => (
                  <div key={i} className="text-sm font-mono text-orange-600 dark:text-orange-400">
                    📣 {event}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              💡 Use the Compile button to compile this contract and deploy it to a testnet!
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Render unsupported preview
  const renderUnsupportedPreview = () => (
    <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-800">
      <div className="text-center p-8">
        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Preview Not Available
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Live preview is not supported for {language} files.
        </p>
      </div>
    </div>
  );

  // Main preview renderer
  const renderPreview = () => {
    switch (previewType) {
      case 'html':
        return (
          <iframe
            ref={iframeRef}
            title={title}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin allow-modals"
          />
        );
      case 'react':
        return renderReactPreview();
      case 'vue':
        return renderVuePreview();
      case 'python':
        return renderPythonPreview();
      case 'solidity':
        return renderSolidityPreview();
      default:
        return renderUnsupportedPreview();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
            {title}
            <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs rounded-full">
              {previewType === 'html' ? 'HTML/JS' : 
               previewType === 'react' ? 'React' :
               previewType === 'vue' ? 'Vue' :
               previewType === 'python' ? 'Python' :
               previewType === 'solidity' ? 'Solidity' : 'Preview'}
            </span>
          </h3>

          {/* Viewport Buttons */}
          {previewType === 'html' && (
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
          )}
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

          {allowFullscreen && previewType === 'html' && (
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
      <div className="flex-1 bg-gray-100 dark:bg-gray-950 flex items-center justify-center overflow-hidden">
        {error && previewType !== 'python' ? (
          <div className="flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200 m-4">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="font-medium">Preview Error</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        ) : (
          <div
            className="bg-white shadow-lg transition-all duration-300 h-full overflow-hidden"
            style={{
              width: previewType === 'html' ? viewportSizes[viewport].width : '100%',
              maxWidth: '100%'
            }}
          >
            {renderPreview()}
          </div>
        )}
      </div>
    </div>
  );
}
