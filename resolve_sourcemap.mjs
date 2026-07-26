import fs from 'fs';
import { SourceMapConsumer } from 'source-map';

const rawSourceMap = JSON.parse(fs.readFileSync('C:/LifeOS/dist/assets/index-Dt7C6xFz.js.map', 'utf8'));

SourceMapConsumer.with(rawSourceMap, null, consumer => {
  const pos = consumer.originalPositionFor({
    line: 1265,
    column: 3013
  });

  console.log('Original Position:', pos);
});
