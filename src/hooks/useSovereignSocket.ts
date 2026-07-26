import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export const useSovereignSocket = (
    userId: string | undefined, 
    onMutation: (collection: string, operation: string, docId?: string | string[]) => void
) => {
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        if (!userId) return;

        // Skip socket connection on public web deployments unless a explicit proxy URL is configured
        const isLocalHost = typeof window !== 'undefined' && (
            window.location.hostname === 'localhost' || 
            window.location.hostname === '127.0.0.1'
        );
        const targetUrl = import.meta.env.VITE_ALPHA_PROXY_URL || (isLocalHost ? 'http://localhost:3000' : null);

        if (!targetUrl) {
            return;
        }

        // Connect to local gateway
        const socket = io(targetUrl, {
            withCredentials: true,
            reconnection: true,
            reconnectionAttempts: 3,
            reconnectionDelay: 2000,
            reconnectionDelayMax: 10000,
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

        socket.on('connect_error', () => {
            // Silently handle connection error to prevent console spam when local node daemon is offline
            socket.disconnect();
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
