/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Building bridges to a better tomorrow 🌉
 */

import { useState, useEffect } from 'react';
import { Play, RefreshCw, ExternalLink } from 'lucide-react';

interface LivePreviewProps {
  code: string;
  language: string;
  output?: string;
}

export default function LivePreview({ code, language, output }: LivePreviewProps) {
  const [previewContent, setPreviewContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Auto-render for HTML/JavaScript
    if (language === 'javascript' || language === 'html') {
      renderPreview();
    }
  }, [code, language]);

  const renderPreview = () => {
    setError(null);

    try {
      if (language === 'html') {
        setPreviewContent(code);
      } else if (language === 'javascript' || language === 'typescript') {
        // Create a safe preview for JS/TS code
        const wrappedCode = `
          <html>
            <head>
              <style>
                body { 
                  font-family: system-ui, -apple-system, sans-serif; 
                  padding: 20px;
                  background: white;
                }
                pre { 
                  background: #f3f4f6; 
                  padding: 10px; 
                  border-radius: 6px;
                  overflow-x: auto;
                }
              </style>
            </head>
            <body>
              <div id="output"></div>
              <script>
                // Capture console.log
                const outputDiv = document.getElementById('output');
                const originalLog = console.log;
                console.log = (...args) => {
                  const message = args.map(arg => 
                    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                  ).join(' ');
                  const p = document.createElement('pre');
                  p.textContent = message;
                  outputDiv.appendChild(p);
                  originalLog(...args);
                };

                try {
                  ${code}
                } catch (error) {
                  console.log('Error: ' + error.message);
                }
              </script>
            </body>
          </html>
        `;
        setPreviewContent(wrappedCode);
      } else if (language === 'react') {
        // For React, show a message that it needs to be compiled
        setPreviewContent(`
          <html>
            <body style="font-family: system-ui; padding: 20px; background: #f9fafb;">
              <div style="background: white; border: 2px dashed #e5e7eb; border-radius: 8px; padding: 30px; text-align: center;">
                <h3 style="color: #374151; margin-bottom: 10px;">⚛️ React Component</h3>
                <p style="color: #6b7280;">This React component needs to be compiled and bundled to preview.</p>
                <p style="color: #9ca3af; font-size: 14px; margin-top: 10px;">Use the "Run Code" button to see the output in the console.</p>
              </div>
            </body>
          </html>
        `);
      } else if (language === 'solidity') {
        // For Solidity, show contract structure
        setPreviewContent(`
          <html>
            <body style="font-family: system-ui; padding: 20px; background: #f9fafb;">
              <div style="background: white; border: 2px solid #8b5cf6; border-radius: 8px; padding: 30px;">
                <h3 style="color: #7c3aed; margin-bottom: 15px;">⚡ Smart Contract</h3>
                <div style="color: #374151; line-height: 1.6;">
                  <p><strong>Language:</strong> Solidity</p>
                  <p style="margin-top: 10px;"><strong>Next Steps:</strong></p>
                  <ul style="margin-left: 20px; color: #6b7280;">
                    <li>Compile the contract</li>
                    <li>Deploy to a test network</li>
                    <li>Interact with deployed contract</li>
                  </ul>
                  <div style="margin-top: 20px; padding: 15px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
                    <p style="color: #92400e; margin: 0; font-size: 14px;">
                      💡 <strong>Tip:</strong> Use the "Compile" and "Deploy" buttons in the toolbar to test this contract on a blockchain.
                    </p>
                  </div>
                </div>
              </div>
            </body>
          </html>
        `);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRefresh = () => {
    renderPreview();
  };

  const handleOpenInNewTab = () => {
    const newWindow = window.open();
    if (newWindow) {
      newWindow.document.write(previewContent);
      newWindow.document.close();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Preview Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
          <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Live Preview</span>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={handleRefresh}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            title="Refresh preview"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleOpenInNewTab}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            title="Open in new tab"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Preview Content */}
      <div className="flex-1 overflow-hidden bg-white">
        {error ? (
          <div className="p-6">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <h3 className="text-red-800 dark:text-red-200 font-semibold mb-2">
                ❌ Preview Error
              </h3>
              <pre className="text-sm text-red-700 dark:text-red-300 whitespace-pre-wrap">
                {error}
              </pre>
            </div>
          </div>
        ) : output ? (
          <div className="p-6">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 font-mono text-sm">
              <pre className="whitespace-pre-wrap text-gray-800 dark:text-gray-200">
                {output}
              </pre>
            </div>
          </div>
        ) : previewContent ? (
          <iframe
            srcDoc={previewContent}
            className="w-full h-full border-0"
            sandbox="allow-scripts"
            title="Live Preview"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-600">
            <div className="text-center">
              <Play className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">Run code to see live preview</p>
              <p className="text-sm mt-2">Your output will appear here</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
