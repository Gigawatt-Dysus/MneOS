// api-dev-server.cjs
// Lightweight local dev server that bridges the Vercel-style api/ handlers
// to a plain Express HTTP server on port 3000.
// Usage: node api-dev-server.cjs
//
// This replaces `npx vercel dev` which incorrectly runs Vite instead of the API layer.

require('dotenv').config({ path: '.env.local' });

const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true
  }
});

// Expose Socket.io to all API routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

io.on('connection', (socket) => {
  console.log(`[socket.io] 📡 Client connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`[socket.io] 📡 Client disconnected: ${socket.id}`);
  });
});

app.use(express.json({ limit: '50mb' }));

// ── CORS: allow Vite frontend on 5173 ──────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Serve ComfyUI output directory directly
app.use('/comfy-output', express.static('C:/MneOS/scratch/MneOS_Comfy/output'));
app.use('/api/comfy-output', express.static('C:/MneOS/scratch/MneOS_Comfy/output'));

// ── Dynamic route loader ───────────────────────────────────────────────────
// Maps GET/POST /api/<name> to api/<name>.ts (compiled on-the-fly via tsx)
// We use a require hook via tsx/register to handle TypeScript transparently.

const tsxRegister = (() => {
  try {
    // tsx is the fast TypeScript runner; try it first
    require('tsx/cjs');
    return true;
  } catch (_) {
    return false;
  }
})();

if (!tsxRegister) {
  console.error('[api-dev-server] ❌ tsx not found. Run: npm install --save-dev tsx');
  process.exit(1);
}

const API_DIR = path.join(__dirname, 'api');

// Load all .ts route files recursively
const fs = require('fs');

function getApiRoutes(dir, baseRoute = '') {
  let routes = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      routes = routes.concat(getApiRoutes(path.join(dir, entry.name), `${baseRoute}${entry.name}/`));
    } else if (entry.name.endsWith('.ts')) {
      routes.push({
        file: path.join(dir, entry.name),
        route: `${baseRoute}${entry.name.replace('.ts', '')}`
      });
    }
  }
  return routes;
}

const apiRoutes = getApiRoutes(API_DIR);

for (const { file, route } of apiRoutes) {
  try {
    // Initial load just to verify it compiles and exists
    const mod = require(file);
    const initialHandler = mod.default || mod;

    if (typeof initialHandler === 'function') {
      app.all(`/api/${route}`, (req, res, next) => {
        // [ZEN HOT-RELOAD] Flush the require cache for this specific API route
        // This ensures every API call uses the exact code currently on disk, bypassing nodemon
        delete require.cache[require.resolve(file)];
        
        try {
          const hotMod = require(file);
          const hotHandler = hotMod.default || hotMod;
          if (typeof hotHandler === 'function') {
            return hotHandler(req, res, next);
          }
          next();
        } catch (hotErr) {
          console.error(`[api-dev-server] ❌ Hot-reload error in ${route}:`, hotErr);
          res.status(500).json({ error: 'Internal API Compilation Error', details: hotErr.message });
        }
      });
      console.log(`[api-dev-server] ✅ Mounted (Hot-Reload Enabled): /api/${route}`);
    }
  } catch (err) {
    console.warn(`[api-dev-server] ⚠️  Skipped ${file}:`, err.message);
  }
}

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ error: `No API handler found for ${req.path}` });
});

const PORT = process.env.API_PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n[api-dev-server] 🚀 Sovereign API + Socket.io running on http://localhost:${PORT}`);
  console.log(`[api-dev-server] Proxied from Vite at http://localhost:5173/api/*\n`);
});
