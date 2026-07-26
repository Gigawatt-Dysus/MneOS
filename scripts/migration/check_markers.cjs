const fs = require('fs');

const filePath = '\\\\100.116.12.18\\gga_lifeos_vault_alpha\\LifeOS_Archive\\2014 Year End Review\\2014\\02\\DSC_1274-edited.JPG';

try {
    const data = fs.readFileSync(filePath);
    console.log('Read ' + data.length + ' bytes');
    
    // Look for EXIF/APP1 marker (FF E1) to see if there's any EXIF data at all
    if (data[0] === 0xFF && data[1] === 0xD8) {
        console.log("Valid JPEG SOI found.");
        
        let offset = 2;
        while (offset < data.length) {
            if (data[offset] === 0xFF) {
                const marker = data[offset + 1];
                const length = (data[offset + 2] << 8) | data[offset + 3];
                
                console.log(`Marker: FF ${marker.toString(16).toUpperCase().padStart(2, '0')}, Length: ${length}`);
                
                if (marker === 0xDA) { // Start of Scan (SOS)
                    break;
                }
                
                // If it's APP1 (EXIF or XMP)
                if (marker === 0xE1) {
                    const identifier = data.toString('ascii', offset + 4, offset + 10);
                    console.log(`  APP1 Identifier: ${identifier}`);
                }
                
                offset += length + 2;
            } else {
                break;
            }
        }
    }
} catch (e) {
    console.error("File Read Error:", e);
}
