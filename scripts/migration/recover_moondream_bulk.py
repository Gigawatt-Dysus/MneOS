import sqlite3
import datetime
from pymongo import MongoClient, UpdateMany

print("🔥 Forging Moondream Recovery Script (Bulk Mode)...")

MONGO_URI = "mongodb://zen:sovereign@100.116.12.18:27017"
client = MongoClient(MONGO_URI)
db = client['LifeOS']

conn = sqlite3.connect(r'C:\MneOS\staging.db')
cursor = conn.cursor()

cursor.execute('SELECT filename, caption FROM airlock_jobs WHERE caption IS NOT NULL AND caption != ""')
rows = cursor.fetchall()
print(f"📦 Found {len(rows)} captions in SQLite airlock_jobs.")

now = datetime.datetime.utcnow().isoformat() + "Z"

media_ops = []
pending_ops = []

for row in rows:
    filename = row[0]
    caption = row[1]
    
    if not filename or not caption: continue
    
    op = UpdateMany(
        {
            "$or": [
                {"originalName": filename},
                {"fileName": filename}
            ]
        },
        {
            "$set": {
                "caption": caption,
                "triage.summary": caption,
                "aiProcessed": True,
                "aiModel": "moondream:latest",
                "aiProcessedAt": now
            }
        }
    )
    media_ops.append(op)
    pending_ops.append(op)

print(f"🚀 Firing bulk writes to Atlas / GGA over Tailscale...")

recovered_count = 0
if media_ops:
    try:
        res = db['media'].bulk_write(media_ops, ordered=False)
        recovered_count += res.modified_count
    except Exception as e:
        print("Media bulk write error:", e)

if pending_ops:
    try:
        res2 = db['pending_accessions'].bulk_write(pending_ops, ordered=False)
        recovered_count += res2.modified_count
    except Exception as e:
        print("Pending bulk write error:", e)

print(f"🎉 Recovery Complete. Successfully restored {recovered_count} documents back into MongoDB.")
conn.close()
