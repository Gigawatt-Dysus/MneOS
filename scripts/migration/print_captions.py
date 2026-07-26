from pymongo import MongoClient
db = MongoClient('mongodb://zen:sovereign@100.116.12.18:27017').LifeOS

print('--- Whiskers and Snick on the couch ---')
for d in db.pending_accessions.find({'originalName': {'$regex': 'Whiskers and Snick on the couch', '$options': 'i'}}):
    print(d.get('caption', 'NO CAPTION'))

print('--- Whisk stretching on bed 2 ---')
for d in db.pending_accessions.find({'originalName': {'$regex': 'Whisk stretching on bed 2', '$options': 'i'}}):
    print(d.get('caption', 'NO CAPTION'))

print('--- Other cat photos ---')
for d in db.pending_accessions.find({'caption': {'$exists': True}, 'originalName': {'$regex': 'Whiskers 10', '$options': 'i'}}):
    print(d.get('originalName') + ": " + d.get('caption', ''))
