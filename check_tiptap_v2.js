import * as TiptapReact from '@tiptap/react';
console.log('--- CHECKING TIPTAP V2 EXPORTS ---');
try {
    const { BubbleMenu } = TiptapReact;
    console.log('BubbleMenu is type:', typeof BubbleMenu);
    if (typeof BubbleMenu === 'undefined') {
        console.error('FAIL: BubbleMenu is undefined!');
    } else {
        console.log('SUCCESS: BubbleMenu is found.');
    }
} catch (e) {
    console.error('CRITICAL ERROR:', e);
}
