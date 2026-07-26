
import { readGedcom } from 'read-gedcom';
import { GedcomData, GedcomPerson, GedcomFamily, GedcomMediaRef, GedcomEvent, GedcomNote } from './types';

/**
 * [ZEN] The V'Ger Shield
 * This service parses GEDCOM files into an in-memory "Safe" structure.
 * It enforces the "Narrative Quarantine" and "Light Cone" filtering.
 */

// [ZEN] Raw Node Interface matching read-gedcom internal structure
interface GedcomNode {
    tag: string;
    value?: string;
    pointer?: string;
    xref_id?: string;
    children: GedcomNode[]; // [ZEN FIX] Was 'tree', actual property is 'children'
}

export class GedcomReader {

    /**
     * Parse raw GEDCOM buffer into a safe, structured object using Manual Traversal.
     * This bypasses the Selection API which was causing TypeErrors.
     */
    static async parse(buffer: ArrayBuffer): Promise<GedcomData> {
        console.log(`[GedcomReader] Starting Raw Parse. Buffer size: ${buffer.byteLength} bytes`);

        const rootSelection = readGedcom(buffer);

        // We extract the Raw Nodes from the root selection
        const indiNodes = rootSelection.getIndividualRecord().array() as unknown as GedcomNode[];
        const famNodes = rootSelection.getFamilyRecord().array() as unknown as GedcomNode[];
        const objeNodes = rootSelection.getMultimediaRecord().array() as unknown as GedcomNode[];

        console.log(`[GedcomReader] Found Nodes: ${indiNodes.length} INDIs, ${famNodes.length} FAMs, ${objeNodes.length} OBJEs`);

        const data: GedcomData = {
            people: {},
            families: {},
            media: {},
            metadata: {
                submitter: 'Ancestry User',
                gedcomVersion: '5.5.1'
            }
        };

        // --- Helpers ---
        const getChild = (node: GedcomNode, tag: string): GedcomNode | undefined => {
            return node.children?.find(n => n.tag === tag);
        };
        const getChildren = (node: GedcomNode, tag: string): GedcomNode[] => {
            return node.children?.filter(n => n.tag === tag) || [];
        };
        const getValue = (node: GedcomNode, tag: string): string => {
            return getChild(node, tag)?.value || '';
        };

        // --- 1. Parse Media (OBJE) ---
        objeNodes.forEach(node => {
            const id = node.pointer || node.xref_id;
            if (!id) return;

            // Ancestry: FILE tag often contains the URL/Path
            const fileNode = getChild(node, 'FILE');
            const rawUrl = fileNode?.value || '';
            const format = (getChild(fileNode || node, 'FORM')?.value || '').toLowerCase();
            const title = getValue(node, 'TITL') || 'Untitled Media';

            // Custom Tags (Ancestry uses _DATE, PLAC in weird spots)
            // We just scan all children for these common tags
            let date = '';
            let place = '';

            node.children?.forEach(child => {
                if (child.tag === 'DATE' || child.tag === '_DATE') date = child.value || date;
                if (child.tag === 'PLAC') place = child.value || place;
            });

            data.media[id] = {
                id,
                url: rawUrl, // Note: Ancestry URLs are often local paths or weird links
                title,
                mimeType: format,
                date,
                place,
                isExternal: !format.includes('jpg') && !format.includes('png')
            };
        });

        // --- 2. Parse Individuals ---
        indiNodes.forEach(node => {
            if (indiNodes.indexOf(node) === 0) {
                console.log('[GedcomReader] First INDI Record Keys:', Object.keys(node));
                // Also inspect the first property value to see if it's an array
                Object.entries(node).forEach(([k, v]) => {
                    if (Array.isArray(v)) console.log(`[GedcomReader] Property '${k}' is an Array[${v.length}]`);
                });
            }

            const id = node.pointer || node.xref_id;
            if (!id) return;

            // Name
            const nameNode = getChild(node, 'NAME');
            let given = '';
            let surname = '';
            let full = nameNode?.value || 'Unknown';

            if (nameNode) {
                given = getValue(nameNode, 'GIVN');
                surname = getValue(nameNode, 'SURN');
                // Fallback splitting if GIVN/SURN missing (common in old GEDCOM)
                if (!given && !surname && full) {
                    const parts = full.replace(/\//g, '').split(' ');
                    surname = parts.pop() || '';
                    given = parts.join(' ');
                }
            }

            const sex = (getValue(node, 'SEX') || 'U').toUpperCase() as 'M' | 'F' | 'U';

            // Events
            const events: GedcomEvent[] = [];
            const parseEvent = (evNode: GedcomNode) => {
                const type = evNode.tag; // BIRT, DEAT, etc
                const date = getValue(evNode, 'DATE');
                const place = getValue(evNode, 'PLAC');
                const desc = evNode.value || ''; // Description often inline "Occupy: Carpenter"

                const notes = getChildren(evNode, 'NOTE').map(n => n.value || '').filter(s => !!s);

                events.push({
                    type,
                    date,
                    place,
                    description: desc,
                    notes
                });
            };

            ['BIRT', 'DEAT', 'CHR', 'BAPM', 'BURI', 'CREM', 'EDUC', 'OCCU', 'RESI'].forEach(tag => {
                getChildren(node, tag).forEach(parseEvent);
            });
            // Handle generic EVEN tags
            getChildren(node, 'EVEN').forEach(ev => {
                // Check TYPE
                const type = getValue(ev, 'TYPE') || 'EVENT';
                // We treat it as a generic event with the type string
                const date = getValue(ev, 'DATE');
                const place = getValue(ev, 'PLAC');
                events.push({ type, date, place, description: ev.value, notes: [] });
            });


            // Media Links (OBJE)
            const mediaRefs: GedcomMediaRef[] = [];
            getChildren(node, 'OBJE').forEach(link => {
                const target = link.value || ''; // Pointer @O123@
                // Sometimes the OBJE is INLINE (No pointer)
                if (target.includes('@')) {
                    const ref = data.media[target];
                    if (ref) mediaRefs.push(ref);
                } else {
                    // Inline Media (Ancestry does this too)
                    const file = getChild(link, 'FILE')?.value;
                    const titl = getValue(link, 'TITL');
                    if (file) {
                        mediaRefs.push({
                            id: `inline-${Math.random()}`,
                            url: file,
                            title: titl || 'Inline Media',
                            date: '', place: '', isExternal: false, mimeType: 'image/jpeg'
                        });
                    }
                }
            });

            // Notes (Quarantine)
            const notes: GedcomNote[] = [];
            getChildren(node, 'NOTE').forEach(n => {
                if (n.value) notes.push({ text: n.value, isQuarantined: true, sourceId: 'GEDCOM' });
            });

            // Family Links
            const spouseFams = getChildren(node, 'FAMS').map(n => n.value || '').filter(Boolean);
            const parentFams = getChildren(node, 'FAMC').map(n => n.value || '').filter(Boolean);

            // [ZEN] Reconstruct Raw GEDCOM for AI
            // Since we don't have the original text slice easily available from read-gedcom selection,
            // we reconstruct it from the node structure. It's close enough for the AI.
            const reconstructRawGedcom = (n: GedcomNode, level: number = 0): string => {
                let line = `${level} ${n.tag}`;
                if (n.pointer) line += ` ${n.pointer}`; // Pointers usually come before value in def, or after tag in ref? 
                // Actually read-gedcom parses: 0 @I1@ INDI. Tag=INDI, Pointer=@I1@.
                // But for sub-tags: 1 NAME Eric. Tag=NAME, Value=Eric.

                // Correction based on common structure:
                // Level + [Optional Pointer] + Tag + [Optional Value]
                // Our internal node has 'tag', 'value', 'pointer'.
                // If it's a record def: 0 @P1@ INDI. Pointer is set.
                // If it's a property: 1 NAME Eric. Value is set.

                let str = '';
                if (n.pointer && level === 0) {
                    str = `${level} ${n.pointer} ${n.tag}`;
                } else {
                    str = `${level} ${n.tag}`;
                    if (n.value) str += ` ${n.value}`;
                }

                // Recurse
                if (n.children && n.children.length > 0) {
                    const childLines = n.children.map(c => reconstructRawGedcom(c, level + 1)).join('\n');
                    return str + '\n' + childLines;
                }
                return str;
            };

            const rawBlock = reconstructRawGedcom(node, 0);

            data.people[id] = {
                id,
                name: { given, surname, full },
                sex,
                events,
                media: mediaRefs,
                notes,
                spouseFamilyIds: spouseFams,
                parentFamilyIds: parentFams,
                raw: rawBlock
            };
        });

        // --- 3. Parse Families ---
        famNodes.forEach(node => {
            const id = node.pointer || node.xref_id;
            if (!id) return;

            const husb = getValue(node, 'HUSB');
            const wife = getValue(node, 'WIFE');
            const childs = getChildren(node, 'CHIL').map(n => n.value || '');

            const marrEvents = getChildren(node, 'MARR').map(m => ({
                type: 'MARR',
                date: getValue(m, 'DATE'),
                place: getValue(m, 'PLAC'),
                notes: []
            }));

            data.families[id] = {
                id,
                husbandId: husb,
                wifeId: wife,
                childrenIds: childs,
                events: marrEvents
            };
        });

        console.log(`[GedcomReader] Done. Parsed ${Object.keys(data.people).length} people.`);
        return data;
    }
}
