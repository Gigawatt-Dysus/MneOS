import React, { useEffect } from 'react';
import { useDaydreamState } from './useDaydreamState';
import { useDaydreamEditor } from './useDaydreamEditor';
import { useDaydreamActions } from './useDaydreamActions';
import { useGenieAssistant } from './useGenieAssistant';
import { DaydreamEditorProps } from './types';
import { Header } from './parts/Header';
import { Toolbar } from './parts/Toolbar';
import { Sidebar } from './parts/Sidebar';
import { GeniePanel } from './parts/GeniePanel';
import { Canvas } from './parts/Canvas';
import { SmartSelectionMenu } from '../SmartSelectionMenu';
import { OOCFloater } from '../OOCFloater';
import { appDataService } from '../../../services/serviceManager';
import { v4 as uuidv4 } from 'uuid';

export const DaydreamEditor: React.FC<DaydreamEditorProps> = (props) => {
    const state = useDaydreamState(props.user);
    const { editor, loadFont } = useDaydreamEditor(state.paperSize);
    
    const saveTone = (newTone: string) => {
        if (!newTone.trim() || state.savedTones.includes(newTone.trim())) return;
        const updated = [newTone.trim(), ...state.savedTones].slice(0, 10);
        state.setSavedTones(updated);
        localStorage.setItem('daydream_saved_tones', JSON.stringify(updated));
    };

    const deleteTone = (toneToDelete: string) => {
        const updated = state.savedTones.filter(t => t !== toneToDelete);
        state.setSavedTones(updated);
        localStorage.setItem('daydream_saved_tones', JSON.stringify(updated));
    };

    const actions = useDaydreamActions(
        props.user, editor, state.story, state.setStory, state.director, state.setDirector,
        state.setIsSaving, state.setIsThinking, state.setStatus, saveTone, state.showOOCChat
    );

    const genie = useGenieAssistant(
        props.user, editor, state.critique, state.setCritique, state.genieThinking,
        state.setGenieThinking, state.setShowGenie, state.setActiveRevision
    );

    const handleFixParagraphs = () => {
        if (!editor) return;
        const currentContent = editor.getHTML();
        const fixedContent = currentContent.replace(/<br\s*\/?>/gi, '</p><p>');
        if (fixedContent !== currentContent) {
            editor.commands.setContent(fixedContent);
            state.setStatus('Paragraphs Fixed');
        }
    };

    useEffect(() => {
        const loadStory = async () => {
            if (props.storyId) {
                state.setStatus('Loading...');
                const loaded = await appDataService.getDaydream(props.user.id, props.storyId);
                if (loaded) {
                    state.setStory(loaded);
                    editor?.commands.setContent(loaded.content);
                    if (loaded.directorState) state.setDirector(prev => ({ ...prev, ...loaded.directorState }));
                    if (loaded.tone) state.setDirector(prev => ({ ...prev, tone: loaded.tone || '' }));
                    state.setStatus('Loaded');
                }
            } else {
                const recovered = localStorage.getItem('daydream_draft_recovery');
                const newStory = { id: uuidv4(), userId: props.user.id, title: 'Untitled Daydream', content: recovered ? JSON.parse(recovered) : {}, createdAt: new Date(), updatedAt: new Date(), status: 'draft' as const, activeCast: [], tags: [] };
                state.setStory(newStory);
                if (recovered && editor) editor.commands.setContent(JSON.parse(recovered));
            }
        };
        if (editor && !state.story) loadStory();
    }, [props.storyId, editor]);

    if (!editor || !state.story) return <div className="p-10 text-center animate-pulse text-slate-500">Initializing Neural Canvas...</div>;

    return (
        <div className="flex flex-col h-full bg-transparent text-slate-200 font-sans selection:bg-violet-500/30">
            <SmartSelectionMenu editor={editor} onAiEdit={actions.handleAiEdit} />
            {state.showOOCChat && state.story && <OOCFloater user={props.user} storyId={state.story.id} storyTitle={state.story.title} onClose={() => state.setShowOOCChat(false)} />}
            
            <Header 
                {...state} {...actions} {...genie} 
                onClose={props.onClose} 
                handleFixParagraphs={handleFixParagraphs}
                handleImportClick={() => actions.fileInputRef.current?.click()}
            />
            
            <Toolbar editor={editor} loadFont={loadFont} onClose={props.onClose} />
            
            <div className="flex-1 flex overflow-hidden relative">
                {state.showGenie && <GeniePanel {...genie} activeRevision={state.activeRevision} setActiveRevision={state.setActiveRevision} critique={state.critique} genieThinking={state.genieThinking} setShowGenie={state.setShowGenie} handleIgnoreCritique={(i) => state.setCritique(prev => prev.filter((_, idx) => idx !== i))} />}
                <Canvas {...state} editor={editor} />
                {state.isSidebarOpen && <Sidebar {...state} saveTone={saveTone} deleteTone={deleteTone} />}
            </div>

            <input type="file" ref={actions.fileInputRef} onChange={actions.handleFileChange} hidden accept=".docx" />
        </div>
    );
};
