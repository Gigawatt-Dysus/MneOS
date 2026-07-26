from pymongo import MongoClient

client = MongoClient('mongodb://zen:sovereign@100.116.12.18:27017')
db = client['LifeOS']

res = db['pending_accessions'].update_many(
    {'aiModel': 'gemini-test'}, 
    {'$set': {
        'userId': '2qQf69l6j5XozM43ZJ2Tyr4qJdg2'
    }}
)
print(f"Reverted {res.modified_count} items back to Winter.")
