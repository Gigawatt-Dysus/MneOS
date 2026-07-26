import React from 'react';
import { Activity } from 'lucide-react';
import { formatLifeOSDate } from '../../utils/dateSanitizer';

interface CommsListProps {
    items: any[]; // Can be Message or JournalEntry
    systemMode: 'signals' | 'logs';
    selectedItemId: string | null;
    onSelectItem: (id: string) => void;
    onEditItem: (id: string) => void; // For double click
}

export const CommsList: React.FC<CommsListProps> = ({ items, systemMode, selectedItemId, onSelectItem, onEditItem }) => {

    const ListItem = ({ item }: { item: any }) => {
        const isSignal = systemMode === 'signals';
        const isRequest = isSignal && item.fromId && item.toId; // Duck typing for VertexRequest

        const isSelected = selectedItemId === item.id;
        const title = isRequest ? `Vertex Request: ${item.fromName}` : (isSignal ? item.subject : item.title);
        const subtitle = isRequest ? "IDENTITY LINK" : (isSignal ? item.from : (item.type || 'Reflection'));
        const date = isSignal ? item.timestamp : item.creationDate;
        const preview = isRequest ? `Inbound connection request from ${item.fromName}.` : (isSignal ? item.body : item.content);
        const isUnread = isRequest ? true : (isSignal ? !item.read : false);

        return (
            <div
                onClick={() => onSelectItem(item.id)}
                onDoubleClick={() => onEditItem(item.id)}
                title={!isSignal ? "Double-click to edit, Single-click to view" : "Click to view transmission"}
                className={`p-4 border-b border-white/5 cursor-pointer transition-all hover:bg-white/5 relative overflow-hidden group ${isSelected ? 'bg-white/10' : ''
                    }`}
            >
                {isSelected && <div className={`absolute left-0 top-0 bottom-0 w-1 shadow-[0_0_10px_currentColor] ${isSignal ? 'bg-cyan-500 text-cyan-500' : 'bg-violet-500 text-violet-500'}`} />}

                <div className="flex justify-between items-start mb-1">
                    <span className={`text-xs font-bold ${isUnread ? 'text-white font-mono tracking-wider' : 'text-slate-400'}`}>
                        {isUnread && <span className="mr-2 inline-block w-2 h-2 bg-cyan-500 rounded-full animate-pulse" />}
                        {subtitle}
                    </span>
                    <span className="text-[10px] text-slate-600 font-mono">
                        {formatLifeOSDate(date, 'day')}
                    </span>
                </div>

                <h4 className={`text-sm font-semibold mb-1 truncate ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                    {title || "Untitled"}
                </h4>

                <p className="text-xs text-slate-500 truncate font-mono opacity-70">
                    {preview ? preview.substring(0, 50) : ""}...
                </p>
            </div>
        );
    };

    return (
        <div className={`
            col-span-12 md:col-span-4 bg-black/20 backdrop-blur-md border border-white/10 rounded-2xl flex-col overflow-hidden
            ${selectedItemId ? 'hidden md:flex' : 'flex'}
        `}>
            <div className="p-3 border-b border-white/10 bg-black/20 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wide">
                    {systemMode === 'signals' ? 'Transmissions' : 'Entries'}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">{items.length} RECORDS</span>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {items.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-50">
                        <Activity size={32} className="mb-2" />
                        <span className="text-xs">NO DATA FOUND</span>
                    </div>
                ) : (
                    items.map((item: any) => <ListItem key={item.id} item={item} />)
                )}
            </div>
        </div>
    );
};