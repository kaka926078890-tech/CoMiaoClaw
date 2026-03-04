import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { 
  MessageSquare, 
  History, 
  FolderTree, 
  Terminal, 
  Clock, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  Plus
} from 'lucide-react';

interface SidebarProps {
  activeView: string;
  setActiveView: (view: string) => void;
  isCollapsed: boolean;
  toggleCollapse: () => void;
  onSelectChat?: (chatId: string) => void;
  onNewChat?: () => void;
}

export function Sidebar({ activeView, setActiveView, isCollapsed, toggleCollapse, onSelectChat, onNewChat }: SidebarProps) {
  const navItems = [
    { id: 'chat', label: 'New Chat', icon: Plus, action: 'new_chat' },
    { id: 'history', label: 'History', icon: History, view: 'history' },
    { id: 'workspace', label: 'Workspace', icon: FolderTree, view: 'workspace' },
    { id: 'console', label: 'Console Logs', icon: Terminal, view: 'console' },
    { id: 'tasks', label: 'Scheduled Tasks', icon: Clock, view: 'tasks' },
  ];

  // Mock chat history for the list
  const chatHistory = [
    { id: '1', title: 'Refactoring Agent', date: '2 mins ago' },
    { id: '2', title: 'Debug Session #42', date: '1 hour ago' },
    { id: '3', title: 'Feature Planning', date: 'Yesterday' },
  ];

  return (
    <div 
      className={cn(
        "h-screen bg-neutral-50 dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 flex flex-col transition-all duration-300 ease-in-out",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header / Toggle */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-neutral-200 dark:border-neutral-800">
        {!isCollapsed && <span className="font-bold text-neutral-900 dark:text-neutral-100 tracking-tight font-mono">CLAW</span>}
        <button 
          onClick={toggleCollapse}
          className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-md text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 transition-colors"
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Main Nav */}
      <div className="flex-1 overflow-y-auto py-4 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              if (item.action === 'new_chat') {
                onNewChat?.();
              } else if (item.view) {
                setActiveView(item.view);
              }
            }}
            className={cn(
              "w-full flex items-center px-4 py-2 text-sm font-medium transition-colors border-l-2",
              activeView === item.view && !item.action
                ? "bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border-neutral-900 dark:border-neutral-100" 
                : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800/50 hover:text-neutral-900 dark:hover:text-neutral-200 border-transparent"
            )}
            title={isCollapsed ? item.label : undefined}
          >
            <item.icon size={18} className={cn("shrink-0", !isCollapsed && "mr-3")} />
            {!isCollapsed && <span>{item.label}</span>}
          </button>
        ))}

        {/* Chat History List (Only if not collapsed) */}
        {!isCollapsed && (
          <div className="mt-8 px-4">
            <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-500 uppercase tracking-wider mb-2 font-mono">Recent Chats</h3>
            <div className="space-y-1">
              {chatHistory.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => onSelectChat?.(chat.id)}
                  className="w-full text-left px-2 py-1.5 text-sm text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded truncate transition-colors"
                >
                  {chat.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* User / Settings Footer */}
      <div className="p-4 border-t border-neutral-200 dark:border-neutral-800">
        <button className="w-full flex items-center text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors">
          <Settings size={18} className={cn("shrink-0", !isCollapsed && "mr-3")} />
          {!isCollapsed && <span className="text-sm font-medium">Settings</span>}
        </button>
      </div>
    </div>
  );
}
