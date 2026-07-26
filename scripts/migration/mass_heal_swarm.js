"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var dotenv_1 = require("dotenv");
var path_1 = require("path");
var os_1 = require("os");
// Load environment variables
dotenv_1.default.config({ path: '.env.local' });
var mongodb_1 = require("mongodb");
var sqlite3_1 = require("sqlite3");
var client_s3_1 = require("@aws-sdk/client-s3");
var sharp_1 = require("sharp");
var fs_1 = require("fs");
var exifr_1 = require("exifr");
// --- SWARM CONFIGURATION ---
var NODE_ID = process.env.NODE_ID || os_1.default.hostname().toUpperCase();
var MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT || '3', 10);
// Crucial for Swarm: Map F: to local paths. On Victus/Beta/Gamma this should be "\\100.116.12.18\F" if accessed over network
var FDRIVE_PREFIX = process.env.FDRIVE_PREFIX || 'F:\\';
var MAX_TOTAL_PROCESS = parseInt(process.env.MAX_TOTAL_PROCESS || '500000', 10); // Safe exit threshold per run
var DRY_RUN = false;
// ---------------------------
var getS3Client = function () {
    var endpoint = process.env.B2_ENDPOINT || "s3.us-east-005.backblazeb2.com";
    if (!endpoint.startsWith('http'))
        endpoint = "https://".concat(endpoint);
    return new client_s3_1.S3Client({
        region: process.env.B2_REGION || "us-east-005",
        endpoint: endpoint,
        credentials: {
            accessKeyId: process.env.B2_ACCESS_KEY_ID,
            secretAccessKey: process.env.B2_SECRET_ACCESS_KEY,
        },
    });
};
var querySqlite = function (db, sql, params) {
    return new Promise(function (resolve, reject) {
        db.get(sql, params, function (err, row) { return err ? reject(err) : resolve(row); });
    });
};
function processImage(record, collection, sqliteDb, s3Client, bucketName) {
    return __awaiter(this, void 0, void 0, function () {
        var extractedDate, fileName, sqliteRow, fDrivePath, originalBuffer, exifData, exifErr_1, thumbSizes, newThumbnailUrls, timestamp, safeName, _i, _a, _b, sizeName, width, resizedBuffer, objectKey, urlParts, updatePayload, err_1;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    extractedDate = null;
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 16, , 18]);
                    fileName = record.fileName || record.originalName;
                    if (!fileName)
                        throw new Error('No filename available');
                    return [4 /*yield*/, querySqlite(sqliteDb, "SELECT filepath FROM files WHERE filename = ? AND size = ?", [fileName, record.size])];
                case 2:
                    sqliteRow = _c.sent();
                    if (!(!sqliteRow || !sqliteRow.filepath)) return [3 /*break*/, 4];
                    return [4 /*yield*/, querySqlite(sqliteDb, "SELECT filepath FROM files WHERE filename = ? LIMIT 1", [fileName])];
                case 3:
                    // Fallback for null/missing sizes or deduplication anomalies
                    sqliteRow = _c.sent();
                    _c.label = 4;
                case 4:
                    if (!sqliteRow || !sqliteRow.filepath) {
                        throw new Error("Could not find ".concat(fileName, " (").concat(record.size || 'null', " bytes) in staging.db"));
                    }
                    fDrivePath = sqliteRow.filepath;
                    if (fDrivePath.startsWith('F:\\') && FDRIVE_PREFIX !== 'F:\\') {
                        fDrivePath = fDrivePath.replace('F:\\', FDRIVE_PREFIX + (FDRIVE_PREFIX.endsWith('\\') ? '' : '\\'));
                    }
                    if (!fs_1.default.existsSync(fDrivePath)) {
                        throw new Error("File missing on disk at remapped path: ".concat(fDrivePath));
                    }
                    if (!!DRY_RUN) return [3 /*break*/, 15];
                    originalBuffer = fs_1.default.readFileSync(fDrivePath);
                    _c.label = 5;
                case 5:
                    _c.trys.push([5, 7, , 8]);
                    return [4 /*yield*/, exifr_1.default.parse(originalBuffer)];
                case 6:
                    exifData = _c.sent();
                    if (exifData && exifData.DateTimeOriginal) {
                        extractedDate = new Date(exifData.DateTimeOriginal);
                    }
                    else if (exifData && exifData.CreateDate) {
                        extractedDate = new Date(exifData.CreateDate);
                    }
                    return [3 /*break*/, 8];
                case 7:
                    exifErr_1 = _c.sent();
                    return [3 /*break*/, 8];
                case 8:
                    thumbSizes = { small: 300, medium: 800, large: 1600 };
                    newThumbnailUrls = {};
                    timestamp = Date.now();
                    safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
                    _i = 0, _a = Object.entries(thumbSizes);
                    _c.label = 9;
                case 9:
                    if (!(_i < _a.length)) return [3 /*break*/, 13];
                    _b = _a[_i], sizeName = _b[0], width = _b[1];
                    return [4 /*yield*/, (0, sharp_1.default)(originalBuffer)
                            .rotate()
                            .resize({ width: width, withoutEnlargement: true })
                            .webp({ quality: 80 })
                            .toBuffer()];
                case 10:
                    resizedBuffer = _c.sent();
                    objectKey = '';
                    if (record.thumbnailUrls && record.thumbnailUrls[sizeName]) {
                        urlParts = record.thumbnailUrls[sizeName].split("/file/".concat(bucketName, "/"));
                        if (urlParts.length === 2) {
                            objectKey = urlParts[1];
                        }
                    }
                    // Fallback for new records that never had a thumbnail
                    if (!objectKey) {
                        objectKey = "thumbnails/".concat(record.userId || 'migration', "/").concat(timestamp, "_").concat(sizeName, "_").concat(safeName, ".webp");
                    }
                    return [4 /*yield*/, s3Client.send(new client_s3_1.PutObjectCommand({
                            Bucket: bucketName,
                            Key: objectKey,
                            ContentType: 'image/webp',
                            Body: resizedBuffer
                        }))];
                case 11:
                    _c.sent();
                    newThumbnailUrls[sizeName] = "https://media.gigiwatt.com/file/".concat(bucketName, "/").concat(objectKey);
                    _c.label = 12;
                case 12:
                    _i++;
                    return [3 /*break*/, 9];
                case 13:
                    updatePayload = {
                        thumbnailUrls: newThumbnailUrls,
                        thumbnail_metadata_healed: true
                    };
                    if (extractedDate && !isNaN(extractedDate.getTime())) {
                        updatePayload.logicalDate = extractedDate;
                    }
                    // Atomic release of the lock and update
                    return [4 /*yield*/, collection.updateOne({ _id: record._id }, {
                            $set: updatePayload,
                            $unset: { processing_lock: "", locked_at: "" }
                        })];
                case 14:
                    // Atomic release of the lock and update
                    _c.sent();
                    console.log("[".concat(NODE_ID, "] \u2705 Healed: ").concat(fileName, " ").concat(extractedDate ? "[".concat(extractedDate.toISOString().split('T')[0], "]") : ''));
                    _c.label = 15;
                case 15: return [3 /*break*/, 18];
                case 16:
                    err_1 = _c.sent();
                    console.error("[".concat(NODE_ID, "] \u274C Error processing ").concat(record.originalName, ": ").concat(err_1.message));
                    // Lock out the file so it doesn't cause infinite loops across the swarm
                    return [4 /*yield*/, collection.updateOne({ _id: record._id }, {
                            $set: {
                                processing_error: err_1.message,
                                processing_lock: "ERROR_".concat(NODE_ID)
                            }
                        })];
                case 17:
                    // Lock out the file so it doesn't cause infinite loops across the swarm
                    _c.sent();
                    return [3 /*break*/, 18];
                case 18: return [2 /*return*/];
            }
        });
    });
}
function runSwarm() {
    return __awaiter(this, void 0, void 0, function () {
        var uris, stagingDbPath, sqliteDb, s3Client, bucketName, totalProcessed, _i, uris_1, dbConfig, mongoClient, db, collections, _a, collections_1, colInfo, collection, collectionEmpty, queue, i, doc;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log("\n\uD83D\uDC1D [SWARM NODE: ".concat(NODE_ID, "] Online."));
                    console.log("\u2699\uFE0F  Concurrency: ".concat(MAX_CONCURRENT, " | Drive Prefix: ").concat(FDRIVE_PREFIX));
                    console.log("\uD83C\uDFAF Target: Omni-scan across Alpha and Atlas databases.\n");
                    uris = [
                        { name: 'Alpha Vault', uri: process.env.MONGODB_URI || 'mongodb://zen:sovereign@100.116.12.18:27017/LifeOS?authSource=admin' },
                        { name: 'Atlas Cloud', uri: process.env.ATLAS_CLOUD_URI }
                    ].filter(function (db) { return db.uri; });
                    stagingDbPath = path_1.default.join(FDRIVE_PREFIX, 'staging.db');
                    sqliteDb = new sqlite3_1.default.Database(stagingDbPath, sqlite3_1.default.OPEN_READONLY, function (err) {
                        if (err) {
                            console.error("\u274C Failed to open staging.db at ".concat(stagingDbPath));
                            process.exit(1);
                        }
                    });
                    s3Client = getS3Client();
                    bucketName = process.env.B2_BUCKET_NAME || "LifeOS-Media";
                    totalProcessed = 0;
                    _i = 0, uris_1 = uris;
                    _b.label = 1;
                case 1:
                    if (!(_i < uris_1.length)) return [3 /*break*/, 17];
                    dbConfig = uris_1[_i];
                    console.log("\n=============================================");
                    console.log("\uD83D\uDD0C Connecting to ".concat(dbConfig.name, "..."));
                    mongoClient = new mongodb_1.MongoClient(dbConfig.uri);
                    return [4 /*yield*/, mongoClient.connect()];
                case 2:
                    _b.sent();
                    db = mongoClient.db('LifeOS');
                    return [4 /*yield*/, db.listCollections().toArray()];
                case 3:
                    collections = _b.sent();
                    _a = 0, collections_1 = collections;
                    _b.label = 4;
                case 4:
                    if (!(_a < collections_1.length)) return [3 /*break*/, 14];
                    colInfo = collections_1[_a];
                    collection = db.collection(colInfo.name);
                    collectionEmpty = false;
                    _b.label = 5;
                case 5:
                    if (!(!collectionEmpty && totalProcessed < MAX_TOTAL_PROCESS)) return [3 /*break*/, 12];
                    queue = [];
                    i = 0;
                    _b.label = 6;
                case 6:
                    if (!(i < MAX_CONCURRENT)) return [3 /*break*/, 9];
                    return [4 /*yield*/, collection.findOneAndUpdate({
                            fileType: { $regex: /^image\//i },
                            thumbnail_metadata_healed: { $ne: true },
                            processing_lock: { $exists: false }
                        }, {
                            $set: {
                                processing_lock: NODE_ID,
                                locked_at: new Date()
                            }
                        }, { returnDocument: 'after' })];
                case 7:
                    doc = _b.sent();
                    if (!doc) {
                        collectionEmpty = true;
                        return [3 /*break*/, 9]; // No more records in this collection
                    }
                    totalProcessed++;
                    queue.push(processImage(doc, collection, sqliteDb, s3Client, bucketName));
                    _b.label = 8;
                case 8:
                    i++;
                    return [3 /*break*/, 6];
                case 9:
                    if (!(queue.length > 0)) return [3 /*break*/, 11];
                    return [4 /*yield*/, Promise.all(queue)];
                case 10:
                    _b.sent();
                    _b.label = 11;
                case 11: return [3 /*break*/, 5];
                case 12:
                    if (totalProcessed >= MAX_TOTAL_PROCESS)
                        return [3 /*break*/, 14];
                    _b.label = 13;
                case 13:
                    _a++;
                    return [3 /*break*/, 4];
                case 14: return [4 /*yield*/, mongoClient.close()];
                case 15:
                    _b.sent();
                    if (totalProcessed >= MAX_TOTAL_PROCESS)
                        return [3 /*break*/, 17];
                    _b.label = 16;
                case 16:
                    _i++;
                    return [3 /*break*/, 1];
                case 17:
                    console.log("\n\uD83C\uDFC1 [".concat(NODE_ID, "] Swarm cycle complete. Processed: ").concat(totalProcessed));
                    process.exit(0);
                    return [2 /*return*/];
            }
        });
    });
}
runSwarm().catch(function (err) {
    console.error("FATAL ERROR:", err);
    process.exit(1);
});
