from pymongo import MongoClient

client = MongoClient('mongodb://zen:sovereign@100.116.12.18:27017')
db = client['LifeOS']

res = db['pending_accessions'].update_many(
    {'aiModel': 'gemini-test'}, 
    {
        '$unset': {
            'logicalDate': '',
            'year': '',
            'datePrecision': '',
            'aiModel': '',
            'aiProcessedAt': '',
            'caption': '',
            'triage.summary': ''
        },
        '$set': {
            'aiProcessed': False,
            'aiRetryCount': 0,
            'error_msg': ''
        }
    }
)
print(f"Sanitized and reverted {res.modified_count} items back to original state.")
