import { Document } from '../types';
import { setupVectorDb } from './vectorDbService';
import { TextItem } from 'pdfjs-dist/types/src/display/api';
import * as PDFJS from 'pdfjs-dist';

// Initialize PDF.js worker
const pdfjsVersion = '3.11.174';
const pdfjsWorker = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsVersion}/pdf.worker.min.js`;
PDFJS.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * Process a document by extracting text and storing it in the vector database
 */
export const processDocument = async (document: Document): Promise<void> => {
  try {
    console.log(`Processing document: ${document.name}`);
    
    // Extract text from PDF
    const text = await extractTextFromPdf(document.file);
    
    // Split text into chunks
    const chunks = chunkText(text);
    
    // Store chunks in vector DB
    await setupVectorDb({
      collectionName: `pdf_${document.id}`,
      chunks,
    });
    
    console.log(`Document processed successfully: ${document.name}`);
    return Promise.resolve();
  } catch (error) {
    console.error('Error in document processing:', error);
    throw error;
  }
};

/**
 * Extract text from a PDF file
 */
export const extractTextFromPdf = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFJS.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .filter((item: TextItem) => item.str.trim().length > 0)
        .map((item: TextItem) => item.str)
        .join(' ');
      fullText += pageText + ' ';
    }

    return fullText.trim();
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error('Failed to extract text from PDF');
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