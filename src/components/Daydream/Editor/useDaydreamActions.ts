import { useRef } from 'react';
import { Editor } from '@tiptap/react';
import { getFirestore, collection, query, where, orderBy, getDocs, limit } from '../../../services/sovereignDbAdapter';
import { DaydreamStory, User } from '../../../types';
import { DirectorState } from './types';
import { appDataService } from '../../../services/serviceManager';
import { generateDaydreamContinuation } from '../../../services/ai/generators/daydream';
import { v4 as uuidv4 } from 'uuid';

export const useDaydreamActions = (
    user: User,
    editor: Editor | null,
    story: DaydreamStory | null,
    setStory: React.Dispatch<React.SetStateAction<DaydreamStory | null>>,
    director: DirectorState,
    setDirector: React.Dispatch<React.SetStateAction<DirectorState>>,
    setIsSaving: React.Dispatch<React.SetStateAction<boolean>>,
    setIsThinking: React.Dispatch<React.SetStateAction<boolean>>,
    setStatus: React.Dispatch<React.SetStateAction<string>>,
    saveTone: (tone: string) => void,
    showOOCChat: boolean
) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSave = async () => {
        if (!story || !editor) return;
        setIsSaving(true);
        setStatus('Saving...');
        try {
            const content = editor.getJSON();
            const updatedStory = {
                ...story,
                content,
                updatedAt: new Date(),
                tone: director.tone,
                directorState: { ...director }
            };
            await appDataService.saveDaydream(user.id, updatedStory);
            setStory(updatedStory);
            setStatus('Saved');
        } catch (e) { setStatus('Save Failed'); }
        finally { setIsSaving(false); }
    };

    const handleContinue = async () => {
        if (!editor || !story) return;
        if (director.tone.trim().length > 0 && !director.tone.startsWith('(')) saveTone(director.tone);
        setIsThinking(true);
        try {
            if (editor.state.selection.empty) editor.chain().focus().enter().enter().run();
            const fullStoryText = editor.getText();
            let oocContext = '';
            if (showOOCChat) {
                const db = getFirestore();
                const q = query(collection(db, 'users', user.id, 'chat_segments'), where('island_id', '==', `daydream_ooc_${story.id}`), orderBy('timestamp', 'desc'), limit(5));
                const snap = await getDocs(q);
                oocContext = snap.docs.map(d => `${d.data().role === 'model' ? 'AI' : 'Director'}: ${d.data().content}`).reverse().join('\n');
            }
            const response = await generateDaydreamContinuation(user, story, director, fullStoryText, oocContext);
            if (response) {
                editor.chain().focus().insertContent(response).run();
                await handleSave();
            }
        } catch (e) { console.error(e); }
        finally { setIsThinking(false); }
    };

    const handleAiEdit = async (instruction: string) => {
        if (!editor || !story) return;
        const { from, to } = editor.state.selection;
        const selectedText = editor.state.doc.textBetween(from, to, ' ');
        if (!selectedText) return;
        setIsThinking(true);
        setStatus('Refining...');
        try {
            const result = await generateDaydreamContinuation(user, story, { ...director, tone: instruction }, selectedText + "\n[REWRITE THIS SELECTION]");
            if (result) editor.chain().focus().insertContent(result).run();
        } catch (e) { setStatus('Edit Failed'); }
        finally { setIsThinking(false); }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !editor) return;
        try {
            setStatus('Importing...');
            const { importDocxToHtml } = await import('../../../utils/daydreamIO');
            const html = await importDocxToHtml(file);
            if (editor.getText().length > 50 && !window.confirm("Overwrite current content?")) return;
            editor.commands.setContent(html);
            setStatus('Imported');
            handleSave();
        } catch (err) { setStatus('Import Failed'); }
        finally { if (fileInputRef.current) fileInputRef.current.value = ''; }
    };

    const handleExportDocx = async () => {
        if (!story || !editor) return;
        try {
            setStatus('Exporting...');
            const { exportStoryToDocx } = await import('../../../utils/daydreamIO');
            await exportStoryToDocx(story.title || 'Daydream', editor.getJSON());
            setStatus('Exported');
        } catch (err) { setStatus('Export Failed'); }
    };

    return { handleSave, handleContinue, handleAiEdit, handleFileChange, handleExportDocx, fileInputRef };
};
