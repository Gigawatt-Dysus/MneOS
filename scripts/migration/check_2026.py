import os
import sys
from pymongo import MongoClient
import re

MONGO_URI = "mongodb://zen:sovereign@100.116.12.18:27017"
client = MongoClient(MONGO_URI)
db = client["LifeOS"]
collection = db["media"]

cursor = collection.find({"date": {"$regex": "^2026"}}).limit(50)
print(f"Total 2026 items: {collection.count_documents({'date': {'$regex': '^2026'}})}")
for doc in cursor:
    print(f"[{doc.get('_id')}] {doc.get('originalName')} | Date: {doc.get('date')} | Precision: {doc.get('datePrecision')}")

print("\n\nLet's just look at the most recent 20 dates by sorting date DESC")
for doc in collection.find().sort("date", -1).limit(20):
    print(f"[{doc.get('_id')}] {doc.get('originalName')} | Date: {doc.get('date')} | Precision: {doc.get('datePrecision')}")

client.close()
