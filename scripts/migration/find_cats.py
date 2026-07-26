from pymongo import MongoClient
import json
from bson import json_util

db = MongoClient('mongodb://zen:sovereign@100.116.12.18:27017').LifeOS
found_media = 0
found_pending = 0

print("Searching media...")
for d in db.media.find():
    s = json.dumps(d, default=json_util.default).lower()
    if 'whisk' in s or 'snick' in s:
        print(d.get('originalName', d.get('fileName', 'Unknown')))
        found_media += 1

print(f"Found {found_media} in media.")

print("Searching pending_accessions...")
for d in db.pending_accessions.find():
    s = json.dumps(d, default=json_util.default).lower()
    if 'whisk' in s or 'snick' in s:
        print(d.get('originalName', d.get('fileName', 'Unknown')))
        found_pending += 1

print(f"Found {found_pending} in pending_accessions.")
