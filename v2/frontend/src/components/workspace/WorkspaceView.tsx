import React, { useState } from 'react';
import { FileTree } from './FileTree';
import { Editor } from './Editor';
import { FileNode } from '../../types';

export function WorkspaceView() {
  const [selectedFile, setSelectedFile] = useState<FileNode | undefined>(undefined);
  
  // Mock File System
  const [files, setFiles] = useState<FileNode[]>([
    {
      id: 'root-1',
      name: 'AGENTS.md',
      type: 'file',
      content: '# Agents Configuration\n\nDefine your agent roles here.\n\n- **Researcher**: Gathers information.\n- **Coder**: Writes code.'
    },
    {
      id: 'root-2',
      name: 'SOUL.md',
      type: 'file',
      content: '# Soul Definition\n\nThe core personality and ethical guidelines of the AI.'
    },
    {
      id: 'dir-1',
      name: 'agents',
      type: 'directory',
      children: [
        {
          id: 'agent-1',
          name: 'researcher.md',
          type: 'file',
          content: '# Researcher Agent\n\nSpecializes in web search and data synthesis.'
        },
        {
          id: 'agent-2',
          name: 'coder.md',
          type: 'file',
          content: '# Coder Agent\n\nSpecializes in TypeScript and React.'
        }
      ]
    },
    {
      id: 'dir-2',
      name: 'skills',
      type: 'directory',
      children: [
        {
          id: 'skill-1',
          name: 'web_search',
          type: 'directory',
          children: [
            {
              id: 'skill-file-1',
              name: 'SKILL.md',
              type: 'file',
              content: '# Web Search Skill\n\nAllows the agent to search the internet.'
            }
          ]
        }
      ]
    }
  ]);

  const handleSave = (content: string) => {
    if (selectedFile) {
      // Update file content in state (deep update needed in real app, simplified here)
      // For now just log it
      console.log(`Saving ${selectedFile.name}:`, content);
      
      // Ideally we update the files state here to reflect the change
      // But since it's a mock, we just pretend
    }
  };

  return (
    <div className="flex h-full bg-zinc-50 dark:bg-zinc-950 transition-colors duration-300">
      {/* Sidebar */}
      <div className="w-64 border-r border-zinc-200 dark:border-zinc-800 flex flex-col bg-white dark:bg-zinc-900/50 transition-colors duration-300">
        <div className="h-10 flex items-center px-4 border-b border-zinc-200 dark:border-zinc-800">
          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-500 uppercase tracking-wider">Explorer</span>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          <FileTree 
            files={files} 
            onSelectFile={setSelectedFile} 
            selectedFileId={selectedFile?.id} 
          />
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 overflow-hidden">
        <Editor file={selectedFile} onSave={handleSave} />
      </div>
    </div>
  );
}
