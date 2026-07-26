from pymongo import MongoClient

client = MongoClient('mongodb://zen:sovereign@100.116.12.18:27017')
db = client['LifeOS']

res = db['pending_accessions'].update_many(
    {'aiModel': 'gemini-2.5-flash-forensic-v2'}, 
    {'$set': {'aiModel': 'gemini-test'}}
)
print(f"Updated {res.modified_count} items in pending_accessions.")

res2 = db['media'].update_many(
    {'aiModel': 'gemini-2.5-flash-forensic-v2'}, 
    {'$set': {'aiModel': 'gemini-test'}}
)
print(f"Updated {res2.modified_count} items in media.")
