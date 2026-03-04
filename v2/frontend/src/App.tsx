/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { ChatView } from './components/chat/ChatView';
import { WorkspaceView } from './components/workspace/WorkspaceView';
import { ConsoleView } from './components/console/ConsoleView';
import { TasksView } from './components/tasks/TasksView';
import { Message } from './types';
import { History } from 'lucide-react';
import { cn } from './lib/utils';
import { getConfig, postChatStream } from './api/gateway';

export default function App() {
  const [activeView, setActiveView] = useState('chat');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [model, setModel] = useState('deepseek-chat');
  const [models, setModels] = useState<string[]>(['deepseek-chat', 'deepseek-reasoner']);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    getConfig()
      .then((c) => {
        setModels(c.models);
        setModel(c.defaultModel);
      })
      .catch(() => {});
  }, []);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleSendMessage = (content: string) => {
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date()
    };
    const assistantId = (Date.now() + 1).toString();
    const assistantMsg: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      thinking: '',
    };
    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setChatLoading(true);
    postChatStream(content, model, (chunk) => {
      if (chunk.type === 'thinking') {
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, thinking: (m.thinking ?? '') + chunk.text } : m));
      } else if (chunk.type === 'content') {
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: m.content + chunk.text } : m));
      } else if (chunk.type === 'done') {
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: chunk.reply || m.content } : m));
      } else if (chunk.type === 'error') {
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: `Error: ${chunk.error}` } : m));
      }
    })
      .then(() => setChatLoading(false))
      .catch((err) => {
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: `Error: ${err instanceof Error ? err.message : String(err)}` } : m));
        setChatLoading(false);
      });
  };

  const handleLoadChat = (chatId: string) => {
    setActiveView('chat');
    // In a real app, fetch chat by ID
    // For mock, we just set the existing messages to be "history"
    setMessages(prev => prev.map(msg => ({ ...msg, isHistory: true })));
  };

  const handleNewChat = () => {
    setActiveView('chat');
    setMessages([]);
  };

  return (
    <div className={cn("flex h-screen font-sans overflow-hidden transition-colors duration-300", theme === 'dark' ? 'dark bg-neutral-950 text-neutral-100' : 'bg-white text-neutral-900')}>
      <Sidebar 
        activeView={activeView} 
        setActiveView={setActiveView} 
        isCollapsed={isSidebarCollapsed} 
        toggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
        onSelectChat={handleLoadChat}
        onNewChat={handleNewChat}
      />
      
      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-neutral-950 transition-colors duration-300">
        <Header 
          title={activeView === 'chat' ? 'New Chat' : activeView.charAt(0).toUpperCase() + activeView.slice(1)} 
          model={model} 
          setModel={setModel}
          models={models}
          theme={theme}
          toggleTheme={toggleTheme}
        />
        
        <main className="flex-1 overflow-hidden relative">
          {activeView === 'chat' && (
            <ChatView 
              messages={messages} 
              onSendMessage={handleSendMessage}
              isLoading={chatLoading}
            />
          )}
          {activeView === 'workspace' && <WorkspaceView />}
          {activeView === 'console' && <ConsoleView />}
          {activeView === 'tasks' && <TasksView />}
          {activeView === 'history' && (
            <div className="flex flex-col items-center justify-center h-full text-neutral-500">
              <History size={48} className="mb-4 opacity-50" />
              <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-300">Chat History</h3>
              <p className="text-sm max-w-md text-center mt-2">
                Select a chat from the sidebar to view its history.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

