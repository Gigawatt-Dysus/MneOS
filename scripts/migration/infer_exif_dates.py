import os
import sys
import re
import datetime
from pymongo import MongoClient

# Use utf-8 for terminal printing
sys.stdout.reconfigure(encoding='utf-8')

MONGO_URI = "mongodb://zen:sovereign@100.116.12.18:27017"
DB_NAME = "LifeOS"
client = MongoClient(MONGO_URI)
db = client[DB_NAME]
collection = db["pending_accessions"]

print("📡 Fetching documents from pending_accessions...")
docs = list(collection.find({}, {"_id": 1, "originalName": 1, "logicalDate": 1}))
print(f"📦 Found {len(docs)} documents.")

# Regex to match prefixes like DSC_, IMG_, WP_, P_, followed by numbers
regex = re.compile(r'^([A-Za-z_]+0*)(\d+)[^.]*\.[a-zA-Z0-9]+$')

groups = {}
# Invalid fallback dates we want to override
invalid_dates_prefixes = ("2026-06", "1969-12", "1970-01") 

for doc in docs:
    name = doc.get("originalName") or ""
    match = regex.match(name)
    if match:
        prefix = match.group(1).upper()
        num = int(match.group(2))
        
        if prefix not in groups:
            groups[prefix] = []
            
        groups[prefix].append({
            "doc": doc,
            "num": num
        })

print(f"🧩 Grouped into {len(groups)} sequence prefixes.")

def is_valid_date(date_obj):
    if not date_obj:
        return False
    if isinstance(date_obj, datetime.datetime):
        # Format as string to check prefixes
        date_str = date_obj.strftime("%Y-%m-%dT%H:%M:%S.000Z")
    else:
        date_str = str(date_obj)
        
    if date_str.startswith(invalid_dates_prefixes):
        return False
    return True

inferred_count = 0

for prefix, items in groups.items():
    if len(items) < 2:
        continue
        
    items.sort(key=lambda x: x["num"])
    
    for i in range(1, len(items)):
        current = items[i]["doc"]
        prev = items[i-1]["doc"]
        
        current_date = current.get("logicalDate")
        prev_date = prev.get("logicalDate")
        
        if not is_valid_date(current_date) and is_valid_date(prev_date):
            seq_gap = items[i]["num"] - items[i-1]["num"]
            # If the filename jumps more than 50 numbers, the temporal gap might be unreliable
            if seq_gap > 50 or seq_gap < 1:
                continue
                
            if isinstance(prev_date, datetime.datetime):
                dt = prev_date
            else:
                try:
                    iso_str = str(prev_date).replace('Z', '+00:00')
                    dt = datetime.datetime.fromisoformat(iso_str)
                except ValueError:
                    continue # Skip if parsing fails
            
            # Add 1 second
            new_dt = dt + datetime.timedelta(seconds=1)
            # Format back to Sovereign DB style
            new_iso = new_dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")
            new_year = new_dt.year
            
            collection.update_one(
                {"_id": current["_id"]},
                {"$set": {
                    "logicalDate": new_iso,
                    "year": new_year,
                    "datePrecision": "inferred"
                }}
            )
            
            # Persist it forward so sequential missing blocks chain together (+1s, +2s, +3s)
            current["logicalDate"] = new_iso
            
            inferred_count += 1
            print(f"🔗 Inferred {new_iso} for {current['originalName']} (from {prev['originalName']})")

print(f"\n🚀 Done! Successfully inferred and backfilled dates for {inferred_count} documents.")
