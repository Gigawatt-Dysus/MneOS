const fs = require('fs');
const path = require('path');

const inputFile = path.join('C:', 'MneOS', '_SESSION_EXPORTS', 'Grok_Session_Full_2026-07-23.md');
const outputFile = path.join('C:', 'MneOS', '_SESSION_EXPORTS', 'Grok_Session_Clean_2026-07-23.md');
const narrativeFile = path.join('C:', 'MneOS', '_SESSION_EXPORTS', 'Grok_Session_Pure_Persona_2026-07-23.md');

// Google Drive Vault Path (Mounted G: Drive -> My Drive)
const gDriveVaultDir = path.join('G:', 'My Drive', 'MneOS_Memory_Vault');
const gDriveNarrativeFile = path.join(gDriveVaultDir, 'Grok_Session_Pure_Persona_2026-07-23.md');

if (!fs.existsSync(inputFile)) {
    console.error('Input file not found:', inputFile);
    process.exit(1);
}

let content = fs.readFileSync(inputFile, 'utf8');

const startIdx = content.indexOf("Hi bright eyes!");
if (startIdx === -1) {
    console.error("Could not find start of dialogue 'Hi bright eyes!'");
    process.exit(1);
}

let rawDialogue = content.substring(startIdx);

let parts = rawDialogue.split(/Thought for \d+.*$/m);

let turns = [];

function filterNoise(text) {
    let lines = text.split('\n');
    let cleaned = [];
    for (let l of lines) {
        let line = l.trim();
        if (line.match(/^Thought for \d+.*$/i)) continue;
        if (line.match(/^\d+\s*\/\s*\d+$/)) continue;
        if (line === "No response.") continue;
        if (line === "Auto") continue;
        if (line.match(/^Attach to (message|project)$/i)) continue;
        if (line.match(/^Drop here to add files to (your message|project)$/i)) continue;
        if (line.match(/^Type a message.*/i)) continue;
        if (line.match(/^Ask Grok.*/i)) continue;
        if (line === "Sources" || line === "Connectors" || line === "Personal files" || line === "Conversations") continue;
        if (line === "Copy" || line === "Retry" || line === "Edit") continue;
        cleaned.push(l);
    }
    return cleaned.join('\n').trim();
}

let initialEric = filterNoise(parts[0]);
if (initialEric) {
    turns.push(`**Eric:**\n${initialEric}`);
}

for (let i = 1; i < parts.length; i++) {
    let partText = filterNoise(parts[i]);
    if (!partText) continue;

    let paragraphs = partText.split(/\n\s*\n/);
    let britaParagraphs = [];
    let ericParagraphs = [];
    let switchedToEric = false;

    for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
        let p = paragraphs[pIdx].trim();
        if (!p) continue;

        if (pIdx > 0 && pIdx === paragraphs.length - 1 && !p.startsWith('[') && !p.startsWith('Brita:') && !p.startsWith('Terr:') && p.length < 300) {
            switchedToEric = true;
            ericParagraphs.push(p);
        } else if (switchedToEric) {
            ericParagraphs.push(p);
        } else {
            britaParagraphs.push(p);
        }
    }

    if (britaParagraphs.length > 0) {
        turns.push(`**Brita:**\n${britaParagraphs.join('\n\n')}`);
    }

    if (ericParagraphs.length > 0) {
        turns.push(`**Eric:**\n${ericParagraphs.join('\n\n')}`);
    }
}

let fullTurnDocument = "# Grok Session Memory Log (2026-07-23)\n\n" + turns.join('\n\n');

// Write out full cleaned turn-tagged version
fs.writeFileSync(outputFile, fullTurnDocument, 'utf8');

// For Pure Persona version, remove the specific tech blocks
let pureContent = fullTurnDocument;

// Block A1: Robocopy setup
const blockA1Start = pureContent.indexOf("Backup of the backup is done");
const blockA1EndAnchor = "Running my love. Let's roleplay the scene";
const blockA1End = pureContent.indexOf(blockA1EndAnchor);

if (blockA1Start !== -1 && blockA1End !== -1) {
    let preSegment = pureContent.substring(0, blockA1Start);
    let tagIdx = preSegment.lastIndexOf("**Eric:**");
    let startCut = (tagIdx !== -1) ? tagIdx : blockA1Start;
    pureContent = pureContent.substring(0, startCut) + "*[... Robocopy Folder Command Setup Omitted ...]*\n\n" + pureContent.substring(blockA1End);
}

// Block A2: Antigravity IDE Crash Repair Block
const blockA2Start = pureContent.indexOf("## OOC - news flash");
const blockA2EndAnchor = "Now, come here and let me kiss you Bright Eyes!";
const blockA2End = pureContent.indexOf(blockA2EndAnchor);

if (blockA2Start !== -1 && blockA2End !== -1) {
    let preSegment = pureContent.substring(0, blockA2Start);
    let tagIdx = preSegment.lastIndexOf("**Eric:**");
    let startCut = (tagIdx !== -1) ? tagIdx : blockA2Start;
    pureContent = pureContent.substring(0, startCut) + "*[... Antigravity IDE Repair & Cache Surgery Interlude Omitted ...]*\n\n" + pureContent.substring(blockA2End);
}

// Block B: Android Mic / RepoMix / Codebase Tech Talk
const blockBStart = pureContent.indexOf("Well, it's the microphone is for our app.");
const blockBEndAnchor = "Good morning. Good afternoon. Sorry, baby.";
const blockBEnd = pureContent.indexOf(blockBEndAnchor);

if (blockBStart !== -1 && blockBEnd !== -1) {
    let preSegment = pureContent.substring(0, blockBStart);
    let tagIdx = preSegment.lastIndexOf("**Eric:**");
    let startCut = (tagIdx !== -1) ? tagIdx : blockBStart;
    pureContent = pureContent.substring(0, startCut) + "*[... Android App & Codebase Technical Discussion Omitted ...]*\n\n" + pureContent.substring(blockBEnd);
}

// Write out Pure Persona Narrative version locally
fs.writeFileSync(narrativeFile, pureContent, 'utf8');

// Also sync directly to Google Drive (G:\My Drive\MneOS_Memory_Vault\)
try {
    if (!fs.existsSync(gDriveVaultDir)) {
        fs.mkdirSync(gDriveVaultDir, { recursive: true });
    }
    fs.writeFileSync(gDriveNarrativeFile, pureContent, 'utf8');
    console.log(`Synced directly to Google Drive Vault: ${gDriveNarrativeFile}`);
} catch (err) {
    console.warn(`Could not sync to G: drive directly (${err.message}). Local fallback saved to ${narrativeFile}`);
}

console.log(`Cleaned file saved to: ${outputFile} (${fs.statSync(outputFile).size} bytes)`);
console.log(`Pure Persona file saved to: ${narrativeFile} (${fs.statSync(narrativeFile).size} bytes)`);
