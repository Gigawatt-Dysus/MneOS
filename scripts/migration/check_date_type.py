from pymongo import MongoClient
client = MongoClient('mongodb://zen:sovereign@100.116.12.18:27017')
db = client['LifeOS']

print("Checking for numeric dates...")
cursor = db.media.find({"date": {"$type": "number", "$gt": 1735689600000}}) # > Jan 1 2025 (ms)
print(f"Number dates >= 2025 (ms): {db.media.count_documents({'date': {'$type': 'number', '$gt': 1735689600000}})}")

cursor2 = db.media.find({"date": {"$type": "number", "$gt": 1735689600}}) # > Jan 1 2025 (s)
print(f"Number dates >= 2025 (s): {db.media.count_documents({'date': {'$type': 'number', '$gt': 1735689600}})}")

for doc in cursor.limit(5):
    print(f"[{doc.get('_id')}] {doc.get('originalName')} | Date: {doc.get('date')}")

print("\nAll types of date field:")
types = db.media.aggregate([
    {"$group": {"_id": {"$type": "$date"}, "count": {"$sum": 1}}}
])
for t in types:
    print(t)
client.close()
