import React, { useState, useCallback } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import oneDark from 'react-syntax-highlighter/dist/esm/styles/prism/one-dark';
import { Copy, Check } from 'lucide-react';
import { cn } from '../../lib/utils';

const LIGHT_ON_DARK = '#e5e7eb';
const LIGHT_MUTED = '#9ca3af';
const LIGHT_ACCENT = '#93c5fd';
const LIGHT_STRING = '#86efac';
const LIGHT_KEYWORD = '#c4b5fd';
const LIGHT_NUMBER = '#fcd34d';

const codeBlockStyle: Record<string, React.CSSProperties> = {
  ...oneDark,
  'code[class*="language-"]': {
    ...(oneDark as Record<string, React.CSSProperties>)['code[class*="language-"]'],
    color: LIGHT_ON_DARK,
  },
  'pre[class*="language-"]': {
    ...(oneDark as Record<string, React.CSSProperties>)['pre[class*="language-"]'],
    color: LIGHT_ON_DARK,
  },
  comment: { color: LIGHT_MUTED, fontStyle: 'italic' },
  prolog: { color: LIGHT_MUTED },
  cdata: { color: LIGHT_MUTED },
  punctuation: { color: LIGHT_ON_DARK },
  variable: { color: LIGHT_ACCENT },
  parameter: { color: LIGHT_ACCENT },
  operator: { color: LIGHT_ACCENT },
  function: { color: LIGHT_ACCENT },
  property: { color: '#f9a8d4' },
  atrule: { color: LIGHT_NUMBER },
  keyword: { color: LIGHT_KEYWORD },
  string: { color: LIGHT_STRING },
  number: { color: LIGHT_NUMBER },
  boolean: { color: LIGHT_NUMBER },
  'class-name': { color: LIGHT_NUMBER },
  constant: { color: LIGHT_NUMBER },
  tag: { color: '#f9a8d4' },
  symbol: { color: LIGHT_ACCENT },
  selector: { color: LIGHT_STRING },
  'attr-name': { color: LIGHT_NUMBER },
  'attr-value': { color: LIGHT_STRING },
  regex: { color: LIGHT_STRING },
  inserted: { color: LIGHT_STRING },
  deleted: { color: '#f87171' },
  namespace: { color: LIGHT_MUTED, opacity: 0.8 },
  builtin: { color: LIGHT_ACCENT },
  entity: { color: LIGHT_ON_DARK },
  url: { color: LIGHT_ACCENT },
  doctype: { color: LIGHT_MUTED },
  important: { color: '#f87171' },
  bold: { fontWeight: 'bold' },
  italic: { fontStyle: 'italic' },
};

const LANG_LABELS: Record<string, string> = {
  js: 'JavaScript',
  javascript: 'JavaScript',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  py: 'Python',
  python: 'Python',
  json: 'JSON',
  bash: 'Bash',
  sh: 'Shell',
  html: 'HTML',
  css: 'CSS',
  jsx: 'JSX',
  tsx: 'TSX',
};

function getLangLabel(lang: string): string {
  return (LANG_LABELS[lang.toLowerCase()] ?? lang) || 'Code';
}

interface CodeBlockProps {
  code: string;
  lang: string;
}

export function CodeBlock({ code, lang }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [code]);

  const label = getLangLabel(lang);

  return (
    <div className="my-3 rounded-lg overflow-hidden border border-neutral-700 bg-neutral-900">
      <div className="flex items-center justify-between px-3 py-1.5 bg-neutral-800 dark:bg-neutral-800/90 border-b border-neutral-700 text-neutral-400 text-xs">
        <span className="font-medium text-neutral-300 dark:text-neutral-400">{label}</span>
        <button
          type="button"
          onClick={handleCopy}
          className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded hover:bg-neutral-700 dark:hover:bg-neutral-600 text-neutral-400 hover:text-neutral-200 transition-colors",
            copied && "text-emerald-400"
          )}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          <span>{copied ? '已复制' : '复制'}</span>
        </button>
      </div>
      <SyntaxHighlighter
        language={lang || 'text'}
        style={codeBlockStyle}
        customStyle={{
          margin: 0,
          padding: '1rem 1rem 1rem 1.25rem',
          fontSize: '0.8125rem',
          lineHeight: 1.6,
          background: 'transparent',
        }}
        codeTagProps={{ style: { fontFamily: 'ui-monospace, monospace' } }}
        showLineNumbers={false}
        PreTag="div"
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
