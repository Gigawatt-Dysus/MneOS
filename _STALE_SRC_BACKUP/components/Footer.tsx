import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-white/80 dark:bg-gray-800/80 border-t border-gray-200 dark:border-gray-700/50 backdrop-blur-md">
      <div className="container mx-auto px-4 py-6 text-center text-gray-500 dark:text-gray-400">
        <p className="text-sm">&copy; {new Date().getFullYear()} Project G.I.G.I. All rights reserved.</p>
        <div className="flex justify-center space-x-4 mt-2 text-xs">
          <a href="#" className="hover:text-violet-600 dark:hover:text-violet-400 transition-colors">About Us</a>
          <a href="#" className="hover:text-violet-600 dark:hover:text-violet-400 transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-violet-600 dark:hover:text-violet-400 transition-colors">Terms of Service</a>
          <a href="#" className="hover:text-violet-600 dark:hover:text-violet-400 transition-colors">Code Repository</a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;