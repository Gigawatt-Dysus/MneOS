from pymongo import MongoClient

client = MongoClient('mongodb://zen:sovereign@100.116.12.18:27017')
db = client['LifeOS']

res = db['pending_accessions'].update_many(
    {'aiModel': 'gemini-test'}, 
    {'$set': {
        'userId': '9MPVGVTxE8dXvkCrl1XrWHQzCl23'
    }}
)
print(f"Re-assigned {res.modified_count} items to Eric's UID.")
