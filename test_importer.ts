import { parseLegacyData } from './src/services/importer';

const fakeFbData = {
    historyData: [
        {
            title: "Eric liked a photo.",
            timestamp: 1622505600,
            tags: ["noise"]
        },
        {
            title: "Eric is now friends with John Doe.",
            timestamp: 1622505600,
            tags: ["friendship"]
        },
        {
            title: "Eric reacted to a post.",
            timestamp: 1622505600,
            tags: ["noise"]
        }
    ]
};

try {
    const result = parseLegacyData(JSON.stringify(fakeFbData));
    console.log(`Parsed ${result.events.length} events.`);
    result.events.forEach(e => {
        console.log(`- ${e.title}`);
    });
} catch (e) {
    console.error(e);
}
