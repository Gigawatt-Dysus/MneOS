import re
from pymongo import MongoClient

client = MongoClient('mongodb://zen:sovereign@100.116.12.18:27017')
db = client['LifeOS']

query = { 'logicalDate': { '$gte': '2026-01-01T00:00:00.000Z' } }
docs = db.media.find(query)

def extract_date(filename):
    if not filename:
        return False
    m = re.search(r'((19|20)\d{2})-(0[1-9]|1[0-2]|unknown)?-(0[1-9]|[12]\d|3[01]|unknown)?', filename)
    if m: return True
    m = re.search(r'(?<!\d)(1[0-7]\d{11})(?!\d)', filename)
    if m: return True
    m = re.search(r'(?<!\d)((19|20)\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])_(\d{6})?(?!\d)', filename)
    if m: return True
    return False

c = 0
for doc in docs:
    fname = doc.get('originalName', '')
    if not extract_date(fname):
        print(f"[{doc.get('_id')}] {fname} | Date: {doc.get('logicalDate')}")
        c += 1
    if c >= 50: break
client.close()
