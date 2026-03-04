import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { LogEntry } from '../../types';
import { format } from 'date-fns';
import { AlertCircle, Info, AlertTriangle, Search, Filter, Trash2 } from 'lucide-react';

export function ConsoleView() {
  const [logs, setLogs] = useState<LogEntry[]>([
    { id: '1', timestamp: new Date(Date.now() - 1000 * 60 * 5), level: 'info', source: 'system', message: 'System initialized successfully.' },
    { id: '2', timestamp: new Date(Date.now() - 1000 * 60 * 4), level: 'info', source: 'agent', message: 'Agent "Researcher" started.' },
    { id: '3', timestamp: new Date(Date.now() - 1000 * 60 * 3), level: 'warn', source: 'tool', message: 'Web search returned empty results for query "quantum physics".' },
    { id: '4', timestamp: new Date(Date.now() - 1000 * 60 * 2), level: 'error', source: 'system', message: 'Connection timeout to vector database.' },
    { id: '5', timestamp: new Date(Date.now() - 1000 * 60 * 1), level: 'info', source: 'agent', message: 'Retrying search with refined query.' },
  ]);

  const [filter, setFilter] = useState<'all' | 'info' | 'warn' | 'error'>('all');
  const [search, setSearch] = useState('');

  const filteredLogs = logs.filter(log => {
    if (filter !== 'all' && log.level !== filter) return false;
    if (search && !log.message.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const clearLogs = () => setLogs([]);

  return (
    <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-300 font-mono text-xs transition-colors duration-300">
      {/* Toolbar */}
      <div className="h-12 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-4 bg-white dark:bg-zinc-900/50 transition-colors duration-300">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
            <input 
              type="text" 
              placeholder="Search logs..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md pl-8 pr-3 py-1.5 w-64 focus:outline-none focus:border-indigo-500 text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 transition-colors duration-300"
            />
          </div>
          
          <div className="flex bg-zinc-100 dark:bg-zinc-900 rounded-md p-0.5 border border-zinc-200 dark:border-zinc-700 transition-colors duration-300">
            {(['all', 'info', 'warn', 'error'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-1 rounded capitalize transition-colors",
                  filter === f 
                    ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm" 
                    : "text-zinc-500 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <button 
          onClick={clearLogs}
          className="flex items-center gap-1.5 text-zinc-500 hover:text-red-500 dark:hover:text-red-400 transition-colors px-3 py-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900"
        >
          <Trash2 size={14} />
          <span>Clear</span>
        </button>
      </div>

      {/* Logs List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {filteredLogs.length === 0 ? (
          <div className="text-center text-zinc-500 dark:text-zinc-600 mt-20">No logs found.</div>
        ) : (
          filteredLogs.map((log) => (
            <div key={log.id} className="flex gap-3 hover:bg-zinc-100 dark:hover:bg-zinc-900/50 p-1 rounded -mx-2 px-2 group transition-colors">
              <span className="text-zinc-500 dark:text-zinc-600 shrink-0 w-20">
                {format(log.timestamp, 'HH:mm:ss')}
              </span>
              
              <span className={cn(
                "uppercase font-bold w-16 shrink-0 text-[10px] py-0.5 px-1.5 rounded text-center h-fit mt-0.5",
                log.level === 'info' ? "bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400" :
                log.level === 'warn' ? "bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400" :
                "bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400"
              )}>
                {log.level}
              </span>

              <span className="text-zinc-500 w-20 shrink-0 truncate" title={log.source}>
                [{log.source}]
              </span>

              <span className="text-zinc-800 dark:text-zinc-300 break-all">
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
