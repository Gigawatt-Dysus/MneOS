from pymongo import MongoClient
c = MongoClient('mongodb://zen:sovereign@100.116.12.18:27017')
docs = list(c.LifeOS.media.find({'aiModel':'gemini-test'}))
for d in docs:
    print(f"Name: {d.get('originalName', '')} | Date: {d.get('logicalDate')} | Type: {d.get('fileType')} | Title: {d.get('title')}")
