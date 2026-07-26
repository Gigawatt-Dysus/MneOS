from pymongo import MongoClient
db = MongoClient('mongodb://zen:sovereign@100.116.12.18:27017').LifeOS

print('--- Whiskers and Snick on the couch ---')
for d in db.pending_accessions.find({'originalName': {'$regex': 'Whiskers and Snick on the couch', '$options': 'i'}}):
    print("aiRetryCount:", d.get('aiRetryCount'))
    print("error_msg:", d.get('error_msg'))
    print("aiProcessed:", d.get('aiProcessed'))
    print("caption:", d.get('caption'))
