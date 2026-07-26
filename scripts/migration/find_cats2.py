from pymongo import MongoClient
db = MongoClient('mongodb://zen:sovereign@100.116.12.18:27017').LifeOS
ids = []

for d in db.pending_accessions.find():
    orig = d.get('originalName', '').lower()
    file = d.get('fileName', '').lower()
    if 'whisk' in orig or 'snick' in orig or 'whisk' in file or 'snick' in file:
        ids.append(d["_id"])
        print(f"Found match: {orig} / {file}")

print(f"Total found: {len(ids)}")
