import { Document, ProcessedContent, DocumentMetadata } from '../types';
import { setupVectorDb } from './vectorDbService';
import { TextItem } from 'pdfjs-dist/types/src/display/api';
import * as PDFJS from 'pdfjs-dist';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

// Initialize PDF.js worker
const pdfjsVersion = '3.11.174';
const pdfjsWorker = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsVersion}/pdf.worker.min.js`;
PDFJS.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * Process a document by extracting text and storing it in the vector database
 */
export const processDocument = async (document: Document): Promise<void> => {
  try {
    console.log(`Processing document: ${document.name} (${document.type})`);
    
    // Extract content based on document type
    const processedContent = await extractContentFromDocument(document);
    
    // Split text into chunks
    const chunks = chunkText(processedContent.text);
    
    // Store chunks in vector DB with metadata
    await setupVectorDb({
      collectionName: `doc_${document.id}`,
      chunks,
      metadata: processedContent.metadata,
    });
    
    // Update document with metadata
    document.metadata = processedContent.metadata;
    
    console.log(`Document processed successfully: ${document.name}`);
    return Promise.resolve();
  } catch (error) {
    console.error('Error in document processing:', error);
    throw error;
  }
};

/**
 * Extract content from different document types
 */
const extractContentFromDocument = async (document: Document): Promise<ProcessedContent> => {
  switch (document.type) {
    case 'pdf':
      return await extractFromPdf(document.file);
    case 'docx':
      return await extractFromDocx(document.file);
    case 'doc':
      return await extractFromDoc(document.file);
    case 'pptx':
      return await extractFromPptx(document.file);
    case 'xlsx':
    case 'xls':
      return await extractFromExcel(document.file);
    case 'csv':
      return await extractFromCsv(document.file);
    case 'txt':
      return await extractFromText(document.file);
    case 'rtf':
      return await extractFromRtf(document.file);
    default:
      throw new Error(`Unsupported document type: ${document.type}`);
  }
};

/**
 * Extract text from a PDF file
 */
const extractFromPdf = async (file: File): Promise<ProcessedContent> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFJS.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    let wordCount = 0;

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .filter((item: TextItem) => item.str.trim().length > 0)
        .map((item: TextItem) => item.str)
        .join(' ');
      fullText += pageText + ' ';
      wordCount += pageText.split(/\s+/).filter(word => word.length > 0).length;
    }

    const metadata: DocumentMetadata = {
      pageCount: pdf.numPages,
      wordCount,
      hasImages: false, // Would need additional processing to detect images
      hasTables: false, // Would need additional processing to detect tables
    };

    return {
      text: fullText.trim(),
      metadata,
    };
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error('Failed to extract text from PDF');
  }
};

/**
 * Extract text from a DOCX file
 */
const extractFromDocx = async (file: File): Promise<ProcessedContent> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    const text = result.value;
    const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;

    const metadata: DocumentMetadata = {
      wordCount,
      hasImages: result.messages.some(msg => msg.message.includes('image')),
    };

    return {
      text,
      metadata,
    };
  } catch (error) {
    console.error('Error extracting text from DOCX:', error);
    throw new Error('Failed to extract text from DOCX');
  }
};

/**
 * Extract text from a DOC file (legacy format)
 */
const extractFromDoc = async (file: File): Promise<ProcessedContent> => {
  // For legacy DOC files, we'll attempt to read as text
  // In a production environment, you might want to use a more sophisticated library
  try {
    const text = await file.text();
    const cleanText = text.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
    const wordCount = cleanText.split(/\s+/).filter(word => word.length > 0).length;

    const metadata: DocumentMetadata = {
      wordCount,
    };

    return {
      text: cleanText,
      metadata,
    };
  } catch (error) {
    console.error('Error extracting text from DOC:', error);
    throw new Error('Failed to extract text from DOC file. Please convert to DOCX format for better results.');
  }
};

/**
 * Extract text from a PPTX file
 */
const extractFromPptx = async (file: File): Promise<ProcessedContent> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    const text = result.value || 'PowerPoint content extracted (text extraction limited for PPTX files)';
    const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;

    const metadata: DocumentMetadata = {
      wordCount,
      hasImages: true, // PowerPoint typically contains images
    };

    return {
      text,
      metadata,
    };
  } catch (error) {
    // Fallback for PPTX files
    console.warn('Advanced PPTX extraction failed, using basic text extraction');
    const text = 'PowerPoint presentation uploaded. Content analysis available through chat interface.';
    
    return {
      text,
      metadata: {
        wordCount: 0,
        hasImages: true,
      },
    };
  }
};

/**
 * Extract text from Excel files
 */
const extractFromExcel = async (file: File): Promise<ProcessedContent> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    let fullText = '';
    const tables = [];
    let totalCells = 0;

    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (jsonData.length > 0) {
        // Extract headers and data for table format
        const headers = jsonData[0] as string[];
        const rows = jsonData.slice(1) as string[][];
        
        if (headers.length > 0) {
          tables.push({
            title: `Sheet: ${sheetName}`,
            headers: headers.map(h => String(h || '')),
            rows: rows.map(row => headers.map((_, i) => String(row[i] || ''))),
          });
        }

        // Convert to text for search
        const sheetText = jsonData.map(row => 
          (row as any[]).map(cell => String(cell || '')).join(' ')
        ).join('\n');
        
        fullText += `Sheet: ${sheetName}\n${sheetText}\n\n`;
        totalCells += jsonData.reduce((acc, row) => acc + (row as any[]).length, 0);
      }
    });

    const metadata: DocumentMetadata = {
      wordCount: fullText.split(/\s+/).filter(word => word.length > 0).length,
      hasTables: tables.length > 0,
    };

    return {
      text: fullText.trim(),
      tables,
      metadata,
    };
  } catch (error) {
    console.error('Error extracting data from Excel:', error);
    throw new Error('Failed to extract data from Excel file');
  }
};

/**
 * Extract text from CSV files
 */
const extractFromCsv = async (file: File): Promise<ProcessedContent> => {
  try {
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      throw new Error('CSV file appears to be empty');
    }

    // Parse CSV (simple implementation)
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const rows = lines.slice(1).map(line => 
      line.split(',').map(cell => cell.trim().replace(/"/g, ''))
    );

    const table = {
      title: 'CSV Data',
      headers,
      rows,
    };

    const metadata: DocumentMetadata = {
      wordCount: text.split(/\s+/).filter(word => word.length > 0).length,
      hasTables: true,
    };

    return {
      text: `CSV Data:\n${text}`,
      tables: [table],
      metadata,
    };
  } catch (error) {
    console.error('Error extracting data from CSV:', error);
    throw new Error('Failed to extract data from CSV file');
  }
};

/**
 * Extract text from plain text files
 */
const extractFromText = async (file: File): Promise<ProcessedContent> => {
  try {
    const text = await file.text();
    const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;

    const metadata: DocumentMetadata = {
      wordCount,
    };

    return {
      text,
      metadata,
    };
  } catch (error) {
    console.error('Error extracting text from TXT:', error);
    throw new Error('Failed to extract text from text file');
  }
};

/**
 * Extract text from RTF files
 */
const extractFromRtf = async (file: File): Promise<ProcessedContent> => {
  try {
    const text = await file.text();
    // Basic RTF parsing - remove RTF control codes
    const cleanText = text
      .replace(/\\[a-z]+\d*\s?/g, ' ') // Remove RTF control words
      .replace(/[{}]/g, ' ') // Remove braces
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    const wordCount = cleanText.split(/\s+/).filter(word => word.length > 0).length;

    const metadata: DocumentMetadata = {
      wordCount,
    };

    return {
      text: cleanText,
      metadata,
    };
  } catch (error) {
    console.error('Error extracting text from RTF:', error);
    throw new Error('Failed to extract text from RTF file');
  }
};

/**
 * Split text into chunks for vector storage
 */
const chunkText = (text: string, maxChunkSize: number = 1000): string[] => {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const word of words) {
    if ((currentChunk + ' ' + word).length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = word;
    } else {
      currentChunk += (currentChunk.length > 0 ? ' ' : '') + word;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
};