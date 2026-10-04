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

const tokenize = (text: string): string[] =>
  text.toLowerCase().match(/[a-z0-9]+/g) ?? [];

const lexicalScore = (question: string, text: string): number => {
  const questionTerms = new Set(tokenize(question).filter(term => term.length > 2));
  if (questionTerms.size === 0) return 0;

  const textTerms = new Set(tokenize(text));
  let matches = 0;
  questionTerms.forEach(term => {
    if (textTerms.has(term)) matches += 1;
  });

  return matches / questionTerms.size;
};

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

  const scored = entry.chunks.map(chunk => {
    const semanticScore = cosineSimilarity(queryEmbedding, chunk.embedding);
    const keywordScore = lexicalScore(question, chunk.text);

    return {
      text: chunk.text,
      score: Math.max(semanticScore, keywordScore),
      semanticScore,
      keywordScore,
    };
  });

  return scored
    .filter(result => result.semanticScore > 0.15 || result.keywordScore > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ text, score }) => ({ text, score }));
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
