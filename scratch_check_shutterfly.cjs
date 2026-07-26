const fs = require('fs');
const crypto = require('crypto');
// We can use a simple way to get image dimensions without an external library for JPEGs
function getJpegDimensions(buffer) {
    let offset = 2; // Skip FFD8
    while (offset < buffer.length) {
        if (buffer[offset] === 0xFF) {
            let marker = buffer[offset + 1];
            let length = buffer.readUInt16BE(offset + 2);
            if (marker === 0xC0 || marker === 0xC2) { // SOF0 or SOF2
                let height = buffer.readUInt16BE(offset + 5);
                let width = buffer.readUInt16BE(offset + 7);
                return { width, height };
            }
            offset += length + 2;
        } else {
            break;
        }
    }
    return null;
}

const files = ['DSC_0001.jpg', 'DSC_0052.jpg', 'DSC_0303.jpg'];
files.forEach(file => {
    const p = `F:/Shutterfly/Extracted/${file}`;
    if(fs.existsSync(p)) {
        const stats = fs.statSync(p);
        const buffer = fs.readFileSync(p);
        const dims = getJpegDimensions(buffer);
        console.log(`${file}: ${dims ? dims.width + 'x' + dims.height : 'unknown'} (${(stats.size / 1024).toFixed(2)} KB)`);
    } else {
        console.log(`${file} not found`);
    }
});
