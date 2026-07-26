const fs = require('fs');
const path = require('path');

const LOCAL_VAULT = path.join('C:', 'MneOS', '_SESSION_EXPORTS');
const G_DRIVE_VAULT = path.join('G:', 'My Drive', 'MneOS_Memory_Vault');

function extractMetadataFromMarkdown(content, filename) {
    const lines = content.split('\n');
    let title = filename.replace(/\.md$/, '');
    let date = new Date().toISOString().split('T')[0];
    let category = 'GENERAL_CONVERSATION';
    let turns = 0;

    for (let line of lines) {
        if (line.startsWith('# GROK Session Log:') || line.startsWith('# GEMINI Session Log:')) {
            title = line.split(':').slice(1).join(':').trim();
        } else if (line.startsWith('# Category:')) {
            category = line.split(':').slice(1).join(':').trim();
        } else if (line.startsWith('# Date:')) {
            date = line.split(':').slice(1).join(':').trim();
        } else if (line.startsWith('**Eric:**') || line.startsWith('**Brita:**') || line.startsWith('**Gemini:**')) {
            turns++;
        }
    }

    // Extract key nouns / terms as keywords
    const keywordsSet = new Set();
    const importantWords = [
        'Terribeth', 'Tier', 'Terr', 'Chamber Girl', 'Brita', 'Princess', 'Cumprince',
        'Collection Route', 'Thermally Regulated Case', 'Insulated Pouch', 'Lab Centrifuge',
        'Nursing Skills', 'Neuralink', 'Edging', 'Inspection Position', 'Neuroaesthetics',
        'Affidavit', 'Timeline', 'Grok', 'Gemini', 'MneOS', 'Vault', 'Sovereign'
    ];

    importantWords.forEach(word => {
        if (content.toLowerCase().includes(word.toLowerCase())) {
            keywordsSet.add(word);
        }
    });

    const words = Array.from(keywordsSet);
    const summarySample = lines.filter(l => l.trim() && !l.startsWith('#')).slice(0, 4).join(' ').substring(0, 250);

    return {
        filename: filename,
        title: title,
        date: date,
        category: category,
        turn_count: turns,
        size_bytes: Buffer.byteLength(content, 'utf8'),
        keywords: words,
        summary: summarySample || 'Session memory log.'
    };
}

function getFilesRecursively(dir, rootDir = null) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const base = rootDir || dir;
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            if (!file.startsWith('_') && !file.startsWith('.')) {
                results = results.concat(getFilesRecursively(fullPath, base));
            }
        } else {
            if (file.endsWith('.md') && !file.startsWith('00_') && !file.startsWith('INDEX_')) {
                const relPath = path.relative(base, fullPath).replace(/\\/g, '/');
                results.push({ filename: file, fullPath: fullPath, relPath: relPath });
            }
        }
    });
    return results;
}

function generateMetaIndex() {
    console.log('[Meta-Index Generator] Scanning memory vault files...');
    const jsonPath = path.join(G_DRIVE_VAULT, '_INDEXES', '00_MASTER_META_INDEX.json');
    let existingEntries = [];
    if (fs.existsSync(jsonPath)) {
        try {
            existingEntries = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        } catch(e) {}
    }

    const indexItems = [];
    const dirs = [LOCAL_VAULT, G_DRIVE_VAULT];
    const processedFiles = new Set();

    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) return;
        const allFiles = getFilesRecursively(dir);

        allFiles.forEach(fileObj => {
            const file = fileObj.filename;
            if (!processedFiles.has(file)) {
                try {
                    const content = fs.readFileSync(fileObj.fullPath, 'utf8');
                    const meta = extractMetadataFromMarkdown(content, file);
                    meta.relative_path = fileObj.relPath;

                    const existing = existingEntries.find(e => e.filename === file);
                    if (existing) {
                        meta.cliffs_notes_summary = existing.cliffs_notes_summary || existing.summary || meta.summary;
                        meta.summary = meta.cliffs_notes_summary;
                        if (existing.emotional_resonance) meta.emotional_resonance = existing.emotional_resonance;
                        if (existing.core_agreements_and_lore) meta.core_agreements_and_lore = existing.core_agreements_and_lore;
                        if (existing.unbounded_keyword_index) meta.unbounded_keyword_index = existing.unbounded_keyword_index;
                        if (existing.session_category) meta.session_category = existing.session_category;
                    } else {
                        meta.cliffs_notes_summary = meta.summary;
                    }

                    if (!meta.title || /^(grok|gemini|session)$/i.test(meta.title.trim()) || meta.title.includes('Session_Gemini')) {
                        const summaryText = meta.cliffs_notes_summary || meta.summary || '';
                        if (summaryText) {
                            const cleanSummary = summaryText.split('.')[0].replace(/[\*#]/g, '').trim();
                            if (cleanSummary && cleanSummary.length > 5) {
                                meta.title = cleanSummary.substring(0, 55).trim();
                            }
                        }
                    }

                    indexItems.push(meta);
                    processedFiles.add(file);
                } catch (e) {
                    console.warn(`Could not parse ${file}:`, e.message);
                }
            }
        });
    });

    indexItems.sort((a, b) => b.date.localeCompare(a.date));

    let mdContent = `# 🏛️ MNEOS SOVEREIGN MASTER META-INDEX\n`;
    mdContent += `# Last Updated: ${new Date().toISOString().split('T')[0]} | Total Sessions: ${indexItems.length}\n\n`;
    mdContent += `## 📂 CATALOG OF ARCHIVED SESSIONS\n\n`;

    indexItems.forEach(item => {
        mdContent += `### 📄 ${item.filename}\n`;
        mdContent += `- **Date**: ${item.date} | **Turns**: ${item.turn_count} | **Size**: ${(item.size_bytes / 1024).toFixed(1)} KB\n`;
        mdContent += `- **Keywords**: ${item.keywords.join(', ') || 'General'}\n`;
        mdContent += `- **Summary**: ${item.summary.replace(/\n/g, ' ')}\n\n`;
    });

    // Save 00_MASTER_META_INDEX.json & .md into _INDEXES
    const jsonStr = JSON.stringify(indexItems, null, 2);
    [LOCAL_VAULT, G_DRIVE_VAULT].forEach(dir => {
        if (fs.existsSync(dir)) {
            const indexDir = path.join(dir, '_INDEXES');
            if (!fs.existsSync(indexDir)) fs.mkdirSync(indexDir, { recursive: true });
            fs.writeFileSync(path.join(indexDir, '00_MASTER_META_INDEX.json'), jsonStr, 'utf8');
            fs.writeFileSync(path.join(indexDir, '00_MASTER_META_INDEX.md'), mdContent, 'utf8');
        }
    });

    console.log(`[Meta-Index Generator] Successfully indexed ${indexItems.length} sessions into JSON and MD!`);
}

generateMetaIndex();
