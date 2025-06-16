import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { Send, Bot, User, Loader2, Table, FileText, BarChart3 } from 'lucide-react';
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

  const handleQuickAction = (action: string) => {
    setInput(action);
    inputRef.current?.focus();
  };

  // Format message content for better readability
  const formatMessageContent = (content: string) => {
    // Split content into paragraphs and format
    const paragraphs = content.split('\n\n').filter(p => p.trim());
    
    return paragraphs.map((paragraph, index) => {
      // Handle headers (##)
      if (paragraph.startsWith('## ')) {
        return (
          <h3 key={index} className="text-lg font-bold mb-3 mt-4 text-gray-900 border-b border-gray-200 pb-2">
            {paragraph.replace('## ', '')}
          </h3>
        );
      }
      
      // Handle bold text (**text**)
      if (paragraph.includes('**')) {
        const parts = paragraph.split(/(\*\*.*?\*\*)/g);
        return (
          <p key={index} className="mb-3 leading-relaxed">
            {parts.map((part, partIndex) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return (
                  <strong key={partIndex} className="font-semibold text-gray-900">
                    {part.slice(2, -2)}
                  </strong>
                );
              }
              return part;
            })}
          </p>
        );
      }
      
      // Handle bullet points
      if (paragraph.includes('- ')) {
        const lines = paragraph.split('\n');
        const listItems = [];
        const regularLines = [];
        
        lines.forEach(line => {
          if (line.trim().startsWith('- ')) {
            listItems.push(line.trim().substring(2));
          } else if (line.trim()) {
            regularLines.push(line.trim());
          }
        });
        
        return (
          <div key={index} className="mb-3">
            {regularLines.length > 0 && (
              <p className="mb-2 leading-relaxed">{regularLines.join(' ')}</p>
            )}
            {listItems.length > 0 && (
              <ul className="list-disc list-inside space-y-1 ml-4">
                {listItems.map((item, itemIndex) => (
                  <li key={itemIndex} className="text-sm leading-relaxed">{item}</li>
                ))}
              </ul>
            )}
          </div>
        );
      }
      
      // Regular paragraphs
      return (
        <p key={index} className="mb-3 leading-relaxed">
          {paragraph}
        </p>
      );
    });
  };

  if (!activeDocument) {
    return null;
  }

  const getDocumentTypeInfo = () => {
    switch (activeDocument.type) {
      case 'xlsx':
      case 'xls':
      case 'csv':
        return {
          icon: <Table className="h-5 w-5 text-green-600" />,
          description: 'Spreadsheet with structured data and tables',
          suggestions: [
            'Summarize this spreadsheet',
            'Show me the table data',
            'What columns are in this data?',
            'Calculate totals from the data'
          ]
        };
      case 'pptx':
      case 'ppt':
        return {
          icon: <BarChart3 className="h-5 w-5 text-orange-600" />,
          description: 'Presentation with slides and visual content',
          suggestions: [
            'Summarize this presentation',
            'What are the main topics?',
            'Extract key points',
            'What data is presented?'
          ]
        };
      default:
        return {
          icon: <FileText className="h-5 w-5 text-blue-600" />,
          description: 'Document with text content',
          suggestions: [
            'Summarize this document',
            'What are the main points?',
            'Extract key information',
            'Find specific topics'
          ]
        };
    }
  };

  const docInfo = getDocumentTypeInfo();

  return (
    <div className="bg-white rounded-lg shadow-md flex flex-col h-full">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center space-x-2 mb-2">
          {docInfo.icon}
          <h2 className="text-lg font-semibold text-gray-800">
            Chat with {activeDocument.name}
          </h2>
        </div>
        <p className="text-sm text-gray-500 mb-3">
          {docInfo.description}
        </p>
        
        {/* Document metadata */}
        {activeDocument.metadata && (
          <div className="flex flex-wrap gap-2 text-xs text-gray-600">
            {activeDocument.metadata.wordCount && (
              <span className="bg-blue-100 px-2 py-1 rounded">
                {activeDocument.metadata.wordCount.toLocaleString()} words
              </span>
            )}
            {activeDocument.metadata.pageCount && (
              <span className="bg-green-100 px-2 py-1 rounded">
                {activeDocument.metadata.pageCount} pages
              </span>
            )}
            {activeDocument.metadata.hasTables && (
              <span className="bg-purple-100 px-2 py-1 rounded">
                Contains tables
              </span>
            )}
            {activeDocument.metadata.hasImages && (
              <span className="bg-orange-100 px-2 py-1 rounded">
                Contains images
              </span>
            )}
          </div>
        )}
      </div>
      
      <div className="flex-grow overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Bot className="h-12 w-12 text-blue-500 mb-4" />
            <p className="text-gray-600 mb-4 max-w-md">
              I'm your intelligent document assistant. I can analyze, summarize, and extract information from your {activeDocument.type.toUpperCase()} file.
            </p>
            
            {/* Quick action buttons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 w-full max-w-md">
              {docInfo.suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleQuickAction(suggestion)}
                  className="text-left p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors duration-200 text-sm"
                >
                  {suggestion}
                </button>
              ))}
            </div>
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
                className={`max-w-[85%] rounded-lg p-4 ${
                  message.sender === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-none'
                    : message.isError
                    ? 'bg-red-100 text-red-800 rounded-tl-none'
                    : 'bg-gray-50 text-gray-800 rounded-tl-none border border-gray-200'
                }`}
              >
                <div className="flex items-center space-x-2 mb-3">
                  {message.sender === 'user' ? (
                    <>
                      <span className="font-medium text-sm">You</span>
                      <User className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      <Bot className="h-4 w-4 text-blue-600" />
                      <span className="font-medium text-sm text-blue-600">Assistant</span>
                    </>
                  )}
                </div>
                <div className="prose prose-sm max-w-none">
                  {message.sender === 'user' ? (
                    <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                  ) : (
                    <div className="text-sm">
                      {formatMessageContent(message.content)}
                    </div>
                  )}
                </div>
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
              placeholder={`Ask about your ${activeDocument.type.toUpperCase()} document...`}
              className="w-full border border-gray-300 rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={1}
              disabled={isProcessing}
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isProcessing}
            className={`bg-blue-600 text-white rounded-full p-3 ${
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