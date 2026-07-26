from pymongo import MongoClient
import datetime

client = MongoClient('mongodb://zen:sovereign@100.116.12.18:27017')
db = client['LifeOS']

now = datetime.datetime.utcnow().isoformat() + "Z"

res = db['pending_accessions'].update_many(
    {'aiModel': 'gemini-test'}, 
    {'$set': {
        'logicalDate': now,
        'year': 2026,
        'datePrecision': 'exact'
    }}
)
print(f"Updated {res.modified_count} items with a current date.")
