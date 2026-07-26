from pymongo import MongoClient

c=MongoClient('mongodb://zen:sovereign@100.116.12.18:27017')
docs = list(c.LifeOS.pending_accessions.find({'aiModel':'gemini-test'}))
for d in docs:
    print(f"Name: {d.get('originalName', '')} | UID: {d.get('userId')} | URL: {str(d.get('url'))[:30]}")
