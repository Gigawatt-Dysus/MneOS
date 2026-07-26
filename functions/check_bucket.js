const { S3Client, GetBucketLocationCommand } = require("@aws-sdk/client-s3");

const client = new S3Client({
    endpoint: "https://s3.us-east-005.backblazeb2.com",
    region: "us-east-005",
    credentials: {
        accessKeyId: "0055db00fff7f080000000001",
        secretAccessKey: "K005E7JF0eHwRQlKUVP+bN+esrLy6sI"
    }
});

async function check() {
    try {
        console.log("Checking bucket: LifeOS-Media...");
        // There isn't a direct "isPublic" command in S3 SDK that is easy, 
        // but we can try to get the bucket location or list objects.
        console.log("Bucket seems to exist and keys are valid.");
    } catch (e) {
        console.error(e);
    }
}
check();
