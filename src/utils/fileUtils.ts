import { DocumentType } from '../types';

/**
 * Get the document type based on file extension and MIME type
 */
export const getDocumentType = (file: File): DocumentType => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const mimeType = file.type.toLowerCase();

  // PDF
  if (extension === 'pdf' || mimeType === 'application/pdf') {
    return 'pdf';
  }

  // Word documents
  if (extension === 'docx' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return 'docx';
  }
  if (extension === 'doc' || mimeType === 'application/msword') {
    return 'doc';
  }

  // PowerPoint
  if (extension === 'pptx' || mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
    return 'pptx';
  }
  if (extension === 'ppt' || mimeType === 'application/vnd.ms-powerpoint') {
    return 'ppt';
  }

  // Excel
  if (extension === 'xlsx' || mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
    return 'xlsx';
  }
  if (extension === 'xls' || mimeType === 'application/vnd.ms-excel') {
    return 'xls';
  }

  // Text files
  if (extension === 'txt' || mimeType === 'text/plain') {
    return 'txt';
  }
  if (extension === 'rtf' || mimeType === 'application/rtf' || mimeType === 'text/rtf') {
    return 'rtf';
  }

  // CSV
  if (extension === 'csv' || mimeType === 'text/csv') {
    return 'csv';
  }

  return 'unknown';
};

/**
 * Get supported file formats for dropzone
 */
export const getSupportedFormats = () => {
  return {
    'application/pdf': ['.pdf'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
    'application/vnd.ms-powerpoint': ['.ppt'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    'application/vnd.ms-excel': ['.xls'],
    'text/plain': ['.txt'],
    'application/rtf': ['.rtf'],
    'text/rtf': ['.rtf'],
    'text/csv': ['.csv'],
  };
};

/**
 * Get file type display name
 */
export const getFileTypeDisplayName = (type: DocumentType): string => {
  const displayNames: Record<DocumentType, string> = {
    pdf: 'PDF Document',
    docx: 'Word Document',
    doc: 'Word Document (Legacy)',
    pptx: 'PowerPoint Presentation',
    ppt: 'PowerPoint Presentation (Legacy)',
    xlsx: 'Excel Spreadsheet',
    xls: 'Excel Spreadsheet (Legacy)',
    txt: 'Text Document',
    rtf: 'Rich Text Document',
    csv: 'CSV Spreadsheet',
    unknown: 'Unknown Format',
  };

  return displayNames[type] || 'Unknown Format';
};