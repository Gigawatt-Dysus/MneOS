from pymongo import MongoClient
client = MongoClient('mongodb://zen:sovereign@100.116.12.18:27017')
db = client['LifeOS']
count = db['pending_accessions'].count_documents({'caption': {'$exists': True, '$ne': ''}})
print('Captions in Mongo:', count)
