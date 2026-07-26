import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css'; 
import './utils/SecretsManager'; 
import "yet-another-react-lightbox/styles.css"; 
import { ClerkProvider } from '@clerk/clerk-react';
import { dark } from '@clerk/themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,        // 30 seconds
      gcTime: 5 * 60 * 1000,       // 5 minutes (was cacheTime)
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      retry: 2,
    },
    mutations: {
      retry: 1,
    },
  },
});

// [ZEN CONSOLE FILTER] Suppress unhandled promise rejections originating from Chrome extension
// content scripts. These fire when an extension registers an async message listener that gets
// garbage-collected before the response arrives. They are browser-level noise — not app errors.
window.addEventListener('unhandledrejection', (event) => {
  const msg = event.reason?.message ?? '';
  if (msg.includes('message channel closed before a response was received')) {
    event.preventDefault(); // Swallow it silently — extension noise, not our code
    return;
  }
  // All other unhandled rejections bubble normally
});

// Basic debug to confirm JS is running even if styles fail
// console.log('%c[System] GIGI BOOT SEQUENCE INITIATED', 'background: #000; color: #00ff00; font-size: 14px; padding: 4px;');

// [ZEN SEC FIX] Forcefully purge all compromised keys from the browser cache
['GIGI_SEC_GEMINI', 'GIGI_SEC_GOOGLE', 'google_api_key', 'gemini_api_key'].forEach(k => localStorage.removeItem(k));

// console.log('%c[System] Env Check VITE_XAI_API_KEY:', 'color: cyan', import.meta.env.VITE_XAI_API_KEY ? 'READY' : 'MISSING');

let container = document.getElementById('root');

if (container) {
  const newContainer = document.createElement('div');
  newContainer.id = 'root';
  
  if (container.parentNode) {
      container.parentNode.replaceChild(newContainer, container);
      container = newContainer;
  }

  const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

  if (!clerkPubKey) {
    throw new Error("Missing Publishable Key");
  }

  const root = ReactDOM.createRoot(container); 
  root.render(
    <React.StrictMode>
      <ClerkProvider 
        publishableKey={clerkPubKey}
        appearance={{
          baseTheme: dark,
          variables: {
            colorPrimary: '#0ED3B5',
            colorBackground: '#0B0D17',
            colorInputBackground: '#161A2B',
            colorText: '#E0E0E0',
            borderRadius: '0.5rem',
          },
          layout: {
            logoPlacement: 'none'
          },
          elements: {
            logoBox: {
              display: 'none'
            }
          }
        }}
      >
        <QueryClientProvider client={queryClient}>
          <App />
          <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
      </ClerkProvider>
    </React.StrictMode>
  );
} else {
  console.error("Failed to find the root element");
}