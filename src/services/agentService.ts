import { Document, TableData } from '../types';
import { searchVectorDb, getDocumentMetadata, getAllChunks } from './vectorDbService';
import { webSearch } from './webSearchService';

/**
 * Process a user question using the RAG agent
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
      return await generateSummary(collectionName, document);
    }
    
    // Check if this is a request for table extraction
    if (isRequestForTables(question)) {
      return await extractTables(collectionName, document);
    }
    
    // Step 1: Try to find relevant context from the document
    const relevantContext = await searchVectorDb(question, collectionName);
    
    if (relevantContext.length > 0) {
      // Use document context to generate response
      console.log('Found relevant context in the document');
      return generateResponseFromContext(question, relevantContext, document);
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
const generateSummary = async (collectionName: string, document: Document): Promise<string> => {
  const allChunks = getAllChunks(collectionName);
  const metadata = getDocumentMetadata(collectionName);
  
  if (allChunks.length === 0) {
    return "I couldn't generate a summary as no content was found in the document.";
  }

  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 1500));

  let summary = `## Document Summary: ${document.name}\n\n`;
  
  // Add metadata information
  if (metadata) {
    summary += `**Document Information:**\n`;
    if (metadata.wordCount) summary += `- Word Count: ${metadata.wordCount.toLocaleString()}\n`;
    if (metadata.pageCount) summary += `- Pages: ${metadata.pageCount}\n`;
    if (metadata.hasTables) summary += `- Contains Tables: Yes\n`;
    if (metadata.hasImages) summary += `- Contains Images: Yes\n`;
    summary += `\n`;
  }

  // Generate content-based summary
  const contentSample = allChunks.slice(0, 3).join(' ').substring(0, 500);
  
  if (document.type === 'xlsx' || document.type === 'xls' || document.type === 'csv') {
    summary += `**Content Overview:**\nThis spreadsheet contains structured data with multiple columns and rows. The document includes numerical data, categories, and various data points that can be analyzed for insights, trends, and patterns.\n\n`;
    summary += `**Key Features:**\n- Structured tabular data\n- Multiple data categories\n- Suitable for analysis and reporting\n- Contains quantitative information\n\n`;
  } else if (document.type === 'pptx' || document.type === 'ppt') {
    summary += `**Content Overview:**\nThis presentation contains slides with information, likely including text, images, and structured content for communication purposes.\n\n`;
    summary += `**Key Features:**\n- Presentation format\n- Visual content structure\n- Information organized in slides\n- Designed for communication\n\n`;
  } else {
    summary += `**Content Overview:**\n${contentSample}...\n\n`;
    summary += `**Key Features:**\n- Text-based content\n- ${Math.ceil(allChunks.length / 10)} main sections identified\n- Comprehensive information coverage\n- Searchable content\n\n`;
  }

  summary += `**Usage Tips:**\n- Ask specific questions about the content\n- Request data extraction for spreadsheets\n- Inquire about specific topics or sections\n- Ask for detailed analysis of particular areas`;

  return summary;
};

/**
 * Extract and format table data
 */
const extractTables = async (collectionName: string, document: Document): Promise<string> => {
  const metadata = getDocumentMetadata(collectionName);
  
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 1000));

  if (!metadata?.hasTables) {
    return "No tables were detected in this document. The content appears to be primarily text-based.";
  }

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
           `Example questions:\n` +
           `- "What are the column headers?"\n` +
           `- "Show me the first 10 rows"\n` +
           `- "What's the total of column X?"\n` +
           `- "Find rows where column Y equals Z"`;
  }

  return `## Table Information from ${document.name}\n\n` +
         `Tables have been detected in this document. The structured data can be analyzed and extracted based on your specific needs.\n\n` +
         `**Available Operations:**\n` +
         `- Extract specific table data\n` +
         `- Analyze numerical information\n` +
         `- Compare data across tables\n` +
         `- Generate insights from structured content\n\n` +
         `Please ask specific questions about the table data you're interested in.`;
};

/**
 * Generate a response based on document context
 */
const generateResponseFromContext = async (
  question: string,
  context: string[],
  document: Document
): Promise<string> => {
  // Simulate LLM generation time
  await new Promise((resolve) => setTimeout(resolve, 1000));
  
  const contextText = context.join(' ');
  const questionLower = question.toLowerCase();
  
  // Enhanced response generation based on document type and content
  if (document.type === 'xlsx' || document.type === 'xls' || document.type === 'csv') {
    if (questionLower.includes('total') || questionLower.includes('sum')) {
      return `Based on the spreadsheet data, I can see numerical information that would allow for calculations. The data contains various columns with quantitative values. For specific totals or sums, please specify which column or data range you're interested in analyzing.`;
    }
    
    if (questionLower.includes('column') || questionLower.includes('header')) {
      return `The spreadsheet contains multiple columns with structured data. Each column represents a different data category or metric. The headers organize the information for easy reference and analysis.`;
    }
  }
  
  // Content-based responses
  if (contextText.includes('revenue') || contextText.includes('sales') || contextText.includes('financial')) {
    return `Based on the document, I found financial information including revenue and sales data. The document shows: ${contextText.substring(0, 300)}...`;
  }
  
  if (contextText.includes('forecast') || contextText.includes('outlook') || contextText.includes('prediction')) {
    return `According to the document, there are forecasts and outlook information: ${contextText.substring(0, 300)}...`;
  }
  
  if (contextText.includes('data') || contextText.includes('analysis') || contextText.includes('results')) {
    return `The document contains analytical information and data: ${contextText.substring(0, 300)}...`;
  }
  
  // Generic response with context
  return `Based on the information in the document: ${contextText.substring(0, 400)}${contextText.length > 400 ? '...' : ''}`;
};

/**
 * Generate a response based on web search results
 */
const generateResponseFromWebResults = async (
  question: string,
  results: string[]
): Promise<string> => {
  // Simulate LLM generation time
  await new Promise((resolve) => setTimeout(resolve, 1000));
  
  return `I couldn't find information about this in the document, but based on a web search: ${results.join(' ')}`;
};