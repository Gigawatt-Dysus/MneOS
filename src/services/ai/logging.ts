import type { ApiLogEntry } from '../../types';

const LOG_LIMIT = 50;
let logStore: ApiLogEntry[] = [];

export const notifyStatus = (message: string) => {
    window.dispatchEvent(new CustomEvent('gigi-status-toast', { detail: message }));
};

export const triggerDiegeticDelay = (msg?: string) => {
    const message = msg || "I'm shifting processing cores... one moment.";
    window.dispatchEvent(new CustomEvent('gigi-diegetic-delay', { detail: message }));
};

export const notifyLogUpdate = () => {
    window.dispatchEvent(new CustomEvent('gigi-api-log-update'));
};

export const addApiLog = (type: ApiLogEntry['type'], model: string, message: string, details?: any) => {
    const newLog: ApiLogEntry = {
        id: `log-${Date.now()}-${Math.random()}`,
        timestamp: new Date(),
        type,
        model,
        endpoint: 'generateContent',
        message,
        details
    };
    logStore.unshift(newLog);
    if (logStore.length > LOG_LIMIT) logStore.pop();
    notifyLogUpdate();
};

export const getApiLogs = () => logStore;
export const clearApiLogs = () => { logStore = []; notifyLogUpdate(); };