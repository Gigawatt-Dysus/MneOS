import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    server: {
      host: '0.0.0.0',
      port: process.env.PORT ? parseInt(process.env.PORT) : 5173,
      strictPort: true,
      watch: {
        ignored: ['**/*.db', '**/*.db-shm', '**/*.db-wal', '**/*.xml', '**/*.zip', '**/*.exe', '**/*.txt', '**/scratch/MneOS_Comfy/**']
      },
      headers: {
        // Allow Firebase signInWithPopup to poll window.closed without being blocked by Chrome's COOP policy
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
        'Cross-Origin-Embedder-Policy': 'unsafe-none',
      },
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
        '/comfy-ui': {
          target: 'http://127.0.0.1:8188',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/comfy-ui/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.removeHeader('Origin');
              proxyReq.removeHeader('Referer');
            });
          }
        },
        '/comfy-output': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        }
      }
    },
    css: {
      postcss: {
        plugins: [
          tailwindcss({
            config: './tailwind.config.cjs',
          }),
          autoprefixer(),
        ],
      },
    },
    // [ZEN OPTIMIZATION] Chunk Splitting
    // [ZEN FORCE UPDATE] Cache Invalidation Trigger
    build: {
      chunkSizeWarningLimit: 3000, // Silences the warning by increasing the limit
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              return 'vendor'; // Puts all heavy libraries into a separate file
            }
          }
        }
      }
    },
    plugins: [react()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.XAI_API_KEY': JSON.stringify(env.XAI_API_KEY)
    },
    optimizeDeps: {
      include: [
        'react', 'react-dom', 'three', '@react-three/fiber', '@react-three/drei',
        'firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage', 'firebase/functions',
        'framer-motion', 'lucide-react', 'minisearch', 'fuse.js', 'react-markdown', 'maplibre-gl',
        '@tiptap/react', '@tiptap/starter-kit'
      ],
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      }
    }
  };
});