export type ViewType = 'chat' | 'workspace' | 'console' | 'tasks';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  // Debug info for assistant messages
  thinking?: string;
  subAgents?: SubAgentProcess[];
  skills?: SkillProcess[];
  isHistory?: boolean; // If true, hide debug info
}

export interface SubAgentProcess {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'failed';
  thinking?: string;
  output?: string;
  startTime: Date;
  endTime?: Date;
}

export interface SkillProcess {
  id: string;
  name: string;
  status: 'injecting' | 'running' | 'completed';
  params?: string;
  result?: string;
}

export interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  content?: string; // Mock content
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error';
  source: 'system' | 'agent' | 'tool';
  message: string;
  details?: any;
}

export interface ScheduledTask {
  id: string;
  name: string;
  type: 'heartbeat' | 'write_time' | 'agent_command';
  interval: number; // minutes
  enabled: boolean;
  lastRun?: Date;
  config?: any;
}
