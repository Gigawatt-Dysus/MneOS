import os
import sys
import torch
import warnings
from dotenv import load_dotenv
from pymongo import MongoClient

# Suppress warnings for cleaner CLI output
warnings.filterwarnings('ignore')

# Hack to bypass transformers bug
if not hasattr(torch, 'float8_e8m0fnu'):
    torch.float8_e8m0fnu = None

from sentence_transformers import SentenceTransformer

# Load .env.local
dotenv_path = os.path.join(os.getcwd(), '.env.local')
load_dotenv(dotenv_path)

mongodb_uri = os.environ.get('MONGODB_URI')
if not mongodb_uri:
    print("❌ MONGODB_URI not found in .env.local")
    sys.exit(1)

def main():
    print("=======================================================")
    print("🧠 LifeOS Sovereign Search - Live REPL")
    print("=======================================================\n")

    print("🔌 Connecting to MongoDB Atlas...")
    client = MongoClient(mongodb_uri)
    db = client['LifeOS']
    collection = db['takeout_media']
    
    # Ping to verify
    try:
        client.admin.command('ping')
        print("✅ Atlas Connection Established.")
    except Exception as e:
        print(f"❌ Failed to connect to Atlas: {e}")
        sys.exit(1)

    print("\n📦 Loading Voyage-4-Nano (MoE) into VRAM...")
    try:
        model = SentenceTransformer("voyageai/voyage-4-nano", trust_remote_code=True, truncate_dim=1024)
        print("✅ Model loaded. Ready for queries.\n")
    except Exception as e:
        print(f"❌ Failed to load model: {e}")
        sys.exit(1)

    print("Type your search terms and press Enter. Type 'exit' or 'quit' to close.\n")

    while True:
        try:
            query = input("🔍 Search> ")
            query = query.strip()
            
            if not query:
                continue
            if query.lower() in ['exit', 'quit']:
                break
                
            # Embed the query
            # print("   [Embedding...]", end='\r')
            query_vector = model.encode_query(query).tolist()
            
            # Search Atlas
            # print("   [Querying Atlas...]", end='\r')
            pipeline = [
                {
                    "$vectorSearch": {
                        "index": "vector_index",
                        "path": "embedding",
                        "queryVector": query_vector,
                        "numCandidates": 150,
                        "limit": 5,
                        "filter": { "userId": "eric_cornett" }
                    }
                },
                {
                    "$project": {
                        "_id": 0,
                        "filename": 1,
                        "filepath": 1,
                        "size": 1,
                        "score": { "$meta": "vectorSearchScore" }
                    }
                }
            ]
            
            results = list(collection.aggregate(pipeline))
            
            # Clear line
            print(" " * 40, end='\r')
            print(f"\n🏆 Top 5 Semantic Matches for: '{query}'")
            print("-" * 50)
            
            for i, doc in enumerate(results):
                score = doc.get('score', 0)
                filename = doc.get('filename', 'Unknown')
                filepath = doc.get('filepath', 'Unknown')
                
                print(f"[{i+1}] {score:.4f} | {filename}")
                print(f"    Path: {filepath}")
            
            print("-" * 50 + "\n")
            
        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f"\n❌ Error during search: {e}\n")

    print("\n👋 Exiting...")
    client.close()

if __name__ == "__main__":
    main()
