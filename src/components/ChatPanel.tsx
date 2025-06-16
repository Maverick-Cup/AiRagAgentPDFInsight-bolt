import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { Send, Bot, User, Loader2, Table, FileText, BarChart3, AlertCircle, RefreshCw } from 'lucide-react';
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
  const [retryCount, setRetryCount] = useState(0);
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
    
    const userMessage = input.trim();
    setInput('');
    setRetryCount(0);
    
    // Add user message
    addMessage({
      content: userMessage,
      sender: 'user',
      timestamp: new Date().toISOString(),
    });
    
    setIsProcessing(true);
    
    try {
      // Process the question with the RAG agent
      const response = await processQuestion(userMessage, activeDocument);
      
      // Add AI response
      addMessage({
        content: response,
        sender: 'ai',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error processing question:', error);
      
      let errorMessage = 'I encountered an error processing your question. Please try again.';
      let canRetry = false;
      
      if (error instanceof Error) {
        if (error.message.includes('loading')) {
          errorMessage = 'The AI model is currently starting up. This usually takes 10-20 seconds. Please try again in a moment.';
          canRetry = true;
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = 'There was a network issue. Please check your connection and try again.';
          canRetry = true;
        }
      }
      
      // Add error message
      addMessage({
        content: errorMessage,
        sender: 'ai',
        timestamp: new Date().toISOString(),
        isError: true,
      });
      
      // If it's a retryable error and we haven't retried too many times, suggest retry
      if (canRetry && retryCount < 2) {
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
        }, 1000);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetry = async () => {
    const lastUserMessage = messages.filter(m => m.sender === 'user').pop();
    if (lastUserMessage && !isProcessing) {
      setInput(lastUserMessage.content);
      inputRef.current?.focus();
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
            'What data is in this file?',
            'Show me the key insights',
            'Analyze the numerical data'
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
            'What insights are presented?'
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
            'Explain the content'
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
            AI Chat with {activeDocument.name}
          </h2>
          <div className="ml-auto">
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
              Powered by FastChat-T5
            </span>
          </div>
        </div>
        <p className="text-sm text-gray-500 mb-3">
          {docInfo.description} • Advanced AI analysis with Hugging Face
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
              I'm your intelligent document assistant powered by advanced AI. I can analyze, summarize, and extract insights from your {activeDocument.type.toUpperCase()} file with high accuracy.
            </p>
            
            {/* Quick action buttons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 w-full max-w-md">
              {docInfo.suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleQuickAction(suggestion)}
                  className="text-left p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors duration-200 text-sm border border-gray-200 hover:border-blue-300"
                >
                  {suggestion}
                </button>
              ))}
            </div>
            
            <div className="mt-4 text-xs text-gray-500 bg-blue-50 p-3 rounded-lg">
              <div className="flex items-center justify-center space-x-1">
                <Bot className="h-4 w-4" />
                <span>Responses are generated using FastChat-T5 AI model for maximum accuracy</span>
              </div>
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
                    ? 'bg-red-50 text-red-800 rounded-tl-none border border-red-200'
                    : 'bg-gray-50 text-gray-800 rounded-tl-none border border-gray-200'
                }`}
              >
                <div className="flex items-center space-x-2 mb-2">
                  {message.sender === 'user' ? (
                    <>
                      <span className="font-medium text-sm">You</span>
                      <User className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      <Bot className="h-4 w-4" />
                      <span className="font-medium text-sm">
                        AI Assistant
                        {!message.isError && (
                          <span className="ml-1 text-xs opacity-75">• FastChat-T5</span>
                        )}
                      </span>
                      {message.isError && (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      )}
                    </>
                  )}
                </div>
                <div className="prose prose-sm max-w-none">
                  {message.content.includes('##') ? (
                    // Render markdown-style content
                    <div 
                      className="whitespace-pre-wrap"
                      dangerouslySetInnerHTML={{
                        __html: message.content
                          .replace(/## (.*)/g, '<h3 class="font-bold text-lg mb-2 mt-4">$1</h3>')
                          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                          .replace(/- (.*)/g, '<li class="ml-4">$1</li>')
                          .replace(/\n\n/g, '<br><br>')
                      }}
                    />
                  ) : (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  )}
                </div>
                
                {/* Retry button for error messages */}
                {message.isError && message.content.includes('try again') && (
                  <button
                    onClick={handleRetry}
                    className="mt-3 flex items-center space-x-1 text-sm text-red-600 hover:text-red-800 transition-colors"
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span>Retry Question</span>
                  </button>
                )}
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
              placeholder={`Ask about your ${activeDocument.type.toUpperCase()} document... (powered by AI)`}
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
        
        {isProcessing && (
          <div className="mt-2 text-xs text-gray-500 flex items-center space-x-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>AI is analyzing your document and generating a response...</span>
          </div>
        )}
      </form>
    </div>
  );
};