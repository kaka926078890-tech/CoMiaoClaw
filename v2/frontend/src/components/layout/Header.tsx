import React from 'react';
import { cn } from '../../lib/utils';
import { Bot, Cpu, Sun, Moon } from 'lucide-react';

const MODEL_LABELS: Record<string, string> = {
  'deepseek-chat': 'DeepSeek Chat',
  'deepseek-reasoner': 'DeepSeek Reasoner',
};

function modelLabel(id: string): string {
  return MODEL_LABELS[id] ?? id;
}

interface HeaderProps {
  title: string;
  model: string;
  setModel: (model: string) => void;
  models: string[];
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export function Header({ title, model, setModel, models, theme, toggleTheme }: HeaderProps) {
  return (
    <header className="h-14 bg-white/80 dark:bg-neutral-900/50 backdrop-blur-sm border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between px-6 sticky top-0 z-10 transition-colors duration-300">
      <div className="flex items-center gap-3">
        <Bot className="text-neutral-900 dark:text-neutral-100" size={20} />
        <h1 className="font-semibold text-neutral-900 dark:text-neutral-100">{title}</h1>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg px-3 py-1.5 border border-neutral-200 dark:border-neutral-700 transition-colors duration-300">
          <Cpu size={14} className="text-neutral-500 dark:text-neutral-400" />
          <select 
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="bg-transparent text-sm text-neutral-700 dark:text-neutral-200 focus:outline-none cursor-pointer"
          >
            {models.map((m) => (
              <option key={m} value={m}>{modelLabel(m)}</option>
            ))}
          </select>
        </div>

        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:text-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
      </div>
    </header>
  );
}
