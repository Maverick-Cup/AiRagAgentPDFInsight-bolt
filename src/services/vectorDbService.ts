import { VectorDbConfig, DocumentMetadata, TableData } from '../types';
import { embed, embedBatch, cosineSimilarity } from './embeddingService';

interface ChunkEntry {
  text: string;
  embedding: number[];
  index: number;
}

interface VectorStoreEntry {
  chunks: ChunkEntry[];
  metadata?: DocumentMetadata;
  tables?: TableData[];
}

const vectorStore: { [key: string]: VectorStoreEntry } = {};

export const setupVectorDb = async (config: VectorDbConfig): Promise<void> => {
  const { collectionName, chunks = [], metadata, tables } = config;

  const embeddings = await embedBatch(chunks);

  const chunkEntries: ChunkEntry[] = chunks.map((text, i) => ({
    text,
    embedding: embeddings[i] || [],
    index: i,
  }));

  vectorStore[collectionName] = {
    chunks: chunkEntries,
    metadata,
    tables,
  };

  console.log(`Stored ${chunkEntries.length} embedded chunks in collection: ${collectionName}`);
};

export const searchVectorDb = async (
  question: string,
  collectionName: string,
  topK: number = 5
): Promise<{ text: string; score: number }[]> => {
  const entry = vectorStore[collectionName];

  if (!entry || entry.chunks.length === 0) {
    return [];
  }

  const queryEmbedding = await embed(question);

  const scored = entry.chunks.map(chunk => ({
    text: chunk.text,
    score: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));

  return scored
    .filter(s => s.score > 0.15)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
};

export const getDocumentMetadata = (collectionName: string): DocumentMetadata | undefined => {
  return vectorStore[collectionName]?.metadata;
};

export const getAllChunks = (collectionName: string): string[] => {
  const entry = vectorStore[collectionName];
  return entry?.chunks.map(c => c.text) || [];
};

export const getTables = (collectionName: string): TableData[] | undefined => {
  return vectorStore[collectionName]?.tables;
};
