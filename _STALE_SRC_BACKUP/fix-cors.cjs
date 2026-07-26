// fix-cors.cjs
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json"); // Ensure this file exists in root

// Initialize the Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "gigi-time-machine.firebasestorage.app" // Your specific bucket
});

const bucket = admin.storage().bucket();

async function setCors() {
  console.log("🔓 Attempting to unlock CORS on bucket:", bucket.name);

  const corsConfiguration = [
    {
      origin: ["*"], // Allow all websites (including localhost)
      method: ["GET", "HEAD", "PUT", "POST", "DELETE", "OPTIONS"],
      maxAgeSeconds: 3600,
      responseHeader: ["Content-Type", "Access-Control-Allow-Origin"]
    }
  ];

  try {
    await bucket.setCorsConfiguration(corsConfiguration);
    console.log("✅ SUCCESS: CORS configuration applied!");
    console.log("   The AI should now be able to 'see' the images.");
    console.log("   (You may need to clear your browser cache or wait 1 minute).");
  } catch (error) {
    console.error("❌ ERROR setting CORS:", error);
  }
}

setCors();