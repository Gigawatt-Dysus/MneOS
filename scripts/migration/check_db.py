from pymongo import MongoClient
client = MongoClient('mongodb://zen:sovereign@100.116.12.18:27017')
db = client['LifeOS']
docs = db['media'].find({'fileType': 'image/jpeg', 'width': {'$exists': True}}).limit(5)
for d in docs:
    print(f"{d.get('_id')}: w={d.get('width')}, h={d.get('height')}, rot={d.get('rotation')}")
