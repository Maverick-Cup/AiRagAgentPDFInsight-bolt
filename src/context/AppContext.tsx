import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { Document, Message } from '../types';
import { v4 as uuidv4 } from 'uuid';

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
}

interface AppContextType {
  documents: Document[];
  addDocument: (doc: Document) => void;
  removeDocument: (id: string) => void;
  setDocumentStatus: (id: string, status: 'uploading' | 'processing' | 'ready' | 'error') => void;
  activeDocumentId: string | null;
  setActiveDocumentId: (id: string | null) => void;
  sessions: ChatSession[];
  activeSessionId: string;
  createSession: () => void;
  setActiveSessionId: (id: string) => void;
  messages: Message[];
  addMessage: (message: Omit<Message, 'id'>) => void;
  clearMessages: () => void;
  isProcessing: boolean;
  setIsProcessing: (value: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);
const SESSION_STORAGE_KEY = 'document-ai-sessions-v1';
const DEFAULT_SESSION_TITLE = 'New conversation';

type StoredSessionState = {
  sessions: ChatSession[];
  messagesBySession: Record<string, Message[]>;
};

const createChatSession = (): ChatSession => ({
  id: uuidv4(),
  title: DEFAULT_SESSION_TITLE,
  createdAt: new Date().toISOString(),
});

const getInitialSessionState = (): StoredSessionState => {
  const session = createChatSession();
  return { sessions: [session], messagesBySession: { [session.id]: [] } };
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const initialState = getInitialSessionState();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>(initialState.sessions);
  const [activeSessionId, setActiveSessionId] = useState(initialState.sessions[0].id);
  const [messagesBySession, setMessagesBySession] = useState<Record<string, Message[]>>(initialState.messagesBySession);
  const [isProcessing, setIsProcessing] = useState(false);
  const hasLoadedState = useRef(false);

  useEffect(() => {
    const savedDocuments = localStorage.getItem('documents');
    const savedSessionState = localStorage.getItem(SESSION_STORAGE_KEY);
    const savedActiveDocumentId = localStorage.getItem('activeDocumentId');

    if (savedDocuments) {
      setDocuments(JSON.parse(savedDocuments));
    }

    if (savedSessionState) {
      const parsedState = JSON.parse(savedSessionState) as StoredSessionState;
      if (parsedState.sessions.length > 0) {
        setSessions(parsedState.sessions);
        setMessagesBySession(parsedState.messagesBySession);
        setActiveSessionId(parsedState.sessions[0].id);
      }
    }

    if (savedActiveDocumentId) {
      setActiveDocumentId(savedActiveDocumentId);
    }

    hasLoadedState.current = true;
  }, []);

  useEffect(() => {
    localStorage.setItem('documents', JSON.stringify(documents));
  }, [documents]);

  useEffect(() => {
    if (hasLoadedState.current) {
      localStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({ sessions, messagesBySession })
      );
    }
  }, [sessions, messagesBySession]);

  useEffect(() => {
    if (activeDocumentId) {
      localStorage.setItem('activeDocumentId', activeDocumentId);
    } else {
      localStorage.removeItem('activeDocumentId');
    }
  }, [activeDocumentId]);

  const addDocument = (doc: Document) => {
    setDocuments(previousDocuments => [...previousDocuments, doc]);
  };

  const removeDocument = (id: string) => {
    setDocuments(previousDocuments => previousDocuments.filter(doc => doc.id !== id));
    if (activeDocumentId === id) {
      setActiveDocumentId(null);
      clearMessages();
    }
  };

  const setDocumentStatus = (id: string, status: 'uploading' | 'processing' | 'ready' | 'error') => {
    setDocuments(previousDocuments =>
      previousDocuments.map(doc => (doc.id === id ? { ...doc, status } : doc))
    );
  };

  const createSession = () => {
    const session = createChatSession();
    setSessions(previousSessions => [session, ...previousSessions]);
    setMessagesBySession(previousMessages => ({ ...previousMessages, [session.id]: [] }));
    setActiveSessionId(session.id);
    setIsProcessing(false);
  };

  const addMessage = (message: Omit<Message, 'id'>) => {
    const newMessage = { ...message, id: uuidv4() };
    setMessagesBySession(previousMessages => ({
      ...previousMessages,
      [activeSessionId]: [...(previousMessages[activeSessionId] ?? []), newMessage],
    }));

    if (message.sender === 'user') {
      setSessions(previousSessions => previousSessions.map(session => {
        if (session.id !== activeSessionId || session.title !== DEFAULT_SESSION_TITLE) {
          return session;
        }
        return { ...session, title: message.content.slice(0, 42) || DEFAULT_SESSION_TITLE };
      }));
    }
  };

  const clearMessages = () => {
    setMessagesBySession(previousMessages => ({ ...previousMessages, [activeSessionId]: [] }));
  };

  const messages = messagesBySession[activeSessionId] ?? [];

  return (
    <AppContext.Provider
      value={{
        documents,
        addDocument,
        removeDocument,
        setDocumentStatus,
        activeDocumentId,
        setActiveDocumentId,
        sessions,
        activeSessionId,
        createSession,
        setActiveSessionId,
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