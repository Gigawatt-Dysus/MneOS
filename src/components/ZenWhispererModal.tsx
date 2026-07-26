import React, { useState, useEffect, useCallback, useRef } from 'react';
import { doc, setDoc, getDoc, getDocFromServer, onSnapshot } from '../services/sovereignDbAdapter';
import { LucideActivity } from 'lucide-react';
import type { User } from '../types'; 
import { db } from '../firebaseConfig';

// Sub-Modules
import MatrixRain from './zen/MatrixRain';
import ZenDashboard from './zen/ZenDashboard';
import ZenTerminals from './zen/ZenTerminals';
import ZenSettings from './zen/ZenSettings';
import { 
    APP_ID, DEFAULT_ISSUE_TYPES, DEFAULT_MODULES, DEFAULT_IDLE_MESSAGES, 
    DevConfig, ServiceState, TelemetryData 
} from './zen/ZenShared';

interface ZenWhispererModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: User;
}

const ZenWhispererModal: React.FC<ZenWhispererModalProps> = ({ isOpen, onClose, user }) => {
    
    // --- STATE ---
    const [health, setHealth] = useState<Record<string, ServiceState>>({
        GROK: { id: 'GROK', status: 'gray', message: 'Init...', latency: null, details: 'Waiting...' },
        LOCAL: { id: 'LOCAL', status: 'gray', message: 'SEARCHING...', latency: null, details: 'Scanning Firestore...' },
    });
    
    const [sysStatus, setSysStatus] = useState('INITIALIZING CORE...');
    const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
    const [alertLevel, setAlertLevel] = useState<'normal' | 'warning' | 'critical'>('normal');

    const [config, setConfig] = useState<DevConfig>({
        coderName: 'Zen', basePrompt: '', grokKey: '', 
        ollamaUrl: 'http://127.0.0.1:11434', issueTypes: DEFAULT_ISSUE_TYPES, modules: DEFAULT_MODULES, idleMessages: DEFAULT_IDLE_MESSAGES, temperature: '0.2'
    });
    
    const [showSettings, setShowSettings] = useState(false);
    const [selectedService, setSelectedService] = useState<string | null>(null); 
    
    // Form State 
    const [issueType, setIssueType] = useState('Bug Report');
    const [module, setModule] = useState('Core');
    const [priority, setPriority] = useState('Normal');
    const [model, setModel] = useState('grok');
    const [description, setDescription] = useState('');
    const [logs, setLogs] = useState('');
    const [output, setOutput] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    const isBusyRef = useRef(false);
    const idleMessagesRef = useRef<string[]>(DEFAULT_IDLE_MESSAGES);
    const flavorIntervalRef = useRef<any>(null);

    // --- FIRESTORE UTILS ---
    const configRef = useCallback(() => doc(db, 'users', user.id, 'zen_config', 'main'), [user.id]);
    const telemetryRef = useCallback(() => doc(db, 'artifacts', APP_ID, 'users', user.id, 'telemetry', 'realtime'), [user.id]);

    // --- STATUS & FLAVOR TEXT ---
    const startFlavorText = useCallback(() => {
        if (flavorIntervalRef.current) clearInterval(flavorIntervalRef.current);
        flavorIntervalRef.current = setInterval(() => {
            if (!isBusyRef.current) {
                const msgs = idleMessagesRef.current;
                const msg = msgs[Math.floor(Math.random() * msgs.length)];
                setSysStatus(msg.toUpperCase());
            }
        }, 6000); 
    }, []);

    const setSystemStatus = useCallback((msg: string) => {
        isBusyRef.current = true;
        setSysStatus(msg.toUpperCase());
        
        if (flavorIntervalRef.current) clearInterval(flavorIntervalRef.current);
        
        setTimeout(() => {
            isBusyRef.current = false;
            startFlavorText();
        }, 3000); 
    }, [startFlavorText]);

    // --- TELEMETRY ---
    const pingCloud = useCallback(async () => {
        const grokStatus: ServiceState = { id: 'GROK', status: config.grokKey ? 'green' : 'yellow', message: config.grokKey ? 'Ready' : 'No Key', latency: null, details: 'API Key Configured' };
        setHealth(prev => ({ ...prev, GROK: grokStatus }));
    }, [config]);

    // --- REAL-TIME LISTENER ---
    useEffect(() => {
        if (!isOpen || !user) return;
        
        const unsubscribe = onSnapshot(telemetryRef(), (docSnap) => {
            if (docSnap.exists()) {
                const rawData = docSnap.data();
                // Timestamp conversion logic
                const timestamp = rawData.updatedAt?.toMillis 
                    ? rawData.updatedAt.toMillis() 
                    : (typeof rawData.updatedAt === 'number' ? rawData.updatedAt : 0);

                const data: TelemetryData = { ...rawData, updatedAt: timestamp } as TelemetryData;
                setTelemetry(data); 
                
                const now = Date.now();
                const diff = now - timestamp;
                const isFresh = diff < 15000;

                // @ts-ignore
                const ollamaStatus = data.ollama?.status || 'UNKNOWN';
                const detailText = `STATUS: ${isFresh ? 'ONLINE' : 'STALE'}\nLAST HEARTBEAT: ${Math.round(diff / 1000)}s ago\nOLLAMA: ${ollamaStatus}`;

                setHealth(prev => ({
                    ...prev,
                    LOCAL: {
                        id: 'LOCAL',
                        status: isFresh ? 'green' : 'red',
                        message: isFresh ? 'ONLINE' : 'STALE',
                        latency: isFresh ? Math.round(diff) : null,
                        details: detailText
                    }
                }));
            } else {
                setHealth(prev => ({
                    ...prev,
                    LOCAL: { id: 'LOCAL', status: 'red', message: 'NO SIGNAL', latency: null, details: `Start zen-satellite.js` }
                }));
            }
        });
        
        pingCloud();
        return () => unsubscribe();
    }, [isOpen, user, telemetryRef, pingCloud]);

    // --- CONFIG LOAD ---
    useEffect(() => {
        if (isOpen && user) {
            getDoc(configRef()).then(snap => {
                if (snap.exists()) {
                    const data = snap.data() as DevConfig;
                    setConfig(prev => ({ ...prev, ...data }));
                    if (data.idleMessages && data.idleMessages.length > 0) {
                        idleMessagesRef.current = data.idleMessages;
                    }
                }
                startFlavorText();
            });
        }
        return () => { if (flavorIntervalRef.current) clearInterval(flavorIntervalRef.current); };
    }, [isOpen, user, configRef, startFlavorText]);

    const saveConfig = async (configData: DevConfig, closePanel: boolean) => {
        setSystemStatus("UPLOADING CONFIG...");
        try {
            await setDoc(configRef(), configData, { merge: true });
            setSystemStatus("CLOUD SYNC COMPLETE");
            if (closePanel) setShowSettings(false); 
        } catch (e) {
            setSystemStatus("SAVE FAILED");
        }
    };

    // --- GENERATION HANDLER ---
    const handleGenerate = async () => {
        if (isGenerating || !config) return;
        setIsGenerating(true);
        setSystemStatus(`TRANSMITTING TO ${model.toUpperCase()}...`);
        setOutput('');
        
        const prompt = `CONTEXT:\n${config.basePrompt}\n\nREQUEST:\n- Type: ${issueType}\n- Module: ${module}\n- Priority: ${priority}\n\nDESCRIPTION:\n${description}\n\n${logs ? `LOGS:\n${logs}` : ''}\n\nTASK:\nAct as ${config.coderName}. Format as Markdown.`;

        try {
            let responseText = '';
            if (model === 'grok') {
                if (!config.grokKey) throw new Error("Grok Key Missing.");
                const res = await fetch("https://api.x.ai/v1/chat/completions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${config.grokKey}` },
                    body: JSON.stringify({ messages: [{ role: "system", content: `You are ${config.coderName}.` }, { role: "user", content: prompt }], model: "grok-4.3", stream: false })
                });
                const data = await res.json();
                responseText = data.choices?.[0]?.message?.content || "No response.";
            } else if (model === 'local') {
                 // SATELLITE QUEUE (Placeholder for future hookup)
                 responseText = "// QUEUED FOR SATELLITE PROCESSING...\n// (Write to 'queue' collection to activate)";
            }
            setOutput(responseText);
            setSystemStatus('RESPONSE RECEIVED');
        } catch (error: any) {
            setOutput(`// ERROR\n// ${error.message}`);
            setSystemStatus('TRANSMISSION FAILED');
        } finally {
            setIsGenerating(false);
        }
    };

    const copyToClipboard = () => {
        if (!output) return;
        navigator.clipboard.writeText(output);
        setSystemStatus('COPIED');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] bg-[#000510] text-[#00ffcc] font-mono flex flex-col overflow-hidden">
            <MatrixRain />
            
            <ZenDashboard 
                user={user} 
                health={health} 
                sysStatus={sysStatus} 
                telemetry={telemetry} 
                alertLevel={alertLevel}
                selectedService={selectedService}
                setSelectedService={setSelectedService}
                onOpenSettings={() => setShowSettings(true)}
                onClose={onClose}
            />

            <ZenTerminals 
                config={config}
                issueType={issueType} setIssueType={setIssueType}
                module={module} setModule={setModule}
                priority={priority} setPriority={setPriority}
                model={model} setModel={setModel}
                description={description} setDescription={setDescription}
                logs={logs} setLogs={setLogs}
                output={output}
                isGenerating={isGenerating}
                handleGenerate={handleGenerate}
                copyToClipboard={copyToClipboard}
            />

            {showSettings && (
                <ZenSettings 
                    config={config} 
                    setConfig={setConfig} 
                    onSave={saveConfig} 
                    onClose={() => setShowSettings(false)} 
                />
            )}
        </div>
    );
};

export default ZenWhispererModal;