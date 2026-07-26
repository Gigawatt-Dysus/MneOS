
import pymongo
client = pymongo.MongoClient('mongodb://zen:sovereign@100.116.12.18:27017')
db = client['LifeOS']
search_str = 'e1036743_0dbf_4c6d_b445_95381550a1e3'
for coll in db.list_collection_names():
    for doc in db[coll].find({'': {'': search_str}}):
        print(f'Found in {coll}: {doc}')

