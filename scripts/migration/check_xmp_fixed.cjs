const fs = require('fs');

// Correct UNC path with 'LifeOS_Archive'
const filePath = '\\\\100.116.12.18\\gga_lifeos_vault_alpha\\LifeOS_Archive\\2014 Year End Review\\2014\\02\\DSC_1274-edited.JPG';

try {
    const data = fs.readFileSync(filePath);
    console.log('Read ' + data.length + ' bytes');
    
    // Convert the first 50KB to string to hunt for XMP tags
    const str = data.toString('utf8', 0, Math.min(data.length, 50000));
    const xmpMatch = str.match(/<x:xmpmeta[\s\S]*?<\/x:xmpmeta>/);
    
    if (xmpMatch) {
        console.log('ðŸ“œ XMP METADATA FOUND:\\n', xmpMatch[0].substring(0, 1000));
    } else {
        console.log('â Œ NO XMP METADATA FOUND');
    }
} catch (e) {
    console.error("File Read Error:", e);
}
