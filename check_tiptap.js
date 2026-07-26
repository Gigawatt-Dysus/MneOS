import * as TiptapReact from '@tiptap/react';
console.log('Exports of @tiptap/react:', Object.keys(TiptapReact));
try {
    const { BubbleMenu } = TiptapReact;
    console.log('BubbleMenu type:', typeof BubbleMenu);
} catch (e) {
    console.error('Error accessing BubbleMenu:', e);
}
