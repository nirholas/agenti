import { codeToHtml } from 'shiki';

interface CodeBlockProps {
  code: string;
  lang?: string;
  filename?: string;
}

export async function CodeBlock({ code, lang = 'typescript', filename }: CodeBlockProps) {
  const html = await codeToHtml(code, {
    lang,
    theme: 'github-dark',
  });

  return (
    <div className="rounded-xl bg-[#0d1117] border border-border/50 overflow-hidden">
      {filename && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 bg-[#161b22]">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-[#27ca40]"></div>
          </div>
          <span className="text-xs text-muted-foreground ml-2">{filename}</span>
        </div>
      )}
      <div 
        className="p-4 text-sm overflow-x-auto [&_pre]:!bg-transparent [&_pre]:!m-0 [&_code]:!bg-transparent"
        dangerouslySetInnerHTML={{ __html: html }} 
      />
    </div>
  );
}

