import time
import os
import sys
from pymongo import MongoClient

print("📡 Connecting to Sovereign Radar (MongoDB: 100.116.12.18)...")
try:
    client = MongoClient("mongodb://zen:sovereign@100.116.12.18:27017/", serverSelectionTimeoutMS=5000)
    client.admin.command('ping')
except Exception as e:
    print(f"❌ Failed to connect to MongoDB: {e}")
    sys.exit(1)

db = client["LifeOS"]

print("🛫 LA Center Radar Online. Monitoring Swarm Throughput...\n")

query_remaining = {
    "aiProcessed": False, 
    "aiRetryCount": {"$in": [None, 0, 1, 2]}, 
    "$or": [{"fileType": {"$regex": "^image/", "$options": "i"}}, {"type": "IMAGE"}]
}
query_processed = {"aiProcessed": True, "caption": {"$exists": True}}

# We aggregate across both target collections
collections = ["media", "pending_accessions"]

def get_stats():
    total_rem = 0
    total_proc = 0
    total_claimed = 0
    for coll in collections:
        total_rem += db[coll].count_documents(query_remaining)
        total_proc += db[coll].count_documents(query_processed)
        total_claimed += db[coll].count_documents({"claimed_by": {"$exists": True}})
    return total_rem, total_proc, total_claimed

try:
    last_rem, last_proc, _ = get_stats()
    start_time = time.time()
    last_time = start_time
    
    print(f"📊 [INITIAL] Remaining: {last_rem:,} | Processed: {last_proc:,}")
    
    while True:
        time.sleep(10)
        current_time = time.time()
        elapsed_interval = current_time - last_time
        
        rem, proc, claimed = get_stats()
        
        session_processed = proc - last_proc  # Actually we need initial_proc
        session_elapsed = current_time - start_time
        
        speed_per_min = 0
        if session_elapsed > 0:
            speed_per_min = (session_processed / session_elapsed) * 60
            
        speed_per_min = max(0, speed_per_min)
        
        eta_str = "Calculating..."
        if speed_per_min > 0:
            eta_minutes = rem / speed_per_min
            eta_days = int(eta_minutes // 1440)
            eta_hours = int((eta_minutes % 1440) // 60)
            eta_mins = int(eta_minutes % 60)
            
            if eta_days > 0:
                eta_str = f"{eta_days}d {eta_hours}h {eta_mins}m"
            else:
                eta_str = f"{eta_hours}h {eta_mins}m"
        
        print(f"🛸 [RADAR] Backlog: {rem:,} | Claimed: {claimed:,} | Speed: {speed_per_min:.1f} img/min | ETA: {eta_str}")

except KeyboardInterrupt:
    print("\n🛬 Radar offline. Good day, sir.")
finally:
    client.close()
