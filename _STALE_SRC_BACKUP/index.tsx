import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css'; 
import './utils/SecretsManager'; 

// Basic debug to confirm JS is running even if styles fail
console.log('%c[System] GIGI BOOT SEQUENCE INITIATED', 'background: #000; color: #00ff00; font-size: 14px; padding: 4px;');

let container = document.getElementById('root');

if (container) {
  const newContainer = document.createElement('div');
  newContainer.id = 'root';
  
  if (container.parentNode) {
      container.parentNode.replaceChild(newContainer, container);
      container = newContainer;
  }

  const root = ReactDOM.createRoot(container); 
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  console.error("Failed to find the root element");
}