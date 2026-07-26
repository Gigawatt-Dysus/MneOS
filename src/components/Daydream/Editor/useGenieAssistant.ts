import { Editor } from '@tiptap/react';
import { User } from '../../../types';
import { GenieInsight } from './types';
import { generateWritingCritique, generateGenieRevision, RevisionConfig } from '../../../services/ai/generators/daydream';

export const useGenieAssistant = (
    user: User,
    editor: Editor | null,
    critique: GenieInsight[],
    setCritique: React.Dispatch<React.SetStateAction<GenieInsight[]>>,
    genieThinking: boolean,
    setGenieThinking: React.Dispatch<React.SetStateAction<boolean>>,
    setShowGenie: React.Dispatch<React.SetStateAction<boolean>>,
    setActiveRevision: React.Dispatch<React.SetStateAction<number | null>>
) => {
    const handleSummonGenie = async () => {
        if (!editor || genieThinking) return;
        setGenieThinking(true);
        setShowGenie(true);

        try {
            const text = editor.getText();
            const response = await generateWritingCritique(user, text, 'scan');
            const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();

            try {
                const parsed = JSON.parse(cleanJson);
                setCritique(Array.isArray(parsed) ? parsed : [parsed]);
            } catch (e) {
                const matches = cleanJson.match(/\{[\s\S]*?\}(?=\s*(,|$|\]))/g);
                if (matches) {
                    const recovered = matches.map(m => { try { return JSON.parse(m); } catch (err) { return null; } }).filter(i => i);
                    if (recovered.length > 0) { setCritique(recovered); return; }
                }
                setCritique([{ type: 'style', level: 'suggestion', critique: "JSON Parse Error", suggestion: "Raw: " + cleanJson.substring(0, 50) }]);
            }
        } catch (error) {
            setCritique([{ type: 'grammar', level: 'critical', critique: "Connection lost.", suggestion: "Try again later." }]);
        } finally {
            setGenieThinking(false);
        }
    };

    const handleShowIssue = (quote: string) => {
        if (!editor || !quote) return;
        let found = false;
        editor.state.doc.descendants((node, p) => {
            if (found) return false;
            if (node.isText && node.text?.includes(quote)) {
                const offset = node.text.indexOf(quote);
                const from = p + offset;
                const to = from + quote.length;
                editor.chain().focus().setTextSelection({ from, to }).run();
                const dom = editor.view.domAtPos(from).node as HTMLElement;
                dom?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
                found = true;
                return false;
            }
            return true;
        });
    };

    const handleFixIssue = (quote: string, fix: string, index: number) => {
        if (!editor || !quote) return;
        let found = false;
        editor.state.doc.descendants((node, p) => {
            if (found) return false;
            if (node.isText && node.text?.includes(quote)) {
                const offset = node.text.indexOf(quote);
                const from = p + offset;
                const to = from + quote.length;
                editor.chain().setTextSelection({ from, to }).insertContent(fix).run();
                setCritique(prev => prev.filter((_, i) => i !== index));
                found = true;
                return false;
            }
            return true;
        });
    };

    const handleGenieRevision = async (config: RevisionConfig, cardIndex: number) => {
        if (!editor) return;
        setGenieThinking(true);
        setActiveRevision(null);
        try {
            const { from, to } = editor.state.selection;
            const selectedText = editor.state.doc.textBetween(from, to);
            const card = critique[cardIndex];
            const targetQuote = card?.quote;

            if (selectedText && selectedText.length > 5) {
                const rewritten = await generateGenieRevision(user, selectedText, config);
                editor.chain().focus().insertContent(rewritten).run();
            } else if (targetQuote) {
                const rewritten = await generateGenieRevision(user, targetQuote, config);
                handleFixIssue(targetQuote, rewritten, cardIndex);
            }
        } catch (e) { console.error(e); }
        setGenieThinking(false);
    };

    return { handleSummonGenie, handleShowIssue, handleFixIssue, handleGenieRevision };
};
