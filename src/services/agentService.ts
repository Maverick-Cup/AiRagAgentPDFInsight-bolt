import { Document } from '../types';
import { searchVectorDb } from './vectorDbService';
import { webSearch } from './webSearchService';

/**
 * Process a user question using the RAG agent
 */
export const processQuestion = async (
  question: string,
  document: Document
): Promise<string> => {
  console.log(`Processing question: "${question}" for document: ${document.name}`);
  
  try {
    // Step 1: Try to find relevant context from the document
    const relevantContext = await searchVectorDb(question, `pdf_${document.id}`);
    
    if (relevantContext.length > 0) {
      // Use document context to generate response
      console.log('Found relevant context in the document');
      return generateResponseFromContext(question, relevantContext);
    }
    
    // Step 2: Fall back to web search if no relevant context found
    console.log('No relevant context found, falling back to web search');
    const webResults = await webSearch(question);
    
    if (webResults.length > 0) {
      return generateResponseFromWebResults(question, webResults);
    }
    
    // Step 3: If all else fails, provide a generic response
    return "I couldn't find specific information about this in the document or through web search. If you have a more specific question about the document's content, I'd be happy to try again.";
    
  } catch (error) {
    console.error('Error in RAG agent:', error);
    throw new Error('Failed to process your question. Please try again.');
  }
};

/**
 * Generate a response based on document context
 */
const generateResponseFromContext = async (
  question: string,
  context: string[]
): Promise<string> => {
  // In a real implementation, this would:
  // 1. Use an LLM (e.g., GPT-4o-mini) to generate a response
  // 2. Pass the question and context to the LLM
  
  // Simulate LLM generation time
  await new Promise((resolve) => setTimeout(resolve, 1000));
  
  const contextText = context.join(' ');
  
  // Return a mock response based on the context
  if (contextText.includes('revenue') || contextText.includes('sales')) {
    return `Based on the document, I found that Q3 revenue reached $12.4 million, which represents a 15% increase year-over-year. Additionally, sales in the European market grew by 22%, which exceeded expectations for the quarter. The company also reported improved profit margins of 28% due to operational efficiencies that were implemented.`;
  }
  
  if (contextText.includes('forecast') || contextText.includes('outlook')) {
    return `According to the document, the company has a positive outlook for Q4, with forecasted revenue between $14-15 million. There are also plans for expansion into Asian markets in the next fiscal year, which should drive further growth. The company is committing to innovation with a 10% increase in R&D investments to support new product development.`;
  }
  
  return `Based on the information in the document, ${contextText.toLowerCase()}`;
};

/**
 * Generate a response based on web search results
 */
const generateResponseFromWebResults = async (
  question: string,
  results: string[]
): Promise<string> => {
  // In a real implementation, this would use an LLM to generate a response
  
  // Simulate LLM generation time
  await new Promise((resolve) => setTimeout(resolve, 1000));
  
  return `I couldn't find information about this in the document, but based on a web search: ${results.join(' ')}`;
};