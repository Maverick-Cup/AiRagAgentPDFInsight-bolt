import React, { ReactNode } from 'react';
import { BookOpenCheck, Github } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-gradient-to-r from-blue-900 to-blue-800 text-white shadow-md">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <BookOpenCheck className="h-7 w-7 text-teal-400" />
            <h1 className="text-xl md:text-2xl font-bold">Multi-Format Document AI Agent</h1>
          </div>
          <nav>
            <a
              href="https://contra.com/harshitpratapshahi"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center text-sm hover:text-teal-300 transition-colors duration-200"
            >
              <Github className="h-5 w-5 mr-1" />
              <span className="hidden md:inline">Github/Contra</span>
            </a>
          </nav>
        </div>
      </header>
      <main className="flex-grow container mx-auto px-4 py-6">
        {children}
      </main>
      <footer className="bg-gray-800 text-gray-300 py-4">
        <div className="container mx-auto px-4 text-center text-sm">
          <p>
            Powered by Advanced Document Processing & AI Intelligence
          </p>
        </div>
      </footer>
    </div>
  );
}