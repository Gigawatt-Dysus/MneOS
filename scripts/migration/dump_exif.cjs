const fs = require('fs');

const filePath = '\\\\100.116.12.18\\gga_lifeos_vault_alpha\\LifeOS_Archive\\2014 Year End Review\\2014\\02\\DSC_1274-edited.JPG';

try {
    const data = fs.readFileSync(filePath);
    
    // Find the APP1 EXIF segment (FF E1)
    let offset = 2;
    while (offset < data.length) {
        if (data[offset] === 0xFF && data[offset + 1] === 0xE1) {
            const length = (data[offset + 2] << 8) | data[offset + 3];
            const identifier = data.toString('ascii', offset + 4, offset + 10);
            
            if (identifier.includes('Exif')) {
                // Dump the first 1000 characters of the EXIF binary payload
                // to see if we can spot any Google Photos/Snapseed strings
                const payload = data.toString('ascii', offset + 10, offset + Math.min(length, 1000));
                console.log("EXIF DATA SNEAK PEEK:\\n");
                console.log(payload.replace(/[^ -~]/g, '.')); // Replace non-printable chars with dots
                break;
            }
        }
        
        if (data[offset] === 0xFF) {
            const length = (data[offset + 2] << 8) | data[offset + 3];
            offset += length + 2;
        } else {
            break;
        }
    }
} catch (e) {
    console.error("File Read Error:", e);
}
