/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Speak every language, build every dream
 */

import { useState } from 'react';
import Editor from '@monaco-editor/react';
import { Copy, CheckCircle } from 'lucide-react';
import { useThemeStore } from '@/stores/themeStore';
import { copyToClipboard } from '@/utils/helpers';

export interface LanguageTab {
  id: string;
  label: string;
  language: string;
  code: string;
  icon?: React.ReactNode;
}

interface MultiLanguageTabsProps {
  tabs: LanguageTab[];
  defaultTab?: string;
  onCodeChange?: (tabId: string, code: string) => void;
  readOnly?: boolean;
  height?: string;
}

export default function MultiLanguageTabs({
  tabs,
  defaultTab,
  onCodeChange,
  readOnly = false,
  height = '500px'
}: MultiLanguageTabsProps) {
  const { mode } = useThemeStore();
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);
  const [copied, setCopied] = useState<string | null>(null);

  const activeTabData = tabs.find(t => t.id === activeTab);

  const handleCopy = async (tabId: string, code: string) => {
    await copyToClipboard(code);
    setCopied(tabId);
    setTimeout(() => setCopied(null), 2000);
  };

  const getLanguageIcon = (language: string) => {
    switch (language) {
      case 'solidity':
        return '◆';
      case 'typescript':
      case 'javascript':
        return '⚡';
      case 'html':
        return '🌐';
      case 'css':
        return '🎨';
      case 'json':
        return '{}';
      default:
        return '📄';
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Tab Headers */}
      <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-2">
        <div className="flex items-center overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap
                transition-colors relative
                ${activeTab === tab.id
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }
              `}
            >
              {tab.icon || <span className="text-lg">{getLanguageIcon(tab.language)}</span>}
              <span>{tab.label}</span>
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 dark:bg-primary-400" />
              )}
            </button>
          ))}
        </div>

        {/* Copy Button */}
        {activeTabData && (
          <button
            onClick={() => handleCopy(activeTabData.id, activeTabData.code)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
            title="Copy code"
          >
            {copied === activeTabData.id ? (
              <>
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-green-600">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copy</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        {activeTabData && (
          <Editor
            height={height}
            language={activeTabData.language}
            value={activeTabData.code}
            onChange={(value) => {
              if (value && onCodeChange && !readOnly) {
                onCodeChange(activeTabData.id, value);
              }
            }}
            theme={mode === 'dark' ? 'vs-dark' : 'light'}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: 'on',
              readOnly,
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              automaticLayout: true,
              padding: { top: 16, bottom: 16 },
              renderWhitespace: 'selection',
              bracketPairColorization: { enabled: true },
              guides: {
                bracketPairs: true,
                indentation: true,
              },
            }}
          />
        )}
      </div>
    </div>
  );
}
