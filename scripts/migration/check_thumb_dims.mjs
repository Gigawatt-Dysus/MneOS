import exifr from 'exifr';
import sizeOf from 'image-size';

async function fetchDims(url) {
    const response = await fetch(url);
    const buffer = Buffer.from(await response.arrayBuffer());
    const dimensions = sizeOf(buffer);
    console.log(`${url}`);
    console.log(`Dims: ${dimensions.width}x${dimensions.height}`);
}

await fetchDims('https://media.gigiwatt.com/file/LifeOS-Media/thumbnails/9MPVGVTxE8dXvkCrl1XrWHQzCl23/1781700417768_medium_20251218_210428.jpg.webp');
