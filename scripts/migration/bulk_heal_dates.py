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

LOG_FILE = "date_heal_review.log"
with open(LOG_FILE, "w", encoding="utf-8") as f:
    f.write("--- SOVEREIGN MATRIX DATE HEAL LOG ---\n")

MONGO_URI = "mongodb://zen:sovereign@100.116.12.18:27017"
DB_NAME = "LifeOS"

client = MongoClient(MONGO_URI)
db = client[DB_NAME]
collection = db["media"]

def extract_date(filename):
    if not filename:
        return None, None
    # Pattern 1: YYYY-MM-DD or YYYY-MM-unknown or YYYY-unknown
    m = re.search(r'((19|20)\d{2})-(0[1-9]|1[0-2]|unknown)?-(0[1-9]|[12]\d|3[01]|unknown)?', filename)
    if m:
        year = int(m.group(1))
        month = m.group(3)
        day = m.group(4)
        
        precision = 'exact'
        if month == 'unknown' or month is None:
            month = 1
            day = 1
            precision = 'year'
        else:
            month = int(month)
            if day == 'unknown' or day is None:
                day = 1
                precision = 'month'
            else:
                day = int(day)
                precision = 'day'
                
        return datetime.datetime(year, month, day, tzinfo=datetime.timezone.utc), precision

    # Pattern 2: Unix Epoch (ms) exactly 13 digits e.g., 1520366320366
    m = re.search(r'(?<!\d)(1[0-7]\d{11})(?!\d)', filename)
    if m:
        epoch_ms = int(m.group(1))
        dt = datetime.datetime.fromtimestamp(epoch_ms / 1000.0, tz=datetime.timezone.utc)
        return dt, 'exact'

    # Pattern 3: YYYYMMDD_HHMMSS or IMG_YYYYMMDD
    m = re.search(r'(?<!\d)((19|20)\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])_(\d{6})?(?!\d)', filename)
    if m:
        year = int(m.group(1))
        month = int(m.group(3))
        day = int(m.group(4))
        return datetime.datetime(year, month, day, tzinfo=datetime.timezone.utc), 'exact'

    return None, None

def sweep_and_heal():
    print(f"📡 Starting Sovereign Matrix Date Heal Pipeline... (Dry Run: {args.dry_run})")
    
    # We want to target anything misdated in 2026.
    query = {
        "logicalDate": {"$gte": "2026-01-01T00:00:00.000Z"}
    }
    
    cursor = collection.find(query)
    if args.limit:
        cursor = cursor.limit(args.limit)
        
    total = collection.count_documents(query)
    if args.limit and args.limit < total:
        total = args.limit
        
    print(f"📦 Found {total} candidates for evaluation.")
    
    processed = 0
    healed = 0
    start_time = time.time()
    
    for doc in cursor:
        doc_id = doc["_id"]
        filename = doc.get("originalName", "Unknown")
        current_date = doc.get("logicalDate")
        
        parsed_dt, prec = extract_date(filename)
        
        if parsed_dt and parsed_dt.year < 2026:
            new_date_str = parsed_dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")
            
            print(f"   🪄 HEALED: [{doc_id}] {filename}")
            print(f"      Old Date: {current_date}")
            print(f"      New Date: {new_date_str} (Precision: {prec})")
            
            with open(LOG_FILE, "a", encoding="utf-8") as f:
                f.write(f"[{doc_id}] {filename} -> {new_date_str} ({prec})\n")

            if not args.dry_run:
                update_payload = {
                    "logicalDate": new_date_str,
                    "datePrecision": prec,
                    "year": str(parsed_dt.year)
                }
                collection.update_one(
                    {"_id": doc_id},
                    {"$set": update_payload}
                )
            healed += 1
            
        processed += 1
        if processed % 10 == 0:
            elapsed = time.time() - start_time
            avg_time = elapsed / processed
            eta_secs = int((total - processed) * avg_time)
            eta_str = str(datetime.timedelta(seconds=eta_secs))
            print(f"📊 Progress: {processed}/{total} ({healed} fixed) | ETA: {eta_str}")

    elapsed_total = str(datetime.timedelta(seconds=int(time.time() - start_time)))
    print(f"\n🎉 Date Healing Sweep Complete in {elapsed_total}. Restored {healed} assets to their historical timeline.")

if __name__ == "__main__":
    try:
        sweep_and_heal()
    except KeyboardInterrupt:
        print("\n⚠️ Operation aborted.")
    finally:
        client.close()
