import { Document, TableData } from '../types';
import { searchVectorDb, getDocumentMetadata, getAllChunks } from './vectorDbService';

/**
 * Process a user question using the RAG agent with fallback to local processing
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
      // Try LLM first, fallback to local processing
      try {
        return await generateLLMResponse(question, relevantContext.join('\n\n'), document.type);
      } catch (llmError) {
        console.warn('LLM service unavailable, using local processing:', llmError);
        return generateLocalResponse(question, relevantContext, document);
      }
    }
    
    // Step 2: If no specific context found, use general document content
    const allChunks = getAllChunks(collectionName);
    if (allChunks.length > 0) {
      const generalContext = allChunks.slice(0, 3).join('\n\n');
      try {
        return await generateLLMResponse(question, generalContext, document.type);
      } catch (llmError) {
        console.warn('LLM service unavailable, using local processing:', llmError);
        return generateLocalResponse(question, [generalContext], document);
      }
    }
    
    // Step 3: If no content available, provide helpful guidance
    return "I don't have access to the content of this document yet. Please make sure the document has been fully processed, or try asking a different question.";
    
  } catch (error) {
    console.error('Error in RAG agent:', error);
    return "I encountered an issue processing your question. Please try rephrasing it or ask something else about the document.";
  }
};

/**
 * Generate response using Hugging Face LLM via Netlify function (production) or fallback (development)
 */
const generateLLMResponse = async (
  question: string,
  context: string,
  documentType: string
): Promise<string> => {
  // Check if we're in development mode
  const isDevelopment = window.location.hostname === 'localhost' || 
                       window.location.hostname.includes('webcontainer') ||
                       window.location.hostname.includes('local-credentialless');
  
  if (isDevelopment) {
    console.log('Development mode detected, using local processing');
    throw new Error('LLM service not available in development mode');
  }

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
 * Generate response using local processing (fallback for development)
 */
const generateLocalResponse = (
  question: string,
  context: string[],
  document: Document
): string => {
  const contextText = context.join(' ');
  const questionLower = question.toLowerCase();
  
  // Enhanced response generation based on document type and content
  if (document.type === 'xlsx' || document.type === 'xls' || document.type === 'csv') {
    if (questionLower.includes('total') || questionLower.includes('sum')) {
      return `Based on the spreadsheet data, I can see numerical information that would allow for calculations. The data contains various columns with quantitative values. For specific totals or sums, please specify which column or data range you're interested in analyzing.\n\n**Note:** This is a local analysis. For more detailed AI insights, please deploy the application.`;
    }
    
    if (questionLower.includes('column') || questionLower.includes('header')) {
      return `The spreadsheet contains multiple columns with structured data. Each column represents a different data category or metric. The headers organize the information for easy reference and analysis.\n\n**Note:** This is a local analysis. For more detailed AI insights, please deploy the application.`;
    }
    
    if (questionLower.includes('about') || questionLower.includes('content')) {
      return `This is a ${document.type.toUpperCase()} spreadsheet file containing structured data in tabular format. The file includes multiple columns and rows with various data points that can be analyzed for insights and patterns.\n\n**Key Features:**\n- Structured tabular data\n- Multiple data categories\n- Suitable for analysis and reporting\n- Contains quantitative information\n\n**Note:** This is a local analysis. For more detailed AI insights, please deploy the application.`;
    }
  }
  
  if (document.type === 'pptx' || document.type === 'ppt') {
    if (questionLower.includes('about') || questionLower.includes('content')) {
      return `This is a ${document.type.toUpperCase()} presentation file containing slides with information, likely including text, images, and structured content for communication purposes.\n\n**Key Features:**\n- Presentation format\n- Visual content structure\n- Information organized in slides\n- Designed for communication\n\n**Note:** This is a local analysis. For more detailed AI insights, please deploy the application.`;
    }
  }
  
  // Content-based responses for text documents
  if (contextText.includes('revenue') || contextText.includes('sales') || contextText.includes('financial')) {
    return `Based on the document, I found financial information including revenue and sales data. Here's what I can tell you: ${contextText.substring(0, 300)}...\n\n**Note:** This is a local analysis. For more detailed AI insights, please deploy the application.`;
  }
  
  if (contextText.includes('forecast') || contextText.includes('outlook') || contextText.includes('prediction')) {
    return `According to the document, there are forecasts and outlook information: ${contextText.substring(0, 300)}...\n\n**Note:** This is a local analysis. For more detailed AI insights, please deploy the application.`;
  }
  
  if (contextText.includes('data') || contextText.includes('analysis') || contextText.includes('results')) {
    return `The document contains analytical information and data: ${contextText.substring(0, 300)}...\n\n**Note:** This is a local analysis. For more detailed AI insights, please deploy the application.`;
  }
  
  // Generic response with context
  if (contextText.length > 0) {
    return `Based on the information in the document: ${contextText.substring(0, 400)}${contextText.length > 400 ? '...' : ''}\n\n**Note:** This is a local analysis. For more detailed AI insights, please deploy the application.`;
  }
  
  // Fallback response
  return `I can see this is a ${document.type.toUpperCase()} document, but I need more specific information to provide a detailed answer. Could you please ask a more specific question about the document's content?\n\n**Note:** This is a local analysis. For more detailed AI insights, please deploy the application.`;
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
 * Generate a summary of the document
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
 * Extract and format table data
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

  if (document.type === 'xlsx' || document.type === 'xls' || document.type === 'csv') {
    summary += `**Content Overview:**\nThis spreadsheet contains structured data with multiple columns and rows. The document includes numerical data, categories, and various data points that can be analyzed for insights, trends, and patterns.\n\n`;
    summary += `**Key Features:**\n- Structured tabular data\n- Multiple data categories\n- Suitable for analysis and reporting\n- Contains quantitative information\n\n`;
  } else if (document.type === 'pptx' || document.type === 'ppt') {
    summary += `**Content Overview:**\nThis presentation contains slides with information, likely including text, images, and structured content for communication purposes.\n\n`;
    summary += `**Key Features:**\n- Presentation format\n- Visual content structure\n- Information organized in slides\n- Designed for communication\n\n`;
  } else {
    const contentSample = allChunks.slice(0, 2).join(' ').substring(0, 400);
    summary += `**Content Preview:**\n${contentSample}...\n\n`;
    summary += `**Key Features:**\n- Text-based content\n- ${Math.ceil(allChunks.length / 10)} main sections identified\n- Comprehensive information coverage\n- Searchable content\n\n`;
  }

  summary += `**Usage Tips:**\n- Ask specific questions about the content\n- Request data extraction for spreadsheets\n- Inquire about specific topics or sections\n- Ask for detailed analysis of particular areas\n\n`;
  summary += `**Note:** This is a local analysis. For enhanced AI-powered insights, please deploy the application to access the full Hugging Face integration.`;

  return summary;
};

/**
 * Fallback table response without LLM
 */
const generateFallbackTableResponse = (document: Document, metadata: any): string => {
  if (document.type === 'xlsx' || document.type === 'xls' || document.type === 'csv') {
    return `## Table Data from ${document.name}\n\n` +
           `This spreadsheet contains structured data in tabular format. The data includes:\n\n` +
           `- Multiple columns with headers\n` +
           `- Rows of data entries\n` +
           `- Numerical and text values\n` +
           `- Organized information suitable for analysis\n\n` +
           `**To get specific data:**\n` +
           `- Ask about specific columns or rows\n` +
           `- Request data filtering or sorting\n` +
           `- Inquire about calculations or summaries\n` +
           `- Ask for data visualization insights\n\n` +
           `**Example questions:**\n` +
           `- "What are the column headers?"\n` +
           `- "Show me the first 10 rows"\n` +
           `- "What's the total of column X?"\n` +
           `- "Find rows where column Y equals Z"\n\n` +
           `**Note:** This is a local analysis. For enhanced AI-powered insights, please deploy the application.`;
  }

  return `## Table Information from ${document.name}\n\n` +
         `Tables have been detected in this document. The structured data can be analyzed and extracted based on your specific needs.\n\n` +
         `**Available Operations:**\n` +
         `- Extract specific table data\n` +
         `- Analyze numerical information\n` +
         `- Compare data across tables\n` +
         `- Generate insights from structured content\n\n` +
         `Please ask specific questions about the table data you're interested in.\n\n` +
         `**Note:** This is a local analysis. For enhanced AI-powered insights, please deploy the application.`;
};