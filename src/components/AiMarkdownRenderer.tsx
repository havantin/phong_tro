import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

interface AiMarkdownRendererProps {
  content: string;
  className?: string;
}

export const AiMarkdownRenderer: React.FC<AiMarkdownRendererProps> = ({ content, className = '' }) => {
  return (
    <div className={`ai-markdown-content text-slate-800 leading-relaxed ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          p: ({ node, ...props }) => (
            <p className="mb-2 last:mb-0 leading-relaxed text-xs sm:text-sm" {...props} />
          ),
          strong: ({ node, ...props }) => (
            <strong className="font-bold text-slate-900" {...props} />
          ),
          em: ({ node, ...props }) => (
            <em className="italic text-slate-800" {...props} />
          ),
          h1: ({ node, ...props }) => (
            <h1 className="text-sm sm:text-base font-extrabold text-purple-950 mt-3 mb-1.5 border-b border-purple-100 pb-1" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="text-xs sm:text-sm font-extrabold text-purple-900 mt-2.5 mb-1" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="text-xs sm:text-sm font-bold text-purple-800 mt-2 mb-1" {...props} />
          ),
          ul: ({ node, ...props }) => (
            <ul className="my-2 ml-4 list-disc space-y-1 text-slate-700 text-xs sm:text-sm" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="my-2 ml-4 list-decimal space-y-1 text-slate-700 font-medium text-xs sm:text-sm" {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className="leading-relaxed pl-0.5" {...props} />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote className="my-2 border-l-3 border-purple-500 bg-purple-50/70 pl-3 py-1.5 italic text-slate-700 rounded-r-lg text-xs sm:text-sm" {...props} />
          ),
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-3 rounded-xl border border-purple-200/90 shadow-2xs">
              <table className="min-w-full divide-y divide-purple-200 text-[11px] sm:text-xs" {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => (
            <thead className="bg-purple-100/80 text-purple-950 font-bold" {...props} />
          ),
          tbody: ({ node, ...props }) => (
            <tbody className="divide-y divide-purple-100 bg-white" {...props} />
          ),
          tr: ({ node, ...props }) => (
            <tr className="hover:bg-purple-50/50 transition-colors" {...props} />
          ),
          th: ({ node, ...props }) => (
            <th className="px-3 py-2 text-left font-bold text-purple-900" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="px-3 py-2 text-slate-700" {...props} />
          ),
          hr: ({ node, ...props }) => (
            <hr className="my-3 border-t border-purple-200/70" {...props} />
          ),
          code: ({ node, ...props }) => (
            <code className="bg-purple-50 text-purple-700 border border-purple-200/80 px-1.5 py-0.5 rounded text-[11px] font-mono" {...props} />
          ),
          a: ({ node, ...props }) => (
            <a className="text-purple-600 hover:text-purple-800 underline font-semibold transition" target="_blank" rel="noopener noreferrer" {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

