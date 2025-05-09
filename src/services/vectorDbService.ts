import { VectorDbConfig } from '../types';

// Simple in-memory vector store for demo purposes
const vectorStore: { [key: string]: string[] } = {};

/**
 * Set up the vector database connection and collection
 */
export const setupVectorDb = async (config: VectorDbConfig): Promise<void> => {
  const { collectionName, chunks = [] } = config;
  
  // Store chunks in memory
  vectorStore[collectionName] = chunks;
  
  console.log(`Stored ${chunks.length} chunks in collection: ${collectionName}`);
  return Promise.resolve();
};

/**
 * Search the vector database for relevant document chunks
 */
export const searchVectorDb = async (
  question: string,
  collectionName: string
): Promise<string[]> => {
  const chunks = vectorStore[collectionName] || [];
  
  if (chunks.length === 0) {
    return [];
  }

  // Improved keyword-based search
  const keywords = question.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2);

  const scoredChunks = chunks.map(chunk => {
    const chunkLower = chunk.toLowerCase();
    const score = keywords.reduce((acc, keyword) => {
      return acc + (chunkLower.includes(keyword) ? 1 : 0);
    }, 0);
    return { chunk, score };
  });

  const relevantChunks = scoredChunks
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ chunk }) => chunk)
    .slice(0, 3);

  return relevantChunks;
};