'use client';

import { useCopyFeedback } from '@/components/use-copy-feedback';

export function SnippetCard({
  snippet,
  title,
  badge,
}: {
  snippet: string;
  title: string;
  badge?: string;
}) {
  const { copied, copyValue } = useCopyFeedback();

  return (
    <article className="group rounded-2xl border border-zinc-800/80 bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 p-6 backdrop-blur-sm transition hover:border-zinc-700">
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-zinc-100">{title}</span>
          {badge ? (
            <span className="rounded-full border border-blue-500/50 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-400">
              {badge}
            </span>
          ) : null}
        </div>
        <button
          onClick={() => copyValue(snippet)}
          className="rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800 hover:text-zinc-100"
        >
          {copied ? '✓ Copied!' : 'Copy'}
        </button>
      </header>
      <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border border-zinc-800/50 bg-zinc-950/80 p-4 font-mono text-xs leading-relaxed text-zinc-300 shadow-inner">
        {snippet}
      </pre>
    </article>
  );
}
