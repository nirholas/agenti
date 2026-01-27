/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Embrace the bugs, they make you stronger 🦋
 */

import { useState } from 'react';
import { Check, Globe2, ChevronDown } from 'lucide-react';
import useI18n, { languages } from '@/stores/i18nStore';

interface Props {
  compact?: boolean;
}

export default function LanguageSelector({ compact = false }: Props) {
  const { language, setLanguage } = useI18n();
  const [open, setOpen] = useState(false);
  const active = languages.find(l => l.code === language);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center space-x-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${compact ? 'text-sm' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Globe2 className="w-4 h-4" />
        <span className="font-medium">{active?.flag} {active?.nativeName || active?.name}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50">
          <div className="max-h-64 overflow-auto py-1" role="listbox">
            {languages.map(lang => (
              <button
                key={lang.code}
                onClick={() => {
                  setLanguage(lang.code);
                  setOpen(false);
                }}
                className={`w-full text-left px-4 py-2 flex items-center space-x-3 hover:bg-gray-100 dark:hover:bg-gray-800 ${lang.code === language ? 'bg-gray-50 dark:bg-gray-800' : ''}`}
                role="option"
                aria-selected={lang.code === language}
              >
                <span className="text-lg">{lang.flag}</span>
                <div className="flex-1">
                  <div className="font-semibold">{lang.nativeName}</div>
                  <div className="text-xs text-gray-500">{lang.name}</div>
                </div>
                {lang.code === language && <Check className="w-4 h-4 text-green-500" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
