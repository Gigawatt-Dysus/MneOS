from pymongo import MongoClient
import json
from bson import json_util

db = MongoClient('mongodb://zen:sovereign@100.116.12.18:27017').LifeOS
ids = []

for d in db.pending_accessions.find():
    s = json.dumps(d, default=json_util.default).lower()
    if 'whisk' in s or 'snick' in s:
        ids.append(str(d["_id"]))

print(f"Found {len(ids)} cat photos.")
with open("cat_ids.json", "w") as f:
    json.dump(ids, f)
