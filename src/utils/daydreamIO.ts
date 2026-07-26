import mammoth from 'mammoth';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

// --- IMPORT (.docx -> HTML) ---
export const importDocxToHtml = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const arrayBuffer = e.target?.result as ArrayBuffer;
                if (!arrayBuffer) {
                    reject(new Error("Empty file"));
                    return;
                }
                const result = await mammoth.convertToHtml({ arrayBuffer });
                resolve(result.value); // The generated HTML
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = (err) => reject(err);
        reader.readAsArrayBuffer(file);
    });
};

// --- EXPORT (TipTap JSON -> .docx blob) ---
export const exportStoryToDocx = async (title: string, tiptapContent: any): Promise<void> => {

    // Recursive function to parse TipTap nodes into Docx elements
    const parseNode = (node: any): Paragraph | null => {
        if (!node.type) return null;

        // Base paragraph options
        let children: TextRun[] = [];

        if (node.content) {
            children = node.content.map((child: any) => {
                if (child.type === 'text') {
                    // Extract styles
                    const isBold = child.marks?.some((m: any) => m.type === 'bold');
                    const isItalic = child.marks?.some((m: any) => m.type === 'italic');

                    return new TextRun({
                        text: child.text,
                        bold: isBold,
                        italics: isItalic,
                    });
                }
                return new TextRun({ text: "" }); // Fallback
            });
        }

        // Handle Types
        switch (node.type) {
            case 'paragraph':
                // Check alignment
                let alignment: any = AlignmentType.LEFT;
                if (node.attrs?.textAlign === 'center') alignment = AlignmentType.CENTER;
                if (node.attrs?.textAlign === 'right') alignment = AlignmentType.RIGHT;
                if (node.attrs?.textAlign === 'justify') alignment = AlignmentType.JUSTIFIED;

                return new Paragraph({
                    children,
                    alignment,
                    spacing: { after: 200 }, // spacing
                });

            case 'heading':
                const level = node.attrs?.level || 1;
                return new Paragraph({
                    children,
                    heading: level === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
                    spacing: { after: 200, before: 200 },
                });

            case 'bulletList':
                // Complex handling skipped for MVP, flatter structure usually
                // Use standard paragraphs for now unless we iterate children differently
                // TipTap structures lists as nested nodes. 
                // For this MVP, we might skip deep list parsing or just flatten text.
                return null; // TODO: Implement list recursive parsing logic if needed

            default:
                return null;
        }
    };

    // Flatten logic for lists (TipTap structure is weird for direct mapping)
    // Actually, let's just iterate top level nodes
    try {
        // [ZEN FIX] Safety wrapper
        const docChildren: Paragraph[] = [];

        // Title Page
        docChildren.push(new Paragraph({
            children: [new TextRun({ text: title, bold: true, size: 48 })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 800 }
        }));

        if (tiptapContent.content) {
            tiptapContent.content.forEach((node: any) => {
                // Special handling for lists since they nest 'listItem' -> 'paragraph'
                if (node.type === 'bulletList' || node.type === 'orderedList') {
                    if (node.content) {
                        node.content.forEach((li: any) => {
                            if (li.content) {
                                li.content.forEach((p: any) => {
                                    // Force bullet char? Docx handles lists differently.
                                    // Simulating simple list for MVP
                                    if (p.content) {
                                        const run = p.content[0];
                                        docChildren.push(new Paragraph({
                                            children: [
                                                new TextRun({ text: "• ", bold: true }),
                                                new TextRun({
                                                    text: run.text,
                                                    bold: run.marks?.some((m: any) => m.type === 'bold'),
                                                    italics: run.marks?.some((m: any) => m.type === 'italic')
                                                })
                                            ],
                                            indent: { left: 720 } // 0.5 inch
                                        }));
                                    }
                                });
                            }
                        });
                    }
                } else {
                    const parsed = parseNode(node);
                    if (parsed) docChildren.push(parsed);
                }
            });
        }

        const doc = new Document({
            sections: [{
                properties: {},
                children: docChildren,
            }],
        });

        const blob = await Packer.toBlob(doc);
        saveAs(blob, `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.docx`);

    } catch (e) {
        console.error("Docx Export Fatal Error", e);
        throw e; // Re-throw to be caught by UI
    }
};
