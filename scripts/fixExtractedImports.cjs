const fs = require('fs');
const path = require('path');

const filesToFix = [
    'sovereignArchives.ts',
    'sovereignBackup.ts',
    'sovereignChat.ts',
    'sovereignDaydream.ts',
    'sovereignEntities.ts',
    'sovereignLeads.ts',
    'sovereignMedia.ts',
    'sovereignPresets.ts'
];

const dir = path.join(__dirname, '../src/services');

filesToFix.forEach(file => {
    const filePath = path.join(dir, file);
    if (!fs.existsSync(filePath)) return;
    
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    content = content.replace(/['"]\.\.\/sovereignCore['"]/g, "'./sovereignCore'");
    content = content.replace(/['"]\.\.\/sovereignDbAdapter['"]/g, "'./sovereignDbAdapter'");
    content = content.replace(/['"]\.\.\/\.\.\/types['"]/g, "'../types'");
    content = content.replace(/['"]\.\.\/dataValidator['"]/g, "'./dataValidator'");
    content = content.replace(/['"]\.\.\/\.\.\/utils\/fileUtils['"]/g, "'../utils/fileUtils'");
    content = content.replace(/['"]\.\.\/storageService['"]/g, "'./storageService'");

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Updated:', filePath);
    }
});
console.log('Done.');
