import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { FileNode } from '../../types';
import { Folder, FileText, ChevronRight, ChevronDown, FileCode, FileJson } from 'lucide-react';

interface FileTreeProps {
  files: FileNode[];
  onSelectFile: (file: FileNode) => void;
  selectedFileId?: string;
  level?: number;
}

export function FileTree({ files, onSelectFile, selectedFileId, level = 0 }: FileTreeProps) {
  return (
    <div className="select-none">
      {files.map((node) => (
        <FileTreeNode 
          key={node.id} 
          node={node} 
          onSelectFile={onSelectFile} 
          selectedFileId={selectedFileId} 
          level={level} 
        />
      ))}
    </div>
  );
}

function FileTreeNode({ node, onSelectFile, selectedFileId, level }: { node: FileNode, onSelectFile: (f: FileNode) => void, selectedFileId?: string, level: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const isSelected = node.id === selectedFileId;
  
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.type === 'directory') {
      setIsOpen(!isOpen);
    } else {
      onSelectFile(node);
    }
  };

  const Icon = node.type === 'directory' 
    ? (isOpen ? ChevronDown : ChevronRight) 
    : (node.name.endsWith('.json') ? FileJson : node.name.endsWith('.ts') ? FileCode : FileText);

  return (
    <div>
      <div 
        onClick={handleClick}
        className={cn(
          "flex items-center gap-1.5 py-1 px-2 cursor-pointer transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800/50 text-sm",
          isSelected 
            ? "bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border-l-2 border-indigo-500" 
            : "text-zinc-600 dark:text-zinc-400 border-l-2 border-transparent"
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
      >
        <span className="text-zinc-400 dark:text-zinc-500 shrink-0">
          {node.type === 'directory' ? <Folder size={14} className={cn(isOpen && "text-zinc-600 dark:text-zinc-300")} /> : <Icon size={14} />}
        </span>
        <span className="truncate">{node.name}</span>
      </div>
      
      {isOpen && node.children && (
        <FileTree 
          files={node.children} 
          onSelectFile={onSelectFile} 
          selectedFileId={selectedFileId} 
          level={level + 1} 
        />
      )}
    </div>
  );
}
