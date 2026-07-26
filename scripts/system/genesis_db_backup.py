import os
import json
import gzip
import shutil
from datetime import datetime
from pymongo import MongoClient
from bson.json_util import dumps

# --- CONFIGURATION ---
MONGO_URI = "mongodb://zen:sovereign@100.116.12.18:27017"
DB_NAME = "LifeOS"

# Backup destinations
TIMESTAMP = datetime.now().strftime("%Y%m%d_%H%M%S")
BACKUP_FILENAME = f"LifeOS_Backup_{TIMESTAMP}.json.gz"

# Local staging directory on Victus
LOCAL_STAGING_DIR = r"C:\MneOS\_backups\DB_DUMPS"

# The 3 Redundant Genesis Nodes (Tailscale SMB Paths)
# Note: Ensure these shares exist and are accessible from the machine running this script.
ALPHA_SHARE = r"\\100.116.12.18\F\LifeOS_Backups" # F:\ drive on Alpha
BETA_SHARE  = r"\\100.65.97.113\Genesis-Backups"
GAMMA_SHARE = r"\\100.105.114.31\Genesis-Backups"

def ensure_dir(path):
    if not os.path.exists(path):
        os.makedirs(path, exist_ok=True)

def dump_database():
    print(f"[*] Connecting to MongoDB at {MONGO_URI}...")
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    
    ensure_dir(LOCAL_STAGING_DIR)
    local_path = os.path.join(LOCAL_STAGING_DIR, BACKUP_FILENAME)
    
    print(f"[*] Starting extraction of database: {DB_NAME}")
    collections = db.list_collection_names()
    
    db_dump = {}
    for coll_name in collections:
        print(f"  -> Streaming collection: {coll_name}...")
        cursor = db[coll_name].find({})
        # We load into memory here; for a massive DB, a line-by-line JSONL approach is better,
        # but for ~300k records this will hold in RAM on Victus for a quick compressed dump.
        db_dump[coll_name] = list(cursor)
        print(f"     [+] Extracted {len(db_dump[coll_name])} records.")
        
    print(f"[*] Compressing payload to {local_path}...")
    with gzip.open(local_path, 'wt', encoding='utf-8') as zipfile:
        zipfile.write(dumps(db_dump, indent=2))
        
    print(f"[+] Local staging backup complete: {local_path}")
    return local_path

def push_to_node(local_path, remote_share, node_name):
    print(f"[*] Pushing to {node_name} at {remote_share}...")
    try:
        ensure_dir(remote_share)
        dest_path = os.path.join(remote_share, BACKUP_FILENAME)
        shutil.copy2(local_path, dest_path)
        print(f"[+] Successfully replicated to {node_name}.")
    except Exception as e:
        print(f"[!] FAILED to replicate to {node_name}. Error: {e}")

if __name__ == "__main__":
    print("=== SOVEREIGN GENESIS DB BACKUP ===")
    local_backup_path = dump_database()
    
    print("\n=== INITIATING TRIPLE REDUNDANCY DISTRIBUTION ===")
    push_to_node(local_backup_path, ALPHA_SHARE, "GGA (Alpha - F: Drive)")
    push_to_node(local_backup_path, BETA_SHARE, "GGB (Beta)")
    push_to_node(local_backup_path, GAMMA_SHARE, "GGC (Gamma)")
    
    print("\n[+] BACKUP PROTOCOL COMPLETE.")
