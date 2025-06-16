import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useAppContext } from '../context/AppContext';
import { v4 as uuidv4 } from 'uuid';
import { FileText, FilePlus2, AlertTriangle, Info } from 'lucide-react';
import { processDocument } from '../services/documentService';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export const DocumentPanel: React.FC = () => {
  const { documents, addDocument, removeDocument, setDocumentStatus, setActiveDocumentId, activeDocumentId } = useAppContext();

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      acceptedFiles.forEach(async (file) => {
        if (file.type === 'application/pdf') {
          if (file.size > MAX_FILE_SIZE) {
            alert('File size exceeds the maximum limit of 100MB');
            return;
          }

          const newDoc = {
            id: uuidv4(),
            name: file.name,
            size: file.size,
            file,
            status: 'uploading',
            createdAt: new Date().toISOString(),
          };
          
          addDocument(newDoc);
          
          try {
            setDocumentStatus(newDoc.id, 'processing');
            await processDocument(newDoc);
            setDocumentStatus(newDoc.id, 'ready');
            
            // Automatically set this document as active when processing is complete
            setActiveDocumentId(newDoc.id);
          } catch (error) {
            console.error('Error processing document:', error);
            setDocumentStatus(newDoc.id, 'error');
          }
        }
      });
    },
    [addDocument, setDocumentStatus, setActiveDocumentId]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    maxSize: MAX_FILE_SIZE,
  });

  const handleDocumentClick = (id: string) => {
    setActiveDocumentId(id);
  };

  const handleRemoveDocument = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    removeDocument(id);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 h-full flex flex-col">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Your Documents</h2>
      
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 mb-4 transition-colors duration-200 ${
          isDragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center text-center">
          <FilePlus2 className="h-10 w-10 text-blue-500 mb-2" />
          <p className="text-sm text-gray-600">
            {isDragActive
              ? 'Drop the PDF here...'
              : 'Drag & drop a PDF file here, or click to select'}
          </p>
          <div className="flex items-center mt-2 text-xs text-gray-500">
            <Info className="h-4 w-4 mr-1" />
            <span>Maximum file size: 100MB</span>
          </div>
        </div>
      </div>
      
      <div className="flex-grow overflow-y-auto">
        {documents.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>No documents yet</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {documents.map((doc) => (
              <li
                key={doc.id}
                onClick={() => handleDocumentClick(doc.id)}
                className={`p-3 rounded-md cursor-pointer transition-all duration-200 flex items-start ${
                  activeDocumentId === doc.id
                    ? 'bg-blue-100 border-l-4 border-blue-500'
                    : 'hover:bg-gray-100 border-l-4 border-transparent'
                }`}
              >
                <FileText className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0 mt-1" />
                <div className="flex-grow">
                  <h3 className="font-medium text-gray-900 truncate" title={doc.name}>
                    {doc.name}
                  </h3>
                  <div className="flex justify-between items-center mt-1">
                    <div className="text-xs text-gray-500">
                      {(doc.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                    <div>
                      {doc.status === 'uploading' && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                          Uploading...
                        </span>
                      )}
                      {doc.status === 'processing' && (
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                          Processing...
                        </span>
                      )}
                      {doc.status === 'ready' && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                          Ready
                        </span>
                      )}
                      {doc.status === 'error' && (
                        <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full flex items-center">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Error
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={(e) => handleRemoveDocument(e, doc.id)}
                  className="ml-2 text-red-500 hover:text-red-700 transition-colors"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};