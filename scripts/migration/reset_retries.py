from pymongo import MongoClient
db=MongoClient('mongodb://zen:sovereign@100.116.12.18:27017').LifeOS
res = db.pending_accessions.update_many(
    {'userId': '9MPVGVTxE8dXvkCrl1XrWHQzCl23', 'aiRetryCount': {'$exists': True}},
    {'$unset': {'aiRetryCount': "", 'error_msg': "", 'claim_time': "", 'claimed_by': ""}}
)
print(f"Reset {res.modified_count} errored records.")
