const { S3Client, ListObjectsV2Command } = require("@aws-sdk/client-s3");

const client = new S3Client({
    endpoint: "https://s3.us-east-005.backblazeb2.com",
    region: "us-east-005",
    credentials: {
        accessKeyId: "0055db00fff7f080000000001",
        secretAccessKey: "K005E7JF0eHwRQlKUVP+bN+esrLy6sI"
    }
});

async function list() {
    try {
        console.log("Listing top-level prefixes/folders...");
        const command = new ListObjectsV2Command({
            Bucket: "LifeOS-Media",
            Delimiter: "/"
        });
        const response = await client.send(command);
        console.log("CommonPrefixes (Top level virtual folders):", JSON.stringify(response.CommonPrefixes, null, 2));
        console.log("Top-level Contents (Files at root):", JSON.stringify(response.Contents?.map(c => ({ Key: c.Key, Size: c.Size })), null, 2));

        // Now let's list the first 5 objects with a prefix 'google'
        console.log("\nListing objects starting with 'google'...");
        const command2 = new ListObjectsV2Command({
            Bucket: "LifeOS-Media",
            Prefix: "google",
            MaxKeys: 10
        });
        const response2 = await client.send(command2);
        console.log("Objects with 'google' prefix:", JSON.stringify(response2.Contents?.map(c => ({ Key: c.Key, Size: c.Size })), null, 2));

        // Let's list the first 5 objects starting with 'LifeOS-Media'
        console.log("\nListing objects starting with 'LifeOS-Media'...");
        const command3 = new ListObjectsV2Command({
            Bucket: "LifeOS-Media",
            Prefix: "LifeOS-Media",
            MaxKeys: 10
        });
        const response3 = await client.send(command3);
        console.log("Objects with 'LifeOS-Media' prefix:", JSON.stringify(response3.Contents?.map(c => ({ Key: c.Key, Size: c.Size })), null, 2));
    } catch (e) {
        console.error("Error listing keys:", e);
    }
}
list();
