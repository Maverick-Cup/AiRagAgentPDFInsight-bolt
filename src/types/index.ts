export interface Document {
  id: string;
  name: string;
  size: number;
  file: File;
  status: 'uploading' | 'processing' | 'ready' | 'error';
  createdAt: string;
}

export interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: string;
  isError?: boolean;
}

export interface VectorDbConfig {
  collectionName: string;
  chunks?: string[];
}

export interface AgentConfig {
  model: string;
  temperature: number;
  maxTokens: number;
}