import sqlite3
import datetime
from pymongo import MongoClient

print("🔥 Forging Moondream Recovery Script...")

# Connect to MongoDB
MONGO_URI = "mongodb://zen:sovereign@100.116.12.18:27017"
client = MongoClient(MONGO_URI)
db = client['LifeOS']

# Connect to SQLite
conn = sqlite3.connect(r'C:\MneOS\staging.db')
cursor = conn.cursor()

# Get all captions from SQLite
cursor.execute('SELECT filename, caption FROM airlock_jobs WHERE caption IS NOT NULL AND caption != ""')
rows = cursor.fetchall()
print(f"📦 Found {len(rows)} captions in SQLite airlock_jobs.")

recovered_count = 0
now = datetime.datetime.utcnow().isoformat() + "Z"

for row in rows:
    filename = row[0]
    caption = row[1]
    
    if not filename or not caption: continue
    
    # Update both media and pending_accessions
    for coll_name in ['media', 'pending_accessions']:
        coll = db[coll_name]
        res = coll.update_many(
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
        recovered_count += res.modified_count

print(f"🎉 Recovery Complete. Successfully restored {recovered_count} captions back into MongoDB.")
conn.close()
