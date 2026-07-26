from pymongo import MongoClient

db = MongoClient('mongodb://zen:sovereign@100.116.12.18:27017')['LifeOS']
docs = db.pending_accessions.find({'aiModel': 'gemini-2.5-flash'})

count = 0
for d in docs:
    db.pending_accessions.update_one(
        {'_id': d['_id']}, 
        {'$set': {'aiProcessed': False}, '$unset': {'caption': 1, 'triage.summary': 1, 'aiProcessedAt': 1, 'aiModel': 1, 'embedding': 1}}
    )
    count += 1

print(f'Successfully reset {count} experimental Gemini records back into the queue!')
