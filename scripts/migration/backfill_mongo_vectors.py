import pymongo
import requests
import time

MONGO_URI = "mongodb://zen:sovereign@100.116.12.18:27017"
VOYAGE_URL = "https://api.voyageai.com/v1/embeddings"
VOYAGE_API_KEY = "pa-Pd0jzTCrkPtvT6MqHkFPKHvNWp1YYqXNAkbQrUTaPoj"
MODEL_NAME = "voyage-large-2-instruct"

print("\n🚀 LifeOS Background Vector Backfill Engine")
print(f"Target: {MONGO_URI}")

try:
    client = pymongo.MongoClient(MONGO_URI)
    db = client["LifeOS"]
    collection = db["media"]
except Exception as e:
    print(f"❌ Failed to connect to MongoDB: {e}")
    exit(1)

# Count how many are missing embeddings
missing_count = collection.count_documents({"aiProcessed": True, "embedding": {"$exists": False}})
print(f"📊 Found {missing_count} processed records missing vectors.\n")

if missing_count == 0:
    print("✅ All processed records have vectors. Exiting.")
    exit(0)

processed = 0
start_time = time.time()

# Find them and update
cursor = collection.find({"aiProcessed": True, "embedding": {"$exists": False}}, no_cursor_timeout=True)

try:
    for doc in cursor:
        doc_id = doc["_id"]
        caption = doc.get("aiDescription") or doc.get("triage", {}).get("summary") or doc.get("caption", "")
        
        if not caption:
            print(f"   ⚠️ No caption found for {doc_id}. Skipping.")
            continue
            
        try:
            headers = {
                "Authorization": f"Bearer {VOYAGE_API_KEY}",
                "Content-Type": "application/json"
            }
            payload = {
                "input": [caption],
                "model": MODEL_NAME
            }
            emb_res = requests.post(VOYAGE_URL, headers=headers, json=payload)
            
            if emb_res.status_code == 200:
                embedding = emb_res.json()['data'][0]['embedding']
                if embedding:
                    collection.update_one(
                        {"_id": doc_id},
                        {"$set": {"embedding": embedding}}
                    )
                    processed += 1
                    
                    if processed % 100 == 0:
                        elapsed = time.time() - start_time
                        rate = processed / elapsed
                        print(f"   ✅ Processed {processed}/{missing_count} ({rate:.2f} doc/s)")
            else:
                print(f"   ⚠️ Ollama error: {emb_res.text}")
                
        except Exception as e:
            print(f"   ❌ Error generating embedding for {doc_id}: {e}")
except KeyboardInterrupt:
    print("\n🛑 Aborted by user.")
finally:
    cursor.close()
    client.close()
    
print(f"\n🎉 Backfill complete! Added vectors to {processed} records.")
