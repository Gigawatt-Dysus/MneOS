from pymongo import MongoClient

client = MongoClient('mongodb://zen:sovereign@100.116.12.18:27017')
db = client['LifeOS']

WINTER_UID = '2qQf69l6j5XozM43ZJ2Tyr4qJdg2'
ERIC_UID = '9MPVGVTxE8dXvkCrl1XrWHQzCl23'

print(f"Executing Emergency Takeout Rescue...")

res = db['pending_accessions'].update_many(
    {'userId': WINTER_UID}, 
    {'$set': {'userId': ERIC_UID}}
)

print(f"✅ Successfully transferred {res.modified_count} records from Winter's UID to Eric's UID in pending_accessions.")

# Also check if 'media' collection was compromised during that takeout
res_media = db['media'].update_many(
    {'userId': WINTER_UID}, 
    {'$set': {'userId': ERIC_UID}}
)
if res_media.modified_count > 0:
    print(f"✅ Successfully transferred {res_media.modified_count} records from Winter's UID to Eric's UID in media.")
