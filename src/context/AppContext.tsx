import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Document, Message } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface AppContextType {
  documents: Document[];
  addDocument: (doc: Document) => void;
  removeDocument: (id: string) => void;
  setDocumentStatus: (id: string, status: 'uploading' | 'processing' | 'ready' | 'error') => void;
  activeDocumentId: string | null;
  setActiveDocumentId: (id: string | null) => void;
  messages: Message[];
  addMessage: (message: Omit<Message, 'id'>) => void;
  clearMessages: () => void;
  isProcessing: boolean;
  setIsProcessing: (value: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Load state from localStorage on component mount
  useEffect(() => {
    const savedDocuments = localStorage.getItem('documents');
    const savedMessages = localStorage.getItem('messages');
    const savedActiveDocumentId = localStorage.getItem('activeDocumentId');

    if (savedDocuments) {
      setDocuments(JSON.parse(savedDocuments));
    }
    if (savedMessages) {
      setMessages(JSON.parse(savedMessages));
    }
    if (savedActiveDocumentId) {
      setActiveDocumentId(savedActiveDocumentId);
    }
  }, []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('documents', JSON.stringify(documents));
  }, [documents]);

  useEffect(() => {
    localStorage.setItem('messages', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (activeDocumentId) {
      localStorage.setItem('activeDocumentId', activeDocumentId);
    } else {
      localStorage.removeItem('activeDocumentId');
    }
  }, [activeDocumentId]);

  const addDocument = (doc: Document) => {
    setDocuments((prev) => [...prev, doc]);
  };

  const removeDocument = (id: string) => {
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
    if (activeDocumentId === id) {
      setActiveDocumentId(null);
      clearMessages();
    }
  };

  const setDocumentStatus = (id: string, status: 'uploading' | 'processing' | 'ready' | 'error') => {
    setDocuments((prev) =>
      prev.map((doc) => (doc.id === id ? { ...doc, status } : doc))
    );
  };

  const addMessage = (message: Omit<Message, 'id'>) => {
    const newMessage = { ...message, id: uuidv4() };
    setMessages((prev) => [...prev, newMessage]);
  };

  const clearMessages = () => {
    setMessages([]);
  };

  return (
    <AppContext.Provider
      value={{
        documents,
        addDocument,
        removeDocument,
        setDocumentStatus,
        activeDocumentId,
        setActiveDocumentId,
        messages,
        addMessage,
        clearMessages,
        isProcessing,
        setIsProcessing,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};