from pymongo import MongoClient

c = MongoClient("mongodb://zen:sovereign@100.116.12.18:27017")
db = c.LifeOS

res = list(db.media.aggregate([
    {"$group": {"_id": "$aiModel", "count": {"$sum": 1}}}
]))

for r in res:
    print(r)
