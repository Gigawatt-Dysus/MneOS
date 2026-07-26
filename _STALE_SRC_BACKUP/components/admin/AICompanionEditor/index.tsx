import React from 'react';
import type { User, View } from '@/types';
import { GlassButton } from '../../GlassButton';
import { GlassCard } from '../../GlassCard';
import { Plus, Bot, Terminal } from 'lucide-react';

// Sub-Components
import { CompanionForm } from './CompanionForm';
import { LogConsole } from './LogConsole';
import { useAILogic } from './useAILogic';

interface AICompanionEditorProps {
  user: User;
  onUserUpdate: (user: User) => void;
  onNavigate: (view: View) => void;
}

const AICompanionEditor: React.FC<AICompanionEditorProps> = (props) => {
    const {
        editingCompanion, setEditingCompanion,
        activeTab, setActiveTab,
        handleCreateNew, handleSave, handleDelete
    } = useAILogic(props);

    return (
        <div className="max-w-5xl mx-auto pb-20">
            {editingCompanion && (
                <CompanionForm 
                    companion={editingCompanion} 
                    onSave={handleSave} 
                    onCancel={() => setEditingCompanion(null)} 
                    user={props.user} 
                />
            )}

            {/* Header - Subtle Glass Style */}
            <div className="mb-8 flex flex-col items-center">
                <div className="inline-flex items-center gap-3 px-6 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md shadow-xl mb-4">
                    <Bot className="text-cyan-400" size={20} />
                    <h1 className="text-lg font-bold text-white tracking-wide uppercase">Neural Configuration</h1>
                </div>
                <p className="text-sm text-slate-400">Manage cognitive personas and system diagnostics.</p>
            </div>

            {/* Tabs */}
            <div className="flex justify-center mb-8">
                <div className="flex p-1 space-x-1 bg-black/40 border border-white/10 rounded-xl backdrop-blur-md">
                    <GlassButton
                        onClick={() => setActiveTab('companions')}
                        variant={activeTab === 'companions' ? 'primary' : 'ghost'}
                        className="px-6"
                    >
                        <Bot size={16} className="mr-2"/> Companions
                    </GlassButton>
                    <GlassButton
                        onClick={() => setActiveTab('logs')}
                        variant={activeTab === 'logs' ? 'secondary' : 'ghost'}
                        className="px-6"
                    >
                        <Terminal size={16} className="mr-2"/> System Logs
                    </GlassButton>
                </div>
            </div>

            <div className="bg-[#0f1219]/60 backdrop-blur-xl p-6 rounded-2xl shadow-2xl border border-white/5 min-h-[400px]">
                
                {activeTab === 'companions' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Active Constructs</h2>
                            <GlassButton onClick={handleCreateNew} variant="success" className="shadow-lg shadow-emerald-900/20">
                                <Plus size={16} className="mr-2"/> Initialize New
                            </GlassButton>
                        </div>
                    
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {props.user.aiCompanions.map(companion => (
                                <GlassCard 
                                    key={companion.id}
                                    title={companion.name}
                                    subtitle={companion.persona}
                                    image={companion.avatarUrl}
                                    isPrimary={companion.isPrimary}
                                    onEdit={() => setEditingCompanion(companion)}
                                    onDelete={() => handleDelete(companion.id)}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'logs' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <LogConsole />
                    </div>
                )}

            </div>
        </div>
    );
};

export default AICompanionEditor;