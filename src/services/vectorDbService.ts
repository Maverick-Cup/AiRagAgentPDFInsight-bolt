import { VectorDbConfig, DocumentMetadata } from '../types';

// Enhanced in-memory vector store for demo purposes
interface VectorStoreEntry {
  chunks: string[];
  metadata?: DocumentMetadata;
}

const vectorStore: { [key: string]: VectorStoreEntry } = {};

/**
 * Set up the vector database connection and collection
 */
export const setupVectorDb = async (config: VectorDbConfig): Promise<void> => {
  const { collectionName, chunks = [], metadata } = config;
  
  // Store chunks with metadata in memory
  vectorStore[collectionName] = {
    chunks,
    metadata,
  };
  
  console.log(`Stored ${chunks.length} chunks in collection: ${collectionName}`);
  if (metadata) {
    console.log('Document metadata:', metadata);
  }
  return Promise.resolve();
};

/**
 * Search the vector database for relevant document chunks
 */
export const searchVectorDb = async (
  question: string,
  collectionName: string
): Promise<string[]> => {
  const entry = vectorStore[collectionName];
  
  if (!entry || entry.chunks.length === 0) {
    return [];
  }

  const { chunks } = entry;

  // Enhanced keyword-based search with better scoring
  const keywords = question.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2);

  const scoredChunks = chunks.map(chunk => {
    const chunkLower = chunk.toLowerCase();
    let score = 0;
    
    // Exact phrase matching gets higher score
    if (chunkLower.includes(question.toLowerCase())) {
      score += 10;
    }
    
    // Individual keyword matching
    keywords.forEach(keyword => {
      const keywordCount = (chunkLower.match(new RegExp(keyword, 'g')) || []).length;
      score += keywordCount * 2;
    });
    
    // Bonus for chunks with multiple keywords
    const keywordMatches = keywords.filter(keyword => chunkLower.includes(keyword)).length;
    if (keywordMatches > 1) {
      score += keywordMatches;
    }
    
    return { chunk, score };
  });

  const relevantChunks = scoredChunks
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ chunk }) => chunk)
    .slice(0, 5); // Return top 5 most relevant chunks

  return relevantChunks;
};

/**
 * Get document metadata from vector store
 */
export const getDocumentMetadata = (collectionName: string): DocumentMetadata | undefined => {
  const entry = vectorStore[collectionName];
  return entry?.metadata;
};

/**
 * Get all chunks from a collection (useful for summarization)
 */
export const getAllChunks = (collectionName: string): string[] => {
  const entry = vectorStore[collectionName];
  return entry?.chunks || [];
};