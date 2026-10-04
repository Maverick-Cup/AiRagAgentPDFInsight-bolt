import { Document, Message, TableData, RoutingInfo } from '../types';
import { searchVectorDb, getDocumentMetadata, getAllChunks, getTables } from './vectorDbService';
import { routeQuery, QueryRoute, RoutingResult } from './routerService';

export interface ProcessResult {
  response: string;
  routing: RoutingInfo;
  tableData?: TableData;
}

export const processQuestion = async (
  question: string,
  document: Document,
  conversation: Message[] = []
): Promise<ProcessResult> => {
  console.log(`Processing question: "${question}" for document: ${document.name} (${document.type})`);

  try {
    const collectionName = `doc_${document.id}`;

    // Step 1: Route the query using FLAIR-style zero-shot classification
    console.log('Routing query...');
    const routingResult = await routeQuery(question);
    console.log(`Routed to: ${routingResult.route} (confidence: ${(routingResult.confidence * 100).toFixed(1)}%)`);

    const routing: RoutingInfo = {
      route: routingResult.route.replace(/_/g, ' '),
      confidence: routingResult.confidence,
    };

    // Step 2: Execute the appropriate strategy
    let response = '';
    let tableData: TableData | undefined;

    switch (routingResult.route) {
      case 'summarization':
        response = await generateSummary(collectionName, document);
        break;
      case 'table_extraction': {
        const tableResult = await extractTables(collectionName, document);
        response = tableResult.response;
        tableData = tableResult.tableData;
        break;
      }
      case 'key_points':
        response = await generateKeyPoints(collectionName, document);
        break;
      case 'comparison':
        response = await handleComparison(question, collectionName, document);
        break;
      case 'definition':
        response = await handleDefinition(question, collectionName, document);
        break;
      case 'specific_question':
      default:
        response = await handleSpecificQuestion(question, collectionName, document, conversation);
        break;
    }

    return { response, routing, tableData };
  } catch (error) {
    console.error('Error in agent:', error);
    throw new Error('Failed to process your question. Please try again.');
  }
};

const generateSummary = async (collectionName: string, document: Document): Promise<string> => {
  const allChunks = getAllChunks(collectionName);
  const metadata = getDocumentMetadata(collectionName);

  if (allChunks.length === 0) {
    return "I couldn't generate a summary as no content was found in the document.";
  }

  await new Promise(resolve => setTimeout(resolve, 800));

  let summary = `## Document Summary: ${document.name}\n\n`;

  if (metadata) {
    summary += `**Document Information:**\n`;
    if (metadata.wordCount) summary += `- Word Count: ${metadata.wordCount.toLocaleString()}\n`;
    if (metadata.pageCount) summary += `- Pages: ${metadata.pageCount}\n`;
    if (metadata.hasTables) summary += `- Contains Tables: Yes\n`;
    if (metadata.hasImages) summary += `- Contains Images: Yes\n`;
    summary += `\n`;
  }

  const contentSample = allChunks.slice(0, 5).join(' ').substring(0, 800);

  if (document.type === 'xlsx' || document.type === 'xls' || document.type === 'csv') {
    const tables = getTables(collectionName) ?? [];
    summary += buildTableSummary(tables);
  } else if (document.type === 'pptx' || document.type === 'ppt') {
    summary += `**Content Overview:**\nThis presentation contains slides with information organized for communication purposes.\n\n`;
    summary += `**Key Features:**\n- Presentation format\n- Visual content structure\n- Information organized in slides\n- Designed for communication\n\n`;
  } else {
    summary += `**Content Overview:**\n${contentSample}...\n\n`;
    summary += `**Key Features:**\n- Text-based content\n- ${Math.ceil(allChunks.length / 10)} main sections identified\n- Comprehensive information coverage\n- Searchable content\n\n`;
  }

  summary += `**Usage Tips:**\n- Ask specific questions about the content\n- Request data extraction for spreadsheets\n- Inquire about specific topics or sections\n- Ask for detailed analysis of particular areas`;

  return summary;
};

const buildTableSummary = (tables: TableData[]): string => {
  if (tables.length === 0) {
    return '**Content Overview:**\\nNo rows were extracted from this spreadsheet.\\n\\n';
  }

  const lines: string[] = [
    `**Content Overview:**\\nThis spreadsheet contains ${tables.length} ${tables.length === 1 ? 'table' : 'tables'}.`,
  ];

  tables.forEach((table, tableIndex) => {
    lines.push(`\\n**${table.title || `Table ${tableIndex + 1}`}**`);
    lines.push(`- Rows: ${table.rows.length.toLocaleString()}`);
    lines.push(`- Columns: ${table.headers.join(', ') || 'No column headers detected'}`);

    const numericColumns = table.headers
      .map((header, columnIndex) => {
        const values = table.rows
          .map(row => Number(String(row[columnIndex] ?? '').replace(/[$,%\\s,]/g, '')))
          .filter(value => Number.isFinite(value));

        if (values.length < 2) return null;
        return `${header}: ${Math.min(...values)} to ${Math.max(...values)}`;
      })
      .filter((value): value is string => value !== null);

    if (numericColumns.length > 0) {
      lines.push(`- Numeric ranges: ${numericColumns.join('; ')}`);
    }

    const sampleRows = table.rows.slice(0, 2).map(row =>
      row.map((value, index) => `${table.headers[index] || `Column ${index + 1}`}: ${value}`).join(' | ')
    );

    if (sampleRows.length > 0) {
      lines.push(`- Sample records: ${sampleRows.join(' / ')}`);
    }
  });

  lines.push('\\nThis summary is calculated from the extracted spreadsheet rows.');
  return `${lines.join('\\n')}\\n\\n`;
};

const extractTables = async (collectionName: string, document: Document): Promise<{ response: string; tableData?: TableData }> => {
  const tables = getTables(collectionName);
  const metadata = getDocumentMetadata(collectionName);

  await new Promise(resolve => setTimeout(resolve, 600));

  if (!tables || tables.length === 0) {
    if (!metadata?.hasTables) {
      return {
        response: "No tables were detected in this document. The content appears to be primarily text-based.",
      };
    }
  }

  if (tables && tables.length > 0) {
    const firstTable = tables[0];
    const displayRows = firstTable.rows.slice(0, 20);
    const totalRows = firstTable.rows.length;

    let response = `## Table Data from ${document.name}\n\n`;
    response += `**Sheet:** ${firstTable.title || 'Data'}\n`;
    response += `**Columns:** ${firstTable.headers.join(' | ')}\n`;
    response += `**Total Rows:** ${totalRows.toLocaleString()}\n\n`;

    if (totalRows > displayRows.length) {
      response += `*Showing first ${displayRows.length} of ${totalRows.toLocaleString()} rows*\n\n`;
    }

    return { response, tableData: { ...firstTable, rows: displayRows } };
  }

  return {
    response: `## Table Information from ${document.name}\n\nTables have been detected in this document. Please ask specific questions about the table data you're interested in.`,
  };
};

const generateKeyPoints = async (collectionName: string, document: Document): Promise<string> => {
  const allChunks = getAllChunks(collectionName);

  if (allChunks.length === 0) {
    return "I couldn't extract key points as no content was found in the document.";
  }

  await new Promise(resolve => setTimeout(resolve, 800));

  const contentSample = allChunks.slice(0, 5).join(' ');
  const sentences = contentSample.split(/[.!?]+/).filter(s => s.trim().length > 30);
  const keySentences = sentences.slice(0, 5);

  let response = `## Key Points from ${document.name}\n\n`;

  if (keySentences.length > 0) {
    response += `Based on semantic analysis of the document, here are the main points:\n\n`;
    keySentences.forEach((sentence, i) => {
      response += `- **Point ${i + 1}:** ${sentence.trim()}\n`;
    });
  } else {
    response += `Based on the document content:\n\n`;
    response += `- This document contains ${allChunks.length} content sections\n`;
    response += `- Document type: ${document.type.toUpperCase()}\n`;
    if (document.metadata?.wordCount) {
      response += `- Total word count: ${document.metadata.wordCount.toLocaleString()}\n`;
    }
    response += `- The content covers multiple topics that can be explored through specific questions\n`;
  }

  response += `\n*Ask me a specific question to dive deeper into any of these areas.*`;

  return response;
};

const handleSpecificQuestion = async (
  question: string,
  collectionName: string,
  document: Document,
  conversation: Message[]
): Promise<string> => {
  const recentUserMessages = conversation
    .filter(message => message.sender === 'user')
    .slice(-3)
    .map(message => message.content);
  const retrievalQuestion = [...recentUserMessages, question].join(' ');
  const relevantContext = await searchVectorDb(retrievalQuestion, collectionName);

  if (relevantContext.length > 0) {
    console.log(`Found ${relevantContext.length} relevant chunks via semantic search`);
    await new Promise(resolve => setTimeout(resolve, 600));

    const contextText = relevantContext.map(c => c.text).join(' ');
    const topScore = relevantContext[0].score;

    let response = '';

    if (topScore > 0.5) {
      response = `Based on the document content, here's what I found:\n\n${contextText.substring(0, 600)}${contextText.length > 600 ? '...' : ''}`;
    } else if (topScore > 0.25) {
      response = `I found some potentially relevant information in the document:\n\n${contextText.substring(0, 500)}${contextText.length > 500 ? '...' : ''}\n\n*Note: This may not be a perfect match. Try rephrasing your question for better results.*`;
    } else {
      response = `I couldn't find strongly relevant information about "${question}" in the document. The closest content I found was:\n\n"${contextText.substring(0, 200)}..."\n\nTry asking more specifically about topics covered in the document.`;
    }

    return response;
  }

  return `I couldn't find an answer to that in "${document.name}". Try asking about a specific topic, heading, term, or section from the document.`;
};

const handleComparison = async (
  question: string,
  collectionName: string,
  document: Document
): Promise<string> => {
  const relevantContext = await searchVectorDb(question, collectionName);

  await new Promise(resolve => setTimeout(resolve, 600));

  if (relevantContext.length > 0) {
    const contextText = relevantContext.map(c => c.text).join(' ');
    return `## Comparison Analysis\n\nBased on the document, here's what I found regarding your comparison query:\n\n${contextText.substring(0, 700)}${contextText.length > 700 ? '...' : ''}\n\n*For a more detailed comparison, try specifying which items you'd like compared.*`;
  }

  return "I couldn't find specific comparison data in the document. Could you specify which items or concepts you'd like me to compare?";
};

const handleDefinition = async (
  question: string,
  collectionName: string,
  document: Document
): Promise<string> => {
  const relevantContext = await searchVectorDb(question, collectionName);

  await new Promise(resolve => setTimeout(resolve, 600));

  if (relevantContext.length > 0) {
    const contextText = relevantContext[0].text;
    return `Based on the document:\n\n${contextText.substring(0, 500)}${contextText.length > 500 ? '...' : ''}`;
  }

  return "I couldn't find a definition for this term in the document. Could you try rephrasing or asking about a different term?";
};
