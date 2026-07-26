from pymongo import MongoClient

db = MongoClient('mongodb://zen:sovereign@100.116.12.18:27017').LifeOS

# Reset all documents containing whisk, snick, or woo in originalName or fileName
query = {
    "$or": [
        {"originalName": {"$regex": "Whisk", "$options": "i"}},
        {"fileName": {"$regex": "Whisk", "$options": "i"}},
        {"originalName": {"$regex": "Snick", "$options": "i"}},
        {"fileName": {"$regex": "Snick", "$options": "i"}},
        {"originalName": {"$regex": "Woo ", "$options": "i"}},
        {"fileName": {"$regex": "Woo ", "$options": "i"}}
    ]
}

res = db.pending_accessions.update_many(
    query,
    {
        "$set": {"aiProcessed": False},
        "$unset": {"caption": "", "aiModel": "", "triage.summary": "", "error_msg": "", "aiRetryCount": ""}
    }
)

print(f"Reset {res.modified_count} cat photos for re-ingestion.")
