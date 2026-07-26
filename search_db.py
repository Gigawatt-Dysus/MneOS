
import pymongo
client = pymongo.MongoClient('mongodb://zen:sovereign@100.116.12.18:27017')
db = client['LifeOS']
found = False
for coll in db.list_collection_names():
    doc = db[coll].find_one({'fileName': {'$regex': 'e1036743'}})
    if not doc:
        doc = db[coll].find_one({'url': {'$regex': 'e1036743'}})
    if not doc:
        doc = db[coll].find_one({'thumbnailUrl': {'$regex': 'e1036743'}})
    if doc:
        print(f'Found in {coll}:')
        print('URL:', doc.get('url'))
        print('Thumbnail:', doc.get('thumbnailUrl'))
        print('FileName:', doc.get('fileName'))
        found = True
if not found:
    print('Not found anywhere')

