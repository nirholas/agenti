/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Your code has the power to change the world 🌍
 */

import { useState } from 'react';
import { MessageSquare, X, ChevronDown, ChevronUp, Info } from 'lucide-react';

export interface CodeAnnotation {
  lineStart: number;
  lineEnd?: number;
  type: 'info' | 'warning' | 'tip' | 'concept';
  title: string;
  content: string;
  code?: string;
}

interface InlineAnnotationsProps {
  annotations: CodeAnnotation[];
  lineHeight?: number;
  codeLines: string[];
}

export default function InlineAnnotations({
  annotations,
  lineHeight = 19,
  codeLines
}: InlineAnnotationsProps) {
  const [expandedAnnotations, setExpandedAnnotations] = useState<Set<number>>(new Set());

  const toggleAnnotation = (index: number) => {
    const newExpanded = new Set(expandedAnnotations);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedAnnotations(newExpanded);
  };

  const getAnnotationColor = (type: CodeAnnotation['type']) => {
    switch (type) {
      case 'info':
        return {
          bg: 'bg-blue-50 dark:bg-blue-900/20',
          border: 'border-blue-200 dark:border-blue-800',
          text: 'text-blue-700 dark:text-blue-300',
          badge: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
        };
      case 'warning':
        return {
          bg: 'bg-yellow-50 dark:bg-yellow-900/20',
          border: 'border-yellow-200 dark:border-yellow-800',
          text: 'text-yellow-700 dark:text-yellow-300',
          badge: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300'
        };
      case 'tip':
        return {
          bg: 'bg-green-50 dark:bg-green-900/20',
          border: 'border-green-200 dark:border-green-800',
          text: 'text-green-700 dark:text-green-300',
          badge: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
        };
      case 'concept':
        return {
          bg: 'bg-purple-50 dark:bg-purple-900/20',
          border: 'border-purple-200 dark:border-purple-800',
          text: 'text-purple-700 dark:text-purple-300',
          badge: 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300'
        };
    }
  };

  return (
    <div className="absolute right-0 top-0 w-80 h-full pointer-events-none z-10">
      <div className="relative h-full">
        {annotations.map((annotation, index) => {
          const colors = getAnnotationColor(annotation.type);
          const isExpanded = expandedAnnotations.has(index);
          const topPosition = (annotation.lineStart - 1) * lineHeight;

          return (
            <div
              key={index}
              className="absolute right-4 pointer-events-auto"
              style={{ top: `${topPosition}px` }}
            >
              <div
                className={`
                  border-2 rounded-lg shadow-lg transition-all
                  ${colors.bg} ${colors.border}
                  ${isExpanded ? 'w-80' : 'w-12'}
                `}
              >
                {!isExpanded ? (
                  <button
                    onClick={() => toggleAnnotation(index)}
                    className={`
                      w-12 h-12 flex items-center justify-center
                      ${colors.badge}
                      rounded-lg transition-colors
                      hover:opacity-80
                    `}
                    title={annotation.title}
                  >
                    <MessageSquare className="w-5 h-5" />
                  </button>
                ) : (
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${colors.badge}`}>
                          {annotation.type.toUpperCase()}
                        </span>
                        <h4 className={`text-sm font-semibold ${colors.text}`}>
                          {annotation.title}
                        </h4>
                      </div>
                      <button
                        onClick={() => toggleAnnotation(index)}
                        className={`p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 ${colors.text}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                      {annotation.content}
                    </p>

                    {annotation.code && (
                      <div className="bg-gray-900 dark:bg-black rounded p-3 overflow-x-auto">
                        <pre className="text-xs text-gray-100 font-mono">
                          <code>{annotation.code}</code>
                        </pre>
                      </div>
                    )}

                    <div className="mt-2 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <Info className="w-3 h-3" />
                      <span>
                        Line {annotation.lineStart}
                        {annotation.lineEnd && annotation.lineEnd !== annotation.lineStart && 
                          ` - ${annotation.lineEnd}`
                        }
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Sidebar Panel Version
export function AnnotationsPanel({ annotations }: { annotations: CodeAnnotation[] }) {
  const [expandedAnnotations, setExpandedAnnotations] = useState<Set<number>>(new Set([0]));

  const toggleAnnotation = (index: number) => {
    const newExpanded = new Set(expandedAnnotations);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedAnnotations(newExpanded);
  };

  const getAnnotationColor = (type: CodeAnnotation['type']) => {
    switch (type) {
      case 'info':
        return {
          icon: '💡',
          badge: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
        };
      case 'warning':
        return {
          icon: '⚠️',
          badge: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300'
        };
      case 'tip':
        return {
          icon: '✨',
          badge: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
        };
      case 'concept':
        return {
          icon: '📚',
          badge: 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300'
        };
    }
  };

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
        Code Explanations
      </h3>
      {annotations.map((annotation, index) => {
        const colors = getAnnotationColor(annotation.type);
        const isExpanded = expandedAnnotations.has(index);

        return (
          <div
            key={index}
            className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800"
          >
            <button
              onClick={() => toggleAnnotation(index)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{colors.icon}</span>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                      {annotation.title}
                    </h4>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${colors.badge}`}>
                      Line {annotation.lineStart}
                    </span>
                  </div>
                </div>
              </div>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </button>

            {isExpanded && (
              <div className="px-4 pb-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  {annotation.content}
                </p>
                {annotation.code && (
                  <div className="bg-gray-900 dark:bg-black rounded p-3 overflow-x-auto">
                    <pre className="text-xs text-gray-100 font-mono">
                      <code>{annotation.code}</code>
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
