from pymongo import MongoClient

def run():
    atlas_uri = "mongodb+srv://dysus2026:alpha-Omega-911@lifeos-cluster.qmjogz8.mongodb.net/LifeOS"
    client = MongoClient(atlas_uri)
    db = client['LifeOS']
    
    docs = list(db['pending_accessions'].find(
        {"triage.summary": {"$exists": True}, "type": "IMAGE"},
        {"triage.summary": 1, "updatedAt": 1, "createdAt": 1, "originalName": 1}
    ).limit(10))
    
    for d in docs:
        print(f"{d.get('originalName', 'Unknown')} | {d.get('updatedAt')} | {d['triage']['summary'][:40]}...")

run()
