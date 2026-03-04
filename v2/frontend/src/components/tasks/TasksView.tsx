import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { ScheduledTask } from '../../types';
import { format } from 'date-fns';
import { Clock, Play, Pause, Edit2, Trash2, Plus, CheckCircle, XCircle } from 'lucide-react';

export function TasksView() {
  const [tasks, setTasks] = useState<ScheduledTask[]>([
    { id: '1', name: 'Daily Summary', type: 'agent_command', interval: 1440, enabled: true, lastRun: new Date(Date.now() - 1000 * 60 * 60 * 12) },
    { id: '2', name: 'System Heartbeat', type: 'heartbeat', interval: 5, enabled: true, lastRun: new Date(Date.now() - 1000 * 60 * 2) },
    { id: '3', name: 'Cleanup Logs', type: 'agent_command', interval: 60, enabled: false },
  ]);

  const toggleTask = (id: string) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, enabled: !t.enabled } : t));
  };

  const deleteTask = (id: string) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  return (
    <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-950 p-8 transition-colors duration-300">
      <div className="max-w-5xl mx-auto w-full">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Scheduled Tasks</h2>
            <p className="text-zinc-500 text-sm">Manage automated agent routines and system jobs.</p>
          </div>
          <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition-colors shadow-lg shadow-indigo-500/20 dark:shadow-indigo-900/20">
            <Plus size={18} />
            <span>New Task</span>
          </button>
        </div>

        {/* Task Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tasks.map((task) => (
            <div 
              key={task.id} 
              className={cn(
                "bg-white dark:bg-zinc-900 border rounded-xl p-5 transition-all hover:shadow-lg group relative overflow-hidden",
                task.enabled 
                  ? "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700" 
                  : "border-zinc-100 dark:border-zinc-800/50 opacity-70"
              )}
            >
              {/* Status Indicator Stripe */}
              <div className={cn(
                "absolute top-0 left-0 w-1 h-full",
                task.enabled ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"
              )} />

              <div className="flex justify-between items-start mb-4 pl-2">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center",
                    task.enabled 
                      ? "bg-zinc-100 dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400" 
                      : "bg-zinc-100 dark:bg-zinc-800/50 text-zinc-400 dark:text-zinc-600"
                  )}>
                    <Clock size={20} />
                  </div>
                  <div>
                    <h3 className="font-medium text-zinc-900 dark:text-zinc-200">{task.name}</h3>
                    <span className="text-xs text-zinc-500 uppercase tracking-wider">{task.type.replace('_', ' ')}</span>
                  </div>
                </div>
                
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">
                    <Edit2 size={14} />
                  </button>
                  <button 
                    onClick={() => deleteTask(task.id)}
                    className="p-1.5 text-zinc-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="space-y-3 pl-2">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Interval</span>
                  <span className="text-zinc-700 dark:text-zinc-300 font-mono">{task.interval} min</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Last Run</span>
                  <span className="text-zinc-700 dark:text-zinc-300">
                    {task.lastRun ? format(task.lastRun, 'MMM d, HH:mm') : 'Never'}
                  </span>
                </div>
              </div>

              <div className="mt-6 pl-2 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                <span className={cn(
                  "text-xs flex items-center gap-1.5",
                  task.enabled ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400 dark:text-zinc-500"
                )}>
                  {task.enabled ? <CheckCircle size={12} /> : <XCircle size={12} />}
                  {task.enabled ? "Active" : "Disabled"}
                </span>

                <button 
                  onClick={() => toggleTask(task.id)}
                  className={cn(
                    "px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors",
                    task.enabled 
                      ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-200" 
                      : "bg-emerald-100 dark:bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-600/20"
                  )}
                >
                  {task.enabled ? (
                    <>
                      <Pause size={12} /> Disable
                    </>
                  ) : (
                    <>
                      <Play size={12} /> Enable
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
