import express from 'express';
import cors from 'cors';
import sqlite3Pkg from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';

const sqlite3 = sqlite3Pkg.verbose();
const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const dbPath = 'F:\\MneOS_Staging\\staging.db';
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        console.error("❌ Failed to open staging.db:", err.message);
    } else {
        console.log(`📦 Connected to read/write SQLite database at: ${dbPath}`);
        // Ensure is_private column exists for NSFW/Privacy flagging in Airlock
        db.run(`ALTER TABLE files ADD COLUMN is_private INTEGER DEFAULT 0`, (err) => {
            if (err && !err.message.includes("duplicate column name")) {
                console.error("Warning: Failed to ensure is_private column:", err.message);
            }
        });
        db.run(`ALTER TABLE airlock_jobs ADD COLUMN rotation INTEGER DEFAULT 0`, (err) => {
            if (err && !err.message.includes("duplicate column name")) {
                console.error("Warning: Failed to ensure rotation column:", err.message);
            }
        });
    }
});

// GET /api/stats
app.get('/api/stats', (req, res) => {
    const stats = {};
    
    db.serialize(() => {
        // Get total count and aggregate size
        db.get(`SELECT COUNT(*) as totalFiles, SUM(size) as totalSize FROM files`, [], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            stats.totalFiles = row.totalFiles || 0;
            stats.totalSize = row.totalSize || 0;

            db.get(`SELECT COUNT(*) as totalJobs, SUM(CASE WHEN process_state = 'mongo_synced' THEN 1 ELSE 0 END) as syncedJobs FROM airlock_jobs`, [], (err, jobRow) => {
                if (err) return res.status(500).json({ error: err.message });
                stats.totalJobs = jobRow.totalJobs || 0;
                stats.syncedJobs = jobRow.syncedJobs || 0;

                // Get Forge stats
                db.get(`SELECT 
                    SUM(CASE WHEN decision LIKE 'AUTO_PRUNE%' THEN 1 ELSE 0 END) as quarantineCount,
                    SUM(CASE WHEN decision = 'KEEP_PROXY' THEN 1 ELSE 0 END) as keepProxyCount
                    FROM forge_training_data`, [], (err, forgeRow) => {
                    if (err) return res.status(500).json({ error: err.message });
                    stats.quarantineCount = forgeRow?.quarantineCount || 0;
                    stats.keepProxyCount = forgeRow?.keepProxyCount || 0;

                    // Get breakdown by extension
                    db.all(`SELECT extension, COUNT(*) as count FROM files GROUP BY extension ORDER BY count DESC LIMIT 15`, [], (err, rows) => {
                        if (err) return res.status(500).json({ error: err.message });
                        stats.extensions = rows;
                        res.json(stats);
                    });
                });
            });
        });
    });
});

// GET /api/preview
app.get('/api/preview', (req, res) => {
    let { filepath } = req.query;
    if (!filepath) return res.status(400).send("No filepath provided");

    const exists = fs.existsSync(filepath);
    console.log(`[Preview] Requested: ${filepath} | Exists: ${exists}`);

    if (exists) {
        res.sendFile(filepath);
    } else {
        res.status(404).send("File offline or missing");
    }
});

// DELETE /api/prune/extension
app.delete('/api/prune/extension', (req, res) => {
    const { extension } = req.body;
    if (extension === undefined) return res.status(400).json({ error: "Extension required" });

    db.run(`DELETE FROM files WHERE extension = ?`, [extension], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, deletedCount: this.changes });
    });
});

// POST /api/files/delete
app.post('/api/files/delete', (req, res) => {
    const { hashes } = req.body;
    if (!hashes || !Array.isArray(hashes) || hashes.length === 0) {
        return res.status(400).json({ error: "hashes array required" });
    }

    const placeholders = hashes.map(() => '?').join(',');
    
    // Delete from files
    db.run(`DELETE FROM files WHERE hash IN (${placeholders})`, hashes, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        const filesDeleted = this.changes;
        
        // Delete from airlock_jobs as well just in case they were classified
        db.run(`DELETE FROM airlock_jobs WHERE hash IN (${placeholders})`, hashes, function(err2) {
            res.json({ success: true, filesDeleted, jobsDeleted: err2 ? 0 : this.changes });
        });
    });
});

// GET /api/tree
app.get('/api/tree', (req, res) => {
    db.all(`SELECT filepath, size FROM files`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const tree = { name: "Root", size: 0, children: Object.create(null) };
        
        rows.forEach(row => {
            // Handle both Windows and Unix path separators
            const parts = row.filepath.split(/[/\\]+/).filter(Boolean);
            
            let current = tree;
            tree.size += row.size || 0;
            
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                if (!Object.prototype.hasOwnProperty.call(current.children, part)) {
                    current.children[part] = { name: part, size: 0, children: Object.create(null) };
                }
                current.children[part].size += row.size || 0;
                current = current.children[part];
            }
        });

        // Convert to array and sort
        const formatTree = (node) => {
            const formatted = {
                name: node.name,
                size: node.size,
                children: Object.values(node.children).map(formatTree).sort((a, b) => b.size - a.size)
            };
            return formatted;
        };

        res.json(formatTree(tree));
    });
});

// GET /api/files
app.get('/api/files', (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;
    const search = req.query.search ? `%${req.query.search}%` : null;

    const quarantineOnly = req.query.quarantine === 'true';

    let countQuery = `SELECT COUNT(*) as total FROM files f`;
    let dataQuery = `
        SELECT f.*, j.caption, j.process_state, j.rotation 
        FROM files f 
        LEFT JOIN airlock_jobs j ON f.hash = j.hash
    `;

    if (quarantineOnly) {
        countQuery += ` INNER JOIN forge_training_data td ON td.proxy_hash = f.hash WHERE td.decision LIKE 'AUTO_PRUNE%'`;
        dataQuery += ` INNER JOIN forge_training_data td ON td.proxy_hash = f.hash WHERE td.decision LIKE 'AUTO_PRUNE%'`;
    } else {
        countQuery += ` WHERE 1=1`;
        dataQuery += ` WHERE 1=1`;
    }

    const params = [];

    if (search) {
        const whereClause = ` AND (f.filename LIKE ? OR f.filepath LIKE ?)`;
        countQuery += whereClause;
        dataQuery += whereClause;
        params.push(search, search);
    }

    // Float captioned files to page 1, sorted by most recently processed
    dataQuery += ` ORDER BY CASE WHEN j.caption IS NOT NULL THEN 0 ELSE 1 END, j.processed_at DESC, f.filepath ASC LIMIT ? OFFSET ?`;
    const dataParams = [...params, limit, offset];

    db.get(countQuery, params, (err, countRow) => {
        if (err) return res.status(500).json({ error: err.message });
        const total = countRow.total;

        db.all(dataQuery, dataParams, (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({
                data: rows,
                pagination: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit)
                }
            });
        });
    });
});

// POST /api/files/caption
app.post('/api/files/caption', (req, res) => {
    const { hash, caption, rotation } = req.body;
    if (!hash || caption === undefined) {
        return res.status(400).json({ error: "hash and caption required" });
    }

    const rotVal = rotation !== undefined ? rotation : 0;

    db.run(
        `UPDATE airlock_jobs SET caption = ?, rotation = ?, process_state = 'reembed_pending' WHERE hash = ?`,
        [caption, rotVal, hash],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: "Job not found for hash" });
            res.json({ success: true, message: "Caption and rotation updated and marked for re-embedding." });
        }
    );
});

// POST /api/files/private
app.post('/api/files/private', (req, res) => {
    const { hash, is_private } = req.body;
    if (!hash || is_private === undefined) {
        return res.status(400).json({ error: "hash and is_private required" });
    }

    db.run(
        `UPDATE files SET is_private = ? WHERE hash = ?`,
        [is_private ? 1 : 0, hash],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: "File not found for hash" });
            res.json({ success: true, message: "Privacy flag updated." });
        }
    );
});

// GET /api/forge/next
// Find next proxy and spawn python script to analyze pair
app.get('/api/forge/next', (req, res) => {
    const isReviewAuto = req.query.reviewAuto === 'true';
    const skips = req.query.skips ? req.query.skips.split(',') : [];

    // If reviewAuto is true, fetch ONLY the items the script auto-pruned
    // Otherwise, fetch ONLY the items that have not been reviewed/pruned at all
    const dbFilter = isReviewAuto 
        ? "p.hash IN (SELECT proxy_hash FROM forge_training_data WHERE decision LIKE 'AUTO_PRUNE%')"
        : "p.hash NOT IN (SELECT proxy_hash FROM forge_training_data)";

    let query = `
        SELECT 
            p.hash as proxyHash, 
            p.filepath as proxyPath, 
            m.hash as masterHash, 
            m.filepath as masterPath,
            p.originalName
        FROM airlock_jobs p
        INNER JOIN airlock_jobs m 
            ON m.originalName = replace(p.originalName, '-edited', '')
            AND replace(m.filepath, m.originalName, '') = replace(p.filepath, p.originalName, '')
        WHERE p.filepath LIKE '%-edited%' 
        AND ${dbFilter}
    `;

    if (skips.length > 0) {
        const placeholders = skips.map(() => '?').join(',');
        query += ` AND p.hash NOT IN (${placeholders})`;
    }
    query += ` LIMIT 1`;

    db.get(query, skips, (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.json({ pair: null, message: "No more proxies to review." });

        // We have both, let's call python
        const pyScript = path.join(process.cwd(), 'scripts', 'migration', 'eval_pair.py');
        exec(`python "${pyScript}" "${row.proxyPath}" "${row.masterPath}"`, (err, stdout, stderr) => {
            if (err) {
                console.error("Python error:", stderr);
                return res.status(500).json({ error: "Failed to analyze pair", details: stderr });
            }
            try {
                const result = JSON.parse(stdout.trim());
                if (result.error) return res.status(500).json({ error: result.error });

                res.json({
                    pair: {
                        id: row.proxyHash,
                        proxyHash: row.proxyHash,
                        masterHash: row.masterHash,
                        proxyPath: result.proxyPath,
                        masterPath: result.masterPath,
                        proxySize: result.proxySize,
                        masterSize: result.masterSize,
                        ssimScore: result.ssimScore,
                        satDiff: result.satDiff
                    }
                });
            } catch (e) {
                res.status(500).json({ error: "Failed to parse python output", stdout });
            }
        });
    });
});

// GET /api/forge/pair/:proxyHash
// Loads a specific pair for inspection by proxy hash
app.get('/api/forge/pair/:proxyHash', (req, res) => {
    const proxyHash = req.params.proxyHash;

    const query = `
        SELECT 
            p.hash as proxyHash, 
            p.filepath as proxyPath, 
            m.hash as masterHash, 
            m.filepath as masterPath,
            p.originalName
        FROM airlock_jobs p
        INNER JOIN airlock_jobs m 
            ON m.originalName = replace(p.originalName, '-edited', '')
            AND replace(m.filepath, m.originalName, '') = replace(p.filepath, p.originalName, '')
        WHERE p.hash = ?
    `;

    db.get(query, [proxyHash], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: "Pair not found" });

        const pyScript = path.join(process.cwd(), 'scripts', 'migration', 'eval_pair.py');
        exec(`python "${pyScript}" "${row.proxyPath}" "${row.masterPath}"`, (err, stdout, stderr) => {
            if (err) {
                console.error("Python error:", stderr);
                return res.status(500).json({ error: "Failed to analyze pair", details: stderr });
            }
            try {
                const result = JSON.parse(stdout.trim());
                if (result.error) return res.status(500).json({ error: result.error });

                res.json({
                    pair: {
                        id: row.proxyHash,
                        proxyHash: row.proxyHash,
                        masterHash: row.masterHash,
                        proxyPath: result.proxyPath,
                        masterPath: result.masterPath,
                        proxySize: result.proxySize,
                        masterSize: result.masterSize,
                        ssimScore: result.ssimScore,
                        satDiff: result.satDiff
                    }
                });
            } catch (e) {
                res.status(500).json({ error: "Failed to parse python output", stdout });
            }
        });
    });
});

// POST /api/forge/decision
app.post('/api/forge/decision', (req, res) => {
    const { proxyHash, masterHash, ssimScore, satDiff, decision } = req.body;
    if (!proxyHash || !masterHash || !decision) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    db.run(
        `INSERT INTO forge_training_data (proxy_hash, master_hash, ssim_score, sat_shift, decision) 
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(proxy_hash) DO UPDATE SET 
            decision=excluded.decision, 
            created_at=CURRENT_TIMESTAMP`,
        [proxyHash, masterHash, ssimScore, satDiff, decision],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, message: "Decision logged." });

            // Fire off the adaptive tuner in the background asynchronously
            exec(`node scripts/migration/pulse_tuner.js`, (err, stdout) => {
                if (stdout) console.log(stdout.trim());
                if (err) console.error("Pulse Tuner Error:", err);
            });
        }
    );
});

app.listen(PORT, () => {
    console.log(`\n=======================================================`);
    console.log(`🚀 LifeOS Staging API Server Running`);
    console.log(`=======================================================\n`);
    console.log(`Server listening on port ${PORT}`);
    console.log(`Endpoints available:`);
    console.log(`- http://localhost:${PORT}/api/stats`);
    console.log(`- http://localhost:${PORT}/api/files?page=1&limit=100\n`);
});
