import { Timestamp } from 'firebase/firestore';

export const APP_ID = 'default-zen';

// The "Soul" - Original Sci-Fi/Blake's 7 References
export const DEFAULT_IDLE_MESSAGES = [
    "CONFIRMED.",
    "INFORMATION: SENSORS ACTIVE.",
    "COURSE SET FOR SECTOR 4.",
    "TELEPORT DELIVERY STANDING BY.",
    "SHIELDS AT MAXIMUM.",
    "SCANNING SUBSPACE FREQUENCIES.",
    "ORAC IS PROCESSING...",
    "STANDARD BY 12.",
    "I HAVE A PROJECTION.",
    "SECURITY LOCKS ENGAGED.",
    "MONITORING QUANTUM FLUCTUATIONS.",
    "AWAITING COMMAND DIRECTIVE.",
    "SYSTEMS FUNCTIONAL.",
    "SPEED: STANDARD BY 4.",
    "ZEN: ONLINE."
];

export const DEFAULT_ISSUE_TYPES = ["Bug Report", "Feature", "Refactor", "Init", "Shits and Grins", "Deprecate"];
export const DEFAULT_MODULES = ["Core", "Auth", "Database", "UI", "Utils"];

export interface DevConfig {
    coderName: string;
    basePrompt: string;
    geminiKey: string;
    grokKey: string;
    ollamaUrl: string; 
    issueTypes: string[];
    modules: string[];
    idleMessages: string[];
    temperature: string; 
}

export interface ServiceState {
    id: string;
    status: 'green' | 'red' | 'gray' | 'yellow' | 'offline_cache'; 
    message: string;
    latency: number | null;
    details: string;
}

export interface TelemetryData {
    system?: {
        cpuLoad?: number;
        memUsed?: number;
        gpu?: string;
        cpuTemp?: number;
    };
    ollama?: {
        status?: string;
        models?: string[];
        url?: string;
    };
    updatedAt: number | Timestamp; 
}