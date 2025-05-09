import React from 'react';
import { DocumentPanel } from '../components/DocumentPanel';
import { ChatPanel } from '../components/ChatPanel';
import { useAppContext } from '../context/AppContext';

export const Dashboard: React.FC = () => {
  const { activeDocumentId } = useAppContext();

  return (
    <div className="flex flex-col md:flex-row gap-6 min-h-[calc(100vh-12rem)]">
      <div className="w-full md:w-1/3 lg:w-1/4">
        <DocumentPanel />
      </div>
      <div className="w-full md:w-2/3 lg:w-3/4">
        {activeDocumentId ? (
          <ChatPanel />
        ) : (
          <div className="h-full flex flex-col items-center justify-center bg-white rounded-lg shadow-md p-8 text-center">
            <h2 className="text-2xl font-semibold text-gray-700 mb-3">
              No Document Selected
            </h2>
            <p className="text-gray-500 max-w-md">
              Upload and select a PDF document from the panel on the left to start
              a conversation about its contents.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};