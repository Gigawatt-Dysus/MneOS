import os
import sys
import time

sys.stdout.reconfigure(encoding='utf-8')
import socket
import psutil
import datetime
from pymongo import MongoClient

# MneOS Cluster Telemetry Daemon
MONGO_URI = "mongodb://zen:sovereign@100.116.12.18:27017"
DB_NAME = "LifeOS"
COLLECTION_NAME = "cluster_telemetry"

def get_node_name():
    hostname = socket.gethostname().upper()
    if "VICTUS" in hostname: return "VICTUS-DEV-RIG"
    if "GGA" in hostname or "ALPHA" in hostname: return "GGA-HEADLESS-ALPHA"
    if "GGB" in hostname or "BETA" in hostname: return "GGB-HEADLESS-BETA"
    if "GGC" in hostname or "GAMMA" in hostname: return "GGC-HEADLESS-GAMMA"
    return hostname

def get_uptime_hours():
    boot_time = psutil.boot_time()
    uptime_seconds = time.time() - boot_time
    return round(uptime_seconds / 3600, 2)

def run_daemon():
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    collection = db[COLLECTION_NAME]
    
    node_name = get_node_name()
    print(f"📡 Starting Telemetry Daemon for Node: {node_name}...")
    
    while True:
        try:
            cpu = psutil.cpu_percent(interval=1)
            mem = psutil.virtual_memory()
            
            data = {
                "node": node_name,
                "ip": socket.gethostbyname(socket.gethostname()),
                "uptime_hours": get_uptime_hours(),
                "cpu_percent": cpu,
                "ram_total_gb": round(mem.total / (1024**3), 2),
                "ram_used_gb": round(mem.used / (1024**3), 2),
                "ram_percent": mem.percent,
                "last_seen": datetime.datetime.utcnow()
            }
            
            collection.update_one(
                {"node": node_name},
                {"$set": data},
                upsert=True
            )
            print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Heartbeat synced to Sovereign DB.")
        except Exception as e:
            print(f"❌ Error sending heartbeat: {e}")
            
        time.sleep(5) # Fast 5 second heartbeat for the HUD

if __name__ == "__main__":
    run_daemon()
