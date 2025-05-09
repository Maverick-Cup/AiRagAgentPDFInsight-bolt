import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import { getDocumentById } from '../utils/helpers';
import { processQuestion } from '../services/agentService';

export const ChatPanel: React.FC = () => {
  const { 
    documents, 
    activeDocumentId, 
    messages, 
    addMessage, 
    isProcessing, 
    setIsProcessing 
  } = useAppContext();
  
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  const activeDocument = activeDocumentId 
    ? getDocumentById(documents, activeDocumentId) 
    : null;

  useEffect(() => {
    // Scroll to bottom of messages
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    // Focus input when activeDocument changes
    if (activeDocument && inputRef.current) {
      inputRef.current.focus();
    }
  }, [activeDocument]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || !activeDocument || isProcessing) return;
    
    // Add user message
    addMessage({
      content: input,
      sender: 'user',
      timestamp: new Date().toISOString(),
    });
    
    setInput('');
    setIsProcessing(true);
    
    try {
      // Process the question with the RAG agent
      const response = await processQuestion(input, activeDocument);
      
      // Add AI response
      addMessage({
        content: response,
        sender: 'ai',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error processing question:', error);
      
      // Add error message
      addMessage({
        content: 'Sorry, I encountered an error processing your question. Please try again.',
        sender: 'ai',
        timestamp: new Date().toISOString(),
        isError: true,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  if (!activeDocument) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-md flex flex-col h-full">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">
          Chat with {activeDocument.name}
        </h2>
        <p className="text-sm text-gray-500">
          Ask questions about the content of this document
        </p>
      </div>
      
      <div className="flex-grow overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
            <Bot className="h-12 w-12 text-blue-500 mb-2" />
            <p className="max-w-md">
              I'm your PDF assistant. Ask me anything about the document and I'll try to answer
              based on its contents. If I can't find the answer in the document, I'll search the web.
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex items-start ${
                message.sender === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.sender === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-none'
                    : message.isError
                    ? 'bg-red-100 text-red-800 rounded-tl-none'
                    : 'bg-gray-100 text-gray-800 rounded-tl-none'
                }`}
              >
                <div className="flex items-center space-x-2 mb-1">
                  {message.sender === 'user' ? (
                    <>
                      <span className="font-medium">You</span>
                      <User className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      <Bot className="h-4 w-4" />
                      <span className="font-medium">Assistant</span>
                    </>
                  )}
                </div>
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200">
        <div className="flex items-end space-x-2">
          <div className="flex-grow relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about the document..."
              className="w-full border border-gray-300 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={1}
              disabled={isProcessing}
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isProcessing}
            className={`bg-blue-600 text-white rounded-full p-2 ${
              !input.trim() || isProcessing
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-blue-700'
            } transition-colors duration-200`}
          >
            {isProcessing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
};