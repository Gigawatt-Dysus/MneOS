import React, { useState, useEffect } from 'react';
import type { CommsMessage } from '@/types';
import { CommsCenterIcon } from './icons';

interface CommunicationsCenterProps {
    messages: CommsMessage[];
    onMarkAsRead: (id: string) => void;
}

const CommunicationsCenter: React.FC<CommunicationsCenterProps> = ({ messages, onMarkAsRead }) => {
    const [selectedMessage, setSelectedMessage] = useState<CommsMessage | null>(null);

    useEffect(() => {
        // Automatically select the first unread message, or the newest message if all are read.
        if (messages.length > 0) {
            const firstUnread = messages.find(m => !m.read);
            const newest = messages[0]; // Assuming messages are sorted newest first
            const messageToSelect = firstUnread || newest;
            
            if (messageToSelect) {
                setSelectedMessage(messageToSelect);
                if (!messageToSelect.read) {
                    onMarkAsRead(messageToSelect.id);
                }
            }
        } else {
            setSelectedMessage(null);
        }
    }, [messages, onMarkAsRead]);


    const handleSelectMessage = (message: CommsMessage) => {
        setSelectedMessage(message);
        if (!message.read) {
            onMarkAsRead(message.id);
        }
    };
    
    const sortedMessages = [...messages].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return (
        <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8">
                <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 text-glow">Comms Center</h1>
                <p className="mt-2 text-lg text-gray-600 dark:text-gray-300">(Simulation) Gigi's Outbound Messages</p>
            </div>
            
            <div className="flex flex-col md:flex-row h-[calc(100vh-250px)] bg-white/80 dark:bg-gray-800/50 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="w-full md:w-1/3 border-r border-gray-200 dark:border-gray-700/50 flex flex-col">
                    <div className="p-4 border-b border-gray-700/50 bg-gray-900/80 text-white">
                        <h2 className="font-semibold text-gray-100">Inbox</h2>
                    </div>
                    <ul className="overflow-y-auto flex-grow bg-gray-50/80 dark:bg-black/10">
                        {sortedMessages.map(msg => (
                            <li key={msg.id}>
                                <button onClick={() => handleSelectMessage(msg)} className={`w-full text-left p-4 border-b border-gray-200 dark:border-gray-700/50 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors ${selectedMessage?.id === msg.id ? 'bg-violet-100 dark:bg-violet-900/30' : ''}`}>
                                    <div className="flex justify-between items-center">
                                        <p className={`font-semibold truncate ${msg.read ? 'text-gray-600 dark:text-gray-400' : 'text-gray-900 dark:text-gray-100'}`}>{msg.subject}</p>
                                        <span className={`text-xs flex-shrink-0 ml-2 ${msg.read ? 'text-gray-400 dark:text-gray-500' : 'text-violet-600 dark:text-violet-400 font-bold'}`}>{msg.type}</span>
                                    </div>
                                    <div className="flex justify-between items-center mt-1">
                                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">From: {msg.from}</p>
                                        <p className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">{new Date(msg.timestamp).toLocaleDateString()}</p>
                                    </div>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="w-full md:w-2/3 flex flex-col">
                    {selectedMessage ? (
                         <>
                            <div className="p-4 border-b border-gray-700/50 bg-gray-900/80 text-white">
                                <h3 className="font-semibold text-lg text-gray-100">{selectedMessage.subject}</h3>
                                <p className="text-sm text-gray-400">From: {selectedMessage.from} | To: {selectedMessage.type === 'Email' ? 'youremail@example.com' : 'Your Phone'}</p>
                            </div>
                            <div className="p-6 overflow-y-auto flex-grow prose dark:prose-invert max-w-none">
                                <p style={{ whiteSpace: 'pre-wrap' }}>{selectedMessage.body}</p>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
                           <CommsCenterIcon className="w-16 h-16 mb-4"/>
                            <h3 className="text-xl font-semibold">No Messages</h3>
                            <p>Trigger a simulated message from the Profile Editor.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CommunicationsCenter;