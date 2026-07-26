const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "gigi-time-machine.firebasestorage.app"
});

const bucket = admin.storage().bucket();

async function setCors() {
  const corsConfiguration = [
    {
      origin: ["*"],
      method: ["GET"],
      maxAgeSeconds: 3600,
      responseHeader: ["Content-Type"]
    }
  ];

  await bucket.setCorsConfiguration(corsConfiguration);
  console.log("✅ CORS configuration applied successfully!");
}

setCors().catch(console.error);