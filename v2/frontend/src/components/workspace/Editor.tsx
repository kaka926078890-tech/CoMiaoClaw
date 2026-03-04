import React, { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { FileNode } from '../../types';
import ReactMarkdown from 'react-markdown';
import { Save, Eye, Edit3, XCircle } from 'lucide-react';

interface EditorProps {
  file?: FileNode;
  onSave: (content: string) => void;
}

export function Editor({ file, onSave }: EditorProps) {
  const [content, setContent] = useState('');
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (file) {
      setContent(file.content || '');
      setIsDirty(false);
      setMode('edit');
    }
  }, [file]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    setIsDirty(true);
  };

  const handleSave = () => {
    onSave(content);
    setIsDirty(false);
  };

  if (!file) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-500 bg-zinc-50/50 dark:bg-zinc-950/50 transition-colors duration-300">
        <div className="w-16 h-16 bg-white dark:bg-zinc-900 rounded-full flex items-center justify-center mb-4 border border-zinc-200 dark:border-zinc-800">
          <Edit3 size={24} />
        </div>
        <p>Select a file to edit</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 transition-colors duration-300">
      {/* Toolbar */}
      <div className="h-10 flex items-center justify-between px-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 transition-colors duration-300">
        <div className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 font-mono">
          <span>{file.name}</span>
          {isDirty && <span className="w-2 h-2 rounded-full bg-amber-500" title="Unsaved changes" />}
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded p-0.5 border border-zinc-200 dark:border-zinc-700 transition-colors duration-300">
            <button 
              onClick={() => setMode('edit')}
              className={cn(
                "px-2 py-1 text-xs rounded transition-colors flex items-center gap-1",
                mode === 'edit' 
                  ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm" 
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              )}
            >
              <Edit3 size={12} /> Edit
            </button>
            <button 
              onClick={() => setMode('preview')}
              className={cn(
                "px-2 py-1 text-xs rounded transition-colors flex items-center gap-1",
                mode === 'preview' 
                  ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm" 
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              )}
            >
              <Eye size={12} /> Preview
            </button>
          </div>

          <button 
            onClick={handleSave}
            disabled={!isDirty}
            className="p-1.5 text-zinc-400 hover:text-emerald-500 dark:hover:text-emerald-400 disabled:opacity-30 disabled:hover:text-zinc-400 transition-colors"
            title="Save (Ctrl+S)"
          >
            <Save size={16} />
          </button>
        </div>
      </div>

      {/* Editor / Preview Area */}
      <div className="flex-1 overflow-hidden relative">
        {mode === 'edit' ? (
          <textarea
            value={content}
            onChange={handleChange}
            className="w-full h-full bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-300 font-mono text-sm p-4 resize-none focus:outline-none leading-relaxed transition-colors duration-300"
            spellCheck={false}
          />
        ) : (
          <div className="w-full h-full bg-zinc-50 dark:bg-zinc-950 p-8 overflow-y-auto prose prose-zinc dark:prose-invert prose-sm max-w-none transition-colors duration-300">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
