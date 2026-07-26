const fs = require('fs');

function hasExif(buffer) {
    let offset = 2; // Skip FFD8
    while (offset < buffer.length) {
        if (buffer[offset] === 0xFF) {
            let marker = buffer[offset + 1];
            let length = buffer.readUInt16BE(offset + 2);
            if (marker === 0xE1) { // APP1 marker usually contains EXIF
                const identifier = buffer.toString('ascii', offset + 4, offset + 8);
                if (identifier === 'Exif') {
                    return true;
                }
            }
            if (marker === 0xDA) break; // SOS (Start of Scan) - image data begins here
            offset += length + 2;
        } else {
            break;
        }
    }
    return false;
}

const files = ['DSC_0001.jpg', 'DSC_0052.jpg', 'DSC_0303.jpg'];
files.forEach(file => {
    const p = `F:/Shutterfly/Extracted/${file}`;
    if(fs.existsSync(p)) {
        const buffer = fs.readFileSync(p);
        console.log(`${file} has EXIF: ${hasExif(buffer)}`);
    }
});
