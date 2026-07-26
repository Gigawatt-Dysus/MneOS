import { spawn } from 'child_process';
import path from 'path';

// ANSI Color codes
const colors = {
    VITE: '\x1b[36m',       // Cyan
    STAGING: '\x1b[35m',    // Magenta
    FIREBASE: '\x1b[33m',   // Yellow
    VERCEL: '\x1b[34m',     // Blue
    VECTOR: '\x1b[32m',     // Green
    SYSTEM: '\x1b[37m',     // White
    RESET: '\x1b[0m'
};

// Configuration of the 5 core services
const services = [
    {
        name: 'VITE',
        command: 'npm.cmd',
        args: ['run', 'dev'],
        cwd: process.cwd()
    },
    {
        name: 'STAGING',
        command: 'node.exe',
        args: ['scripts/migration/staging_api.js'],
        cwd: process.cwd()
    },
    {
        name: 'FIREBASE',
        command: 'firebase.cmd',
        args: ['emulators:start'],
        cwd: process.cwd()
    },
    {
        name: 'VERCEL',
        command: 'npx.cmd',
        args: ['vercel', 'dev'],
        cwd: process.cwd()
    },
    {
        name: 'VECTOR',
        // Update this to your actual Vector script if it differs!
        command: 'python.exe',
        args: ['scripts/migration/vector_server.py'], 
        cwd: process.cwd()
    }
];

const processes = [];

console.log(`${colors.SYSTEM}=======================================================${colors.RESET}`);
console.log(`${colors.SYSTEM}🚀 INITIATING GIGI MASTER LAUNCH SEQUENCE...${colors.RESET}`);
console.log(`${colors.SYSTEM}=======================================================${colors.RESET}\n`);

// Helper to prefix logs
function logPrefixed(name, data, isError = false) {
    const lines = data.toString().split('\n');
    const color = colors[name] || colors.SYSTEM;
    lines.forEach(line => {
        if (line.trim()) {
            console.log(`${color}[${name}]${colors.RESET} ${line.trim()}`);
        }
    });
}

// Spawn all services
services.forEach(service => {
    console.log(`${colors.SYSTEM}[SYSTEM] Engaging ${service.name}...${colors.RESET}`);
    
    const child = spawn(service.command, service.args, { cwd: service.cwd });
    
    child.stdout.on('data', (data) => logPrefixed(service.name, data));
    child.stderr.on('data', (data) => logPrefixed(service.name, data, true));
    
    child.on('close', (code) => {
        console.log(`${colors.SYSTEM}[SYSTEM] ${service.name} exited with code ${code}${colors.RESET}`);
    });

    child.on('error', (err) => {
        console.log(`${colors.SYSTEM}[SYSTEM] Failed to start ${service.name}: ${err.message}${colors.RESET}`);
    });

    processes.push(child);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log(`\n${colors.SYSTEM}[SYSTEM] TERMINATING ALL SERVICES...${colors.RESET}`);
    processes.forEach(p => {
        if (!p.killed) p.kill('SIGINT');
    });
    process.exit(0);
});
