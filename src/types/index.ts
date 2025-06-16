export interface Document {
  id: string;
  name: string;
  size: number;
  file: File;
  status: 'uploading' | 'processing' | 'ready' | 'error';
  createdAt: string;
  type: DocumentType;
  metadata?: DocumentMetadata;
}

export interface DocumentMetadata {
  pageCount?: number;
  wordCount?: number;
  hasImages?: boolean;
  hasTables?: boolean;
  language?: string;
  author?: string;
  title?: string;
  subject?: string;
  keywords?: string[];
}

export type DocumentType = 
  | 'pdf' 
  | 'docx' 
  | 'doc' 
  | 'pptx' 
  | 'ppt' 
  | 'xlsx' 
  | 'xls' 
  | 'txt' 
  | 'rtf' 
  | 'csv'
  | 'unknown';

export interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: string;
  isError?: boolean;
  hasTable?: boolean;
  tableData?: TableData;
}

export interface TableData {
  headers: string[];
  rows: string[][];
  title?: string;
}

export interface VectorDbConfig {
  collectionName: string;
  chunks?: string[];
  metadata?: DocumentMetadata;
}

export interface AgentConfig {
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface ProcessedContent {
  text: string;
  tables?: TableData[];
  images?: string[];
  metadata: DocumentMetadata;
}