import os
import sys
import re
import time
import datetime
import argparse
from pymongo import MongoClient

sys.stdout.reconfigure(encoding='utf-8')

# Setup arguments
parser = argparse.ArgumentParser()
parser.add_argument("--dry-run", action="store_true", help="Do not save changes to the database.")
parser.add_argument("--limit", type=int, default=None, help="Limit number of documents to evaluate.")
args = parser.parse_args()

LOG_FILE = "shoebox_demote_review.log"
with open(LOG_FILE, "w", encoding="utf-8") as f:
    f.write("--- SOVEREIGN MATRIX SHOEBOX DEMOTE LOG ---\n")

MONGO_URI = "mongodb://zen:sovereign@100.116.12.18:27017"
DB_NAME = "LifeOS"

client = MongoClient(MONGO_URI)
db = client[DB_NAME]
collection = db["media"]

def is_genuinely_recent(filename):
    if not filename:
        return False
    # Check if filename contains 2025 or 2026 (e.g. 20260511, IMG_2026, Screenshot_2026)
    if "2026" in filename or "2025" in filename:
        return True
    
    # Check for recent Epoch timestamps in ms (e.g. FB_IMG_1778011413703 -> 2026-05)
    # 1700000000000 is ~Nov 2023. So anything >= 170... is recent.
    m = re.search(r'(17\d{11})', filename)
    if m:
        return True
        
    return False

def sweep_and_heal():
    print(f"📡 Starting Sovereign Matrix Shoebox Demotion Pipeline... (Dry Run: {args.dry_run})")
    
    query = {
        "logicalDate": {"$gte": "2026-01-01T00:00:00.000Z"}
    }
    
    cursor = collection.find(query)
    if args.limit:
        cursor = cursor.limit(args.limit)
        
    total = collection.count_documents(query)
    if args.limit and args.limit < total:
        total = args.limit
        
    print(f"📦 Found {total} total candidates in 2026+ for evaluation.")
    
    processed = 0
    demoted = 0
    start_time = time.time()
    
    for doc in cursor:
        doc_id = doc["_id"]
        filename = doc.get("originalName", "Unknown")
        current_date = doc.get("logicalDate")
        
        # If it's already unknown, skip
        if doc.get("datePrecision") == "unknown":
            processed += 1
            continue
            
        # Check if the filename implies it's an old file
        if not is_genuinely_recent(filename):
            print(f"   📦 SHOEBOXED: [{doc_id}] {filename}")
            print(f"      Old Date: {current_date}")
            print(f"      New Date: 5000-01-01T00:00:00.000Z (Precision: unknown)")
            
            with open(LOG_FILE, "a", encoding="utf-8") as f:
                f.write(f"[{doc_id}] {filename} -> Demoted to Shoebox (5000-01-01)\n")

            if not args.dry_run:
                update_payload = {
                    "logicalDate": "5000-01-01T00:00:00.000Z",
                    "datePrecision": "unknown",
                    "year": "5000"
                }
                collection.update_one(
                    {"_id": doc_id},
                    {"$set": update_payload}
                )
            demoted += 1
            
        processed += 1
        if processed % 10 == 0:
            elapsed = time.time() - start_time
            avg_time = elapsed / processed
            eta_secs = int((total - processed) * avg_time)
            eta_str = str(datetime.timedelta(seconds=eta_secs))
            print(f"📊 Progress: {processed}/{total} ({demoted} demoted) | ETA: {eta_str}")

    elapsed_total = str(datetime.timedelta(seconds=int(time.time() - start_time)))
    print(f"\n🎉 Shoebox Demotion Complete in {elapsed_total}. Relegated {demoted} legacy assets to the Shoebox.")

if __name__ == "__main__":
    try:
        sweep_and_heal()
    except KeyboardInterrupt:
        print("\n⚠️ Operation aborted.")
    finally:
        client.close()
