// utils/aiStateBridge.ts
type ThinkingStateChangeListener = (isThinking: boolean) => void;

let listener: ThinkingStateChangeListener | null = null;

export const aiStateBridge = {
    // Called by Header.tsx to listen
    subscribe: (callback: ThinkingStateChangeListener) => {
        listener = callback;
        return () => { listener = null; };
    },

    // Called by generators.ts to signal state
    setThinking: (isThinking: boolean) => {
        if (listener) listener(isThinking);
    }
};