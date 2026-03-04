import React, { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { Message } from '../../types';
import { User, Bot, Brain, Code, ChevronDown, ChevronRight, Zap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { format } from 'date-fns';
import 'katex/dist/katex.min.css';
import { CodeBlock } from './CodeBlock';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);
  const [isSubAgentsExpanded, setIsSubAgentsExpanded] = useState(true);
  useEffect(() => {
    if (message.thinking) setIsThinkingExpanded(true);
  }, [message.thinking]);

  return (
    <div className={cn("flex gap-4 mb-6 group", isUser ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar */}
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1",
        isUser ? "bg-indigo-600" : "bg-emerald-600"
      )}>
        {isUser ? <User size={16} className="text-white" /> : <Bot size={16} className="text-white" />}
      </div>

      <div className={cn("flex flex-col max-w-[80%]", isUser ? "items-end" : "items-start w-full")}>
        <div className="flex items-center gap-2 mb-1 px-1">
          <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {isUser ? 'You' : 'Claw Assistant'}
          </span>
          <span className="text-[10px] text-neutral-400 dark:text-neutral-600">
            {format(message.timestamp, 'HH:mm')}
          </span>
        </div>

        <div className={cn(
          "px-4 py-3 text-sm leading-relaxed w-full",
          isUser
            ? "rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-tr-none shadow-sm"
            : "text-neutral-800 dark:text-neutral-200"
        )}>
          {/* Debug Info (Only for Assistant & Not History) */}
          {!isUser && !message.isHistory && (
            <div className="space-y-3 mb-3">
              
              <div className="border-l-2 border-neutral-300 dark:border-neutral-700 pl-3 py-1">
                  {message.thinking ? (
                    <>
                      <button
                        onClick={() => setIsThinkingExpanded(!isThinkingExpanded)}
                        className="flex items-center gap-2 text-xs font-mono text-neutral-500 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors w-full text-left"
                      >
                        <Brain size={12} />
                        <span>思考过程</span>
                        {isThinkingExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      </button>
                      {isThinkingExpanded && (
                        <div className="mt-2 text-xs text-neutral-600 dark:text-neutral-400 italic font-mono bg-neutral-50 dark:bg-neutral-900/50 p-2 rounded whitespace-pre-wrap">
                          {message.thinking}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
                      思考过程仅在使用 <strong>DeepSeek Reasoner</strong> 模型时显示。
                    </p>
                  )}
              </div>

              {/* Sub-Agents Block */}
              {message.subAgents && message.subAgents.length > 0 && (
                <div className="bg-neutral-50 dark:bg-neutral-900 rounded-lg p-2 border border-neutral-200 dark:border-neutral-800">
                  <button 
                    onClick={() => setIsSubAgentsExpanded(!isSubAgentsExpanded)}
                    className="flex items-center gap-2 text-xs font-semibold text-neutral-700 dark:text-neutral-300 w-full mb-2"
                  >
                    <Code size={12} />
                    <span>Sub-Agent Operations ({message.subAgents.length})</span>
                    {isSubAgentsExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </button>

                  {isSubAgentsExpanded && (
                    <div className="space-y-2 pl-1">
                      {message.subAgents.map((agent) => (
                        <div key={agent.id} className="flex flex-col gap-1 text-xs border-l border-neutral-200 dark:border-neutral-700 pl-2">
                          <div className="flex items-center justify-between">
                            <span className="text-neutral-700 dark:text-neutral-300 font-mono">{agent.name}</span>
                            <span className={cn(
                              "px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider",
                              agent.status === 'running' ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" :
                              agent.status === 'completed' ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" :
                              "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                            )}>
                              {agent.status}
                            </span>
                          </div>
                          {agent.thinking && (
                            <div className="text-neutral-500 truncate pl-1 border-l-2 border-neutral-300 dark:border-neutral-800">
                              "{agent.thinking}"
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Skills Block */}
              {message.skills && message.skills.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {message.skills.map((skill) => (
                    <div key={skill.id} className="flex items-center gap-1.5 px-2 py-1 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded text-xs text-neutral-600 dark:text-neutral-400">
                      <Zap size={10} />
                      <span className="font-mono">{skill.name}</span>
                      {skill.status === 'injecting' && <span className="animate-pulse">...</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="prose prose-sm max-w-none text-[var(--color-text)] dark:prose-invert [&_.katex]:text-inherit">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex]}
              components={{
                pre: ({ children }) => {
                  const first = React.Children.toArray(children)[0] as React.ReactElement<{ className?: string; children?: React.ReactNode }> | undefined;
                  if (!first?.props?.className?.includes('language-')) return <pre>{children}</pre>;
                  const className = first.props.className;
                  const lang = className ? String(className).replace(/^language-/, '').trim() : 'text';
                  const raw = first.props.children;
                  const code = Array.isArray(raw) ? raw.join('') : String(raw ?? '');
                  return <CodeBlock code={code} lang={lang} />;
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
