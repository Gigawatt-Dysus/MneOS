from pymongo import MongoClient

client = MongoClient('mongodb://zen:sovereign@100.116.12.18:27017')
db = client['LifeOS']

print("Checking logicalDate...")
types = db.media.aggregate([
    {"$group": {"_id": {"$type": "$logicalDate"}, "count": {"$sum": 1}}}
])
for t in types:
    print(t)

print("\nCounting logicalDates >= 2026...")
print(db.media.count_documents({"logicalDate": {"$gte": "2026-01-01"}}))

for doc in db.media.find({"logicalDate": {"$gte": "2026-01-01"}}).limit(20):
    print(f"[{doc.get('_id')}] {doc.get('originalName')} | Date: {doc.get('logicalDate')} | Year: {doc.get('year')}")

client.close()
