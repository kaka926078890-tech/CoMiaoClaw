import React, { useState, useRef, useEffect } from 'react';
import { MessageBubble } from './MessageBubble';
import { Message } from '../../types';
import { Send, Paperclip, Mic } from 'lucide-react';

interface ChatViewProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
  isLoading?: boolean;
}

export function ChatView({ messages, onSendMessage, isLoading }: ChatViewProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-neutral-950 transition-colors duration-300">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-neutral-300 dark:scrollbar-thumb-neutral-800 scrollbar-track-transparent">
        <div className="max-w-4xl mx-auto">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[60vh] text-neutral-500 dark:text-neutral-500">
              <div className="w-16 h-16 bg-neutral-50 dark:bg-neutral-900 rounded-2xl flex items-center justify-center mb-4 border border-neutral-200 dark:border-neutral-800 shadow-sm">
                <span className="text-2xl">🦁</span>
              </div>
              <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-300 mb-2">Welcome to Claw</h3>
              <p className="text-sm text-center max-w-md text-neutral-600 dark:text-neutral-400">
                Start a conversation to interact with your intelligent agents.
                Configure skills and sub-agents in the Workspace.
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))
          )}
          {isLoading && (
            <div className="flex items-center gap-2 text-neutral-500 text-sm ml-12 animate-pulse">
              <span>Claw is thinking...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-white/50 dark:bg-neutral-900/50 backdrop-blur-sm transition-colors duration-300">
        <div className="max-w-4xl mx-auto relative">
          <form onSubmit={handleSubmit} className="relative bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-sm focus-within:ring-2 focus-within:ring-neutral-900/10 dark:focus-within:ring-neutral-100/10 focus-within:border-neutral-900 dark:focus-within:border-neutral-100 transition-all">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Send a message to Claw..."
              className="w-full bg-transparent text-neutral-900 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-500 px-4 py-3 pr-24 min-h-[60px] max-h-[200px] resize-none focus:outline-none scrollbar-thin"
              rows={1}
            />
            
            <div className="absolute right-2 bottom-2 flex items-center gap-1">
              <button 
                type="button"
                className="p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700/50 rounded-lg transition-colors"
                title="Attach file"
              >
                <Paperclip size={18} />
              </button>
              <button 
                type="submit"
                disabled={!input.trim() || isLoading}
                className="p-2 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                <Send size={18} />
              </button>
            </div>
          </form>
          <div className="text-center mt-2 text-[10px] text-neutral-500 dark:text-neutral-600">
            Claw can make mistakes. Consider checking important information.
          </div>
        </div>
      </div>
    </div>
  );
}
