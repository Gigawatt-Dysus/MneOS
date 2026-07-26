"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// scripts/migration/mass_heal_swarm.ts
var import_dotenv = __toESM(require("dotenv"), 1);
var import_path = __toESM(require("path"), 1);
var import_os = __toESM(require("os"), 1);
var import_mongodb = require("mongodb");
var import_sqlite3 = __toESM(require("sqlite3"), 1);
var import_client_s3 = require("@aws-sdk/client-s3");
var import_sharp = __toESM(require("sharp"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_exifr = __toESM(require("exifr"), 1);
import_dotenv.default.config({ path: ".env.local" });
var NODE_ID = process.env.NODE_ID || import_os.default.hostname().toUpperCase();
var MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT || "3", 10);
var FDRIVE_PREFIX = process.env.FDRIVE_PREFIX || "F:\\";
var MAX_TOTAL_PROCESS = parseInt(process.env.MAX_TOTAL_PROCESS || "500000", 10);
var DRY_RUN = false;
var getS3Client = () => {
  let endpoint = process.env.B2_ENDPOINT || "s3.us-east-005.backblazeb2.com";
  if (!endpoint.startsWith("http")) endpoint = `https://${endpoint}`;
  return new import_client_s3.S3Client({
    region: process.env.B2_REGION || "us-east-005",
    endpoint,
    credentials: {
      accessKeyId: process.env.B2_ACCESS_KEY_ID,
      secretAccessKey: process.env.B2_SECRET_ACCESS_KEY
    }
  });
};
var querySqlite = (db, sql, params) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
  });
};
async function processImage(record, collection, sqliteDb, s3Client, bucketName) {
  let extractedDate = null;
  try {
    const fileName = record.fileName || record.originalName;
    if (!fileName) throw new Error("No filename available");
    let sqliteRow = await querySqlite(
      sqliteDb,
      "SELECT filepath FROM files WHERE filename = ? AND size = ?",
      [fileName, record.size]
    );
    if (!sqliteRow || !sqliteRow.filepath) {
      sqliteRow = await querySqlite(
        sqliteDb,
        "SELECT filepath FROM files WHERE filename = ? LIMIT 1",
        [fileName]
      );
    }
    let fDrivePath = sqliteRow ? sqliteRow.filepath : null;
    if (fDrivePath && fDrivePath.startsWith("F:\\") && FDRIVE_PREFIX !== "F:\\") {
      fDrivePath = fDrivePath.replace("F:\\", FDRIVE_PREFIX + (FDRIVE_PREFIX.endsWith("\\") ? "" : "\\"));
    }
    if (!DRY_RUN) {
      let originalBuffer;
      if (fDrivePath && import_fs.default.existsSync(fDrivePath)) {
        originalBuffer = import_fs.default.readFileSync(fDrivePath);
      } else if (record.url) {
        console.log(`[${NODE_ID}] File missing locally (MAX_PATH limit). Streaming from B2: ${record.url}`);
        const fetchResponse = await fetch(record.url);
        if (!fetchResponse.ok) throw new Error(`B2 Fetch failed: ${fetchResponse.status} ${fetchResponse.statusText}`);
        const ab = await fetchResponse.arrayBuffer();
        originalBuffer = Buffer.from(ab);
      } else {
        throw new Error(`File missing locally and no B2 URL found for fallback.`);
      }
      try {
        const exifData = await import_exifr.default.parse(originalBuffer);
        if (exifData && exifData.DateTimeOriginal) {
          extractedDate = new Date(exifData.DateTimeOriginal);
        } else if (exifData && exifData.CreateDate) {
          extractedDate = new Date(exifData.CreateDate);
        }
      } catch (exifErr) {
      }
      const thumbSizes = { small: 300, medium: 800, large: 1600 };
      const newThumbnailUrls = {};
      const timestamp = Date.now();
      const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
      let exifRotation = 0;
      try {
        const exifData = await import_exifr.default.parse(originalBuffer);
        if (exifData && exifData.Orientation) {
          const orientationStr = exifData.Orientation.toString().toLowerCase();
          if (orientationStr.includes("180") || exifData.Orientation === 3) exifRotation = 180;
          else if (orientationStr.includes("90 cw") || exifData.Orientation === 6) exifRotation = 90;
          else if (orientationStr.includes("270 cw") || orientationStr.includes("90 ccw") || exifData.Orientation === 8) exifRotation = 270;
        }
      } catch (e) {
      }
      let finalBuffer = await (0, import_sharp.default)(originalBuffer, { failOn: "none" }).rotate().toBuffer();
      let dbRotation = 0;
      if (typeof record.rotation === "number") {
        dbRotation = record.rotation;
      } else if (typeof record.orientation === "number") {
        if (record.orientation === 6) dbRotation = 90;
        else if (record.orientation === 3) dbRotation = 180;
        else if (record.orientation === 8) dbRotation = 270;
      }
      if (dbRotation > 0 && dbRotation % 360 !== 0) {
        if (dbRotation !== exifRotation) {
          console.log(`[${NODE_ID}] \u26A0\uFE0F Manual UI rotation detected! Stacking ${dbRotation} deg.`);
          finalBuffer = await (0, import_sharp.default)(finalBuffer).rotate(dbRotation).toBuffer();
        }
      }
      const rotatedSharp = (0, import_sharp.default)(finalBuffer);
      const metadata = await rotatedSharp.metadata();
      const physicalWidth = metadata.width;
      const physicalHeight = metadata.height;
      for (const [sizeName, width] of Object.entries(thumbSizes)) {
        const resizedBuffer = await rotatedSharp.clone().resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
        let objectKey = "";
        if (record.thumbnailUrls && record.thumbnailUrls[sizeName]) {
          const urlParts = record.thumbnailUrls[sizeName].split(`/file/${bucketName}/`);
          if (urlParts.length === 2) {
            objectKey = urlParts[1];
          }
        }
        if (!objectKey) {
          objectKey = `thumbnails/${record.userId || "migration"}/${timestamp}_${sizeName}_${safeName}.webp`;
        }
        await s3Client.send(new import_client_s3.PutObjectCommand({
          Bucket: bucketName,
          Key: objectKey,
          ContentType: "image/webp",
          Body: resizedBuffer
        }));
        newThumbnailUrls[sizeName] = `https://media.gigiwatt.com/file/${bucketName}/${objectKey}`;
      }
      const updatePayload = {
        thumbnailUrls: newThumbnailUrls,
        thumbnail_metadata_healed: true
      };
      if (extractedDate && !isNaN(extractedDate.getTime())) {
        updatePayload.logicalDate = extractedDate;
      }
      await collection.updateOne(
        { _id: record._id },
        {
          $set: updatePayload,
          $unset: { processing_lock: "", locked_at: "", rotation: "", orientation: "" }
        }
      );
      console.log(`[${NODE_ID}] \u2705 Healed: ${fileName} ${extractedDate ? `[${extractedDate.toISOString().split("T")[0]}]` : ""}`);
    }
  } catch (err) {
    console.error(`[${NODE_ID}] \u274C Error processing ${record.originalName}: ${err.message}`);
    await collection.updateOne(
      { _id: record._id },
      {
        $set: {
          thumbnail_metadata_healed: true,
          processing_error: err.message
        },
        $unset: { processing_lock: "", locked_at: "" }
      }
    );
  }
}
async function runSwarm() {
  console.log(`
\u{1F41D} [SWARM NODE: ${NODE_ID}] Online.`);
  console.log(`\u2699\uFE0F  Concurrency: ${MAX_CONCURRENT} | Drive Prefix: ${FDRIVE_PREFIX}`);
  console.log(`\u{1F3AF} Target: Omni-scan across Alpha and Atlas databases.
`);
  const uris = [
    { name: "Alpha Vault", uri: process.env.MONGODB_URI || "mongodb://zen:sovereign@100.116.12.18:27017/LifeOS?authSource=admin" },
    { name: "Atlas Cloud", uri: process.env.ATLAS_CLOUD_URI }
  ].filter((db) => db.uri);
  const stagingDbPath = import_path.default.join(FDRIVE_PREFIX, "staging.db");
  const sqliteDb = new import_sqlite3.default.Database(stagingDbPath, import_sqlite3.default.OPEN_READONLY, (err) => {
    if (err) {
      console.error(`\u274C Failed to open staging.db at ${stagingDbPath}`);
      process.exit(1);
    }
  });
  const s3Client = getS3Client();
  const bucketName = process.env.B2_BUCKET_NAME || "LifeOS-Media";
  let totalProcessed = 0;
  for (const dbConfig of uris) {
    console.log(`
=============================================`);
    console.log(`\u{1F50C} Connecting to ${dbConfig.name}...`);
    const mongoClient = new import_mongodb.MongoClient(dbConfig.uri);
    await mongoClient.connect();
    const db = mongoClient.db("LifeOS");
    const collections = await db.listCollections().toArray();
    for (const colInfo of collections) {
      const collection = db.collection(colInfo.name);
      let collectionEmpty = false;
      while (!collectionEmpty && totalProcessed < MAX_TOTAL_PROCESS) {
        const queue = [];
        for (let i = 0; i < MAX_CONCURRENT; i++) {
          const doc = await collection.findOneAndUpdate(
            {
              fileType: { $regex: /^image\//i },
              $or: [
                { thumbnail_metadata_healed: { $ne: true } },
                { rotation: { $exists: true } },
                { orientation: { $exists: true } }
              ],
              processing_lock: { $exists: false }
            },
            {
              $set: {
                processing_lock: NODE_ID,
                locked_at: /* @__PURE__ */ new Date()
              }
            },
            { returnDocument: "after" }
          );
          if (!doc) {
            collectionEmpty = true;
            break;
          }
          totalProcessed++;
          queue.push(processImage(doc, collection, sqliteDb, s3Client, bucketName));
        }
        if (queue.length > 0) {
          await Promise.all(queue);
        }
      }
      if (totalProcessed >= MAX_TOTAL_PROCESS) break;
    }
    await mongoClient.close();
    if (totalProcessed >= MAX_TOTAL_PROCESS) break;
  }
  console.log(`
\u{1F3C1} [${NODE_ID}] Swarm cycle complete. Processed: ${totalProcessed}`);
  process.exit(0);
}
runSwarm().catch((err) => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
