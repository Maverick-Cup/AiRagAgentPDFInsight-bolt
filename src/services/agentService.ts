import { Document, TableData } from '../types';
import { searchVectorDb, getDocumentMetadata, getAllChunks } from './vectorDbService';

/**
 * Process a user question using the RAG agent with Hugging Face LLM
 */
export const processQuestion = async (
  question: string,
  document: Document
): Promise<string> => {
  console.log(`Processing question: "${question}" for document: ${document.name} (${document.type})`);
  
  try {
    const collectionName = `doc_${document.id}`;
    
    // Check if this is a request for summarization
    if (isRequestForSummary(question)) {
      return await generateSummary(collectionName, document, question);
    }
    
    // Check if this is a request for table extraction
    if (isRequestForTables(question)) {
      return await extractTables(collectionName, document, question);
    }
    
    // Step 1: Try to find relevant context from the document
    const relevantContext = await searchVectorDb(question, collectionName);
    
    if (relevantContext.length > 0) {
      // Use document context to generate response with LLM
      console.log('Found relevant context in the document');
      return await generateLLMResponse(question, relevantContext.join('\n\n'), document.type);
    }
    
    // Step 2: If no specific context found, use general document content
    const allChunks = getAllChunks(collectionName);
    if (allChunks.length > 0) {
      // Use first few chunks as context
      const generalContext = allChunks.slice(0, 3).join('\n\n');
      return await generateLLMResponse(question, generalContext, document.type);
    }
    
    // Step 3: If no content available, provide helpful guidance
    return "I don't have access to the content of this document yet. Please make sure the document has been fully processed, or try asking a different question.";
    
  } catch (error) {
    console.error('Error in RAG agent:', error);
    
    // Provide user-friendly error message
    if (error instanceof Error && error.message.includes('loading')) {
      return "The AI model is currently starting up. Please wait a moment and try your question again.";
    }
    
    return "I encountered an issue processing your question. Please try rephrasing it or ask something else about the document.";
  }
};

/**
 * Generate response using Hugging Face LLM via Netlify function
 */
const generateLLMResponse = async (
  question: string,
  context: string,
  documentType: string
): Promise<string> => {
  try {
    // Prepare enhanced prompt based on document type
    let enhancedPrompt = question;
    
    if (documentType === 'xlsx' || documentType === 'xls' || documentType === 'csv') {
      enhancedPrompt = `Based on the spreadsheet data provided, ${question}. Please provide specific insights about the data, numbers, or patterns you can identify.`;
    } else if (documentType === 'pptx' || documentType === 'ppt') {
      enhancedPrompt = `Based on the presentation content provided, ${question}. Please focus on the key points, structure, and main messages.`;
    } else if (documentType === 'pdf' || documentType === 'docx' || documentType === 'doc') {
      enhancedPrompt = `Based on the document content provided, ${question}. Please provide a comprehensive answer using the information available.`;
    }

    const response = await fetch('/.netlify/functions/llm-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: enhancedPrompt,
        context: context,
        documentType: documentType,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      if (response.status === 503 && errorData.retryAfter) {
        throw new Error('loading');
      }
      
      throw new Error(errorData.error || 'Failed to get AI response');
    }

    const data = await response.json();
    
    if (!data.response) {
      throw new Error('Invalid response from AI service');
    }

    return data.response;
    
  } catch (error) {
    console.error('Error calling LLM service:', error);
    throw error;
  }
};

/**
 * Check if the question is asking for a summary
 */
const isRequestForSummary = (question: string): boolean => {
  const summaryKeywords = ['summary', 'summarize', 'overview', 'main points', 'key points', 'brief', 'outline'];
  const questionLower = question.toLowerCase();
  return summaryKeywords.some(keyword => questionLower.includes(keyword));
};

/**
 * Check if the question is asking for table data
 */
const isRequestForTables = (question: string): boolean => {
  const tableKeywords = ['table', 'data', 'numbers', 'statistics', 'figures', 'chart', 'spreadsheet'];
  const questionLower = question.toLowerCase();
  return tableKeywords.some(keyword => questionLower.includes(keyword));
};

/**
 * Generate a summary of the document using LLM
 */
const generateSummary = async (collectionName: string, document: Document, question: string): Promise<string> => {
  const allChunks = getAllChunks(collectionName);
  const metadata = getDocumentMetadata(collectionName);
  
  if (allChunks.length === 0) {
    return "I couldn't generate a summary as no content was found in the document.";
  }

  // Use first few chunks for summary to avoid token limits
  const contentForSummary = allChunks.slice(0, 5).join('\n\n');
  
  const summaryPrompt = `Please provide a comprehensive summary of this ${document.type.toUpperCase()} document. Include the main topics, key points, and important information.`;
  
  try {
    const llmSummary = await generateLLMResponse(summaryPrompt, contentForSummary, document.type);
    
    // Enhance with metadata
    let enhancedSummary = `## Document Summary: ${document.name}\n\n`;
    
    if (metadata) {
      enhancedSummary += `**Document Information:**\n`;
      if (metadata.wordCount) enhancedSummary += `- Word Count: ${metadata.wordCount.toLocaleString()}\n`;
      if (metadata.pageCount) enhancedSummary += `- Pages: ${metadata.pageCount}\n`;
      if (metadata.hasTables) enhancedSummary += `- Contains Tables: Yes\n`;
      if (metadata.hasImages) enhancedSummary += `- Contains Images: Yes\n`;
      enhancedSummary += `\n`;
    }
    
    enhancedSummary += `**AI-Generated Summary:**\n${llmSummary}`;
    
    return enhancedSummary;
    
  } catch (error) {
    console.error('Error generating LLM summary:', error);
    return generateFallbackSummary(document, metadata, allChunks);
  }
};

/**
 * Extract and format table data using LLM
 */
const extractTables = async (collectionName: string, document: Document, question: string): Promise<string> => {
  const metadata = getDocumentMetadata(collectionName);
  const allChunks = getAllChunks(collectionName);
  
  if (!metadata?.hasTables && (document.type !== 'xlsx' && document.type !== 'xls' && document.type !== 'csv')) {
    return "No tables were detected in this document. The content appears to be primarily text-based.";
  }

  const tablePrompt = `Please identify and describe any tables, data structures, or numerical information in this document. Focus on the organization of data, column headers, and key data points.`;
  
  try {
    const contentForAnalysis = allChunks.slice(0, 3).join('\n\n');
    const llmResponse = await generateLLMResponse(tablePrompt, contentForAnalysis, document.type);
    
    let response = `## Table Analysis for ${document.name}\n\n`;
    response += llmResponse;
    
    return response;
    
  } catch (error) {
    console.error('Error analyzing tables with LLM:', error);
    return generateFallbackTableResponse(document, metadata);
  }
};

/**
 * Fallback summary generation without LLM
 */
const generateFallbackSummary = (document: Document, metadata: any, allChunks: string[]): string => {
  let summary = `## Document Summary: ${document.name}\n\n`;
  
  if (metadata) {
    summary += `**Document Information:**\n`;
    if (metadata.wordCount) summary += `- Word Count: ${metadata.wordCount.toLocaleString()}\n`;
    if (metadata.pageCount) summary += `- Pages: ${metadata.pageCount}\n`;
    if (metadata.hasTables) summary += `- Contains Tables: Yes\n`;
    if (metadata.hasImages) summary += `- Contains Images: Yes\n`;
    summary += `\n`;
  }

  const contentSample = allChunks.slice(0, 2).join(' ').substring(0, 400);
  summary += `**Content Preview:**\n${contentSample}...\n\n`;
  summary += `**Note:** Full AI analysis is temporarily unavailable. Please try again in a moment for enhanced insights.`;

  return summary;
};

/**
 * Fallback table response without LLM
 */
const generateFallbackTableResponse = (document: Document, metadata: any): string => {
  if (document.type === 'xlsx' || document.type === 'xls' || document.type === 'csv') {
    return `## Table Data from ${document.name}\n\n` +
           `This spreadsheet contains structured data in tabular format. The AI analysis is temporarily unavailable, but you can ask specific questions about:\n\n` +
           `- Column headers and data structure\n` +
           `- Specific rows or data ranges\n` +
           `- Calculations and summaries\n` +
           `- Data patterns and insights\n\n` +
           `Please try your question again in a moment for detailed AI analysis.`;
  }

  return `## Table Information from ${document.name}\n\n` +
         `Tables have been detected in this document. AI analysis is temporarily unavailable, but you can ask specific questions about the table content.\n\n` +
         `Please try again in a moment for detailed insights.`;
};