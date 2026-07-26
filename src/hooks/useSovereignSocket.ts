import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export const useSovereignSocket = (
    userId: string | undefined, 
    onMutation: (collection: string, operation: string, docId?: string | string[]) => void
) => {
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        if (!userId) return;

        // Connect to the local api-dev-server gateway port
        const socket = io('http://localhost:3000', {
            withCredentials: true,
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('[SovereignSocket] 🟢 Connected to Matrix Gateway');
        });

        socket.on('db_mutated', (payload: { collection: string, operation: string, docId?: string | string[] }) => {
            console.log(`[SovereignSocket] ⚡ Mutation Detected: [${payload.operation.toUpperCase()}] on ${payload.collection}`);
            if (onMutation) {
                onMutation(payload.collection, payload.operation, payload.docId);
            }
        });

        socket.on('disconnect', () => {
            console.log('[SovereignSocket] 🔴 Disconnected');
        });

        socket.on('connect_error', (err) => {
            console.warn('[SovereignSocket] ⚠️ Connection Error:', err.message);
        });

        return () => {
            socket.off('connect');
            socket.off('db_mutated');
            socket.off('disconnect');
            socket.off('connect_error');
            socket.disconnect();
            socketRef.current = null;
        };
    }, [userId, onMutation]);
    
    return socketRef.current;
};
