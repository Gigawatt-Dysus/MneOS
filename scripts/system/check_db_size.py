from pymongo import MongoClient

client = MongoClient('mongodb://zen:sovereign@100.116.12.18:27017')
db = client.LifeOS

print(f"{'Collection':<30} | {'Storage Size (MB)':<20} | {'Document Count':<15}")
print("-" * 70)

for coll_name in db.list_collection_names():
    stats = db.command("collstats", coll_name)
    size_mb = stats.get("storageSize", 0) / (1024 * 1024)
    count = stats.get("count", 0)
    print(f"{coll_name:<30} | {size_mb:<20.2f} | {count:<15}")
