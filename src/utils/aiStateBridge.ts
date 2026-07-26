// utils/aiStateBridge.ts
type ThinkingStateChangeListener = (isThinking: boolean, status?: string) => void;

let listener: ThinkingStateChangeListener | null = null;
let currentThinking = false;
let currentStatus = '';

export const aiStateBridge = {
    // Called by Header.tsx to listen
    subscribe: (callback: ThinkingStateChangeListener) => {
        listener = callback;
        return () => { listener = null; };
    },

    // Called by generators.ts to signal state
    setThinking: (isThinking: boolean, status?: string) => {
        currentThinking = isThinking;
        if (status !== undefined) {
            currentStatus = status;
        }
        if (!isThinking) currentStatus = ''; // Reset status when done
        if (listener) listener(currentThinking, currentStatus);
    },

    setStatusText: (status: string) => {
        currentStatus = status;
        if (listener) listener(currentThinking, currentStatus);
    }
};