import sqlite3
import argparse
import os
import time
import sys
import psutil
import numpy as np
import torch

# Hack to bypass a bug in transformers 5.10.1 + torch 2.5.1 on Windows
# where transformers unconditionally tries to load a float8 type that doesn't exist
if not hasattr(torch, 'float8_e8m0fnu'):
    torch.float8_e8m0fnu = None

from sentence_transformers import SentenceTransformer

# Parse CLI arguments
parser = argparse.ArgumentParser(description="LifeOS Sovereign Vectorization Engine (Python/CUDA)")
parser.add_argument('--limit', type=int, help='Limit the number of records to process')
parser.add_argument('--dry-run', action='store_true', help='Do not save vectors to DB')
args = parser.parse_args()

BATCH_SIZE = 64
DB_PATH = os.path.join(os.getcwd(), 'staging.db')

def format_bytes(size):
    return f"{(size / 1024 / 1024):.2f} MB"

def extract_context_from_path(filepath):
    if not filepath:
        return 'Unknown Context'
    parts = filepath.split('\\')
    return parts[2] if len(parts) > 2 else parts[-1]

def main():
    print("=======================================================")
    print("🚀 LifeOS Sovereign Vectorization Engine (Python/CUDA)")
    if args.dry_run:
        print("⚠️  DRY RUN MODE ACTIVE - No vectors will be saved to DB")
    if args.limit:
        print(f"🛑 LIMIT APPLIED: Processing max {args.limit} records")
    print("=======================================================\n")

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    if not args.dry_run:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS file_vectors (
                hash TEXT PRIMARY KEY,
                embedding BLOB,
                dim INTEGER DEFAULT 1024,
                vectorized_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (hash) REFERENCES files(hash)
            )
        """)
        conn.commit()

    print("🔍 Scanning for unvectorized records in staging.db...")
    query = """
        SELECT f.hash, f.filename, f.filepath, f.extension, f.size 
        FROM files f
        LEFT JOIN file_vectors v ON f.hash = v.hash
        WHERE v.hash IS NULL
    """
    if args.limit:
        query += f" LIMIT {args.limit}"

    cursor.execute(query)
    pending_records = cursor.fetchall()
    total_pending = len(pending_records)

    print(f"📊 Found {total_pending} records requiring vectorization.\n")

    if total_pending == 0:
        print("✅ All records are vectorized. Exiting.")
        sys.exit(0)

    print("🧠 Loading Voyage-4-Nano (MoE) into VRAM...")
    
    # Load model. truncate_dim=1024 for LifeOS Atlas compatibility
    model = SentenceTransformer("voyageai/voyage-4-nano", trust_remote_code=True, truncate_dim=1024)
    print("✅ Model loaded successfully.\n")

    processed_count = 0
    start_time = time.time()

    for i in range(0, total_pending, BATCH_SIZE):
        batch = pending_records[i:i + BATCH_SIZE]
        batch_hashes = [record[0] for record in batch]
        
        # Prepare rich semantic text
        texts_to_embed = []
        for record in batch:
            _, filename, filepath, ext, size = record
            context = extract_context_from_path(filepath)
            size_str = format_bytes(size or 0)
            text = f"File: {filename}\nPath: {filepath}\nContext: {context}\nType: {ext}\nSize: {size_str}"
            texts_to_embed.append(text)

        # Generate embeddings. Use encode_document to automatically prepend the Voyage document prompt.
        embeddings = model.encode_document(texts_to_embed)

        if not args.dry_run:
            try:
                cursor.execute("BEGIN TRANSACTION")
                for hsh, emb in zip(batch_hashes, embeddings):
                    # Ensure float32 and convert to bytes for BLOB storage (4096 bytes flat)
                    emb_fp32 = np.array(emb, dtype=np.float32)
                    cursor.execute("INSERT INTO file_vectors (hash, embedding, dim) VALUES (?, ?, 1024)", (hsh, emb_fp32.tobytes()))
                conn.commit()
            except Exception as e:
                conn.rollback()
                print(f"\n❌ Transaction Failed: {e}")
                sys.exit(1)

        processed_count += len(batch)
        
        # Metrics
        elapsed = time.time() - start_time
        rate = processed_count / elapsed
        
        process = psutil.Process(os.getpid())
        mem_mb = process.memory_info().rss / 1024 / 1024
        
        remaining = total_pending - processed_count
        eta_secs = remaining / rate if rate > 0 else 0
        eta_mins = eta_secs / 60

        sys.stdout.write(f"\r⚙️ Progress: {processed_count} / {total_pending} ({(processed_count/total_pending*100):.1f}%) | Rate: {rate:.1f}/s | ETA: {eta_mins:.1f}m | RAM: {mem_mb:.1f}MB")
        sys.stdout.flush()

    print(f"\n\n🎉 Vectorization complete! Processed {processed_count} records in {(time.time() - start_time):.1f}s.")
    conn.close()

if __name__ == "__main__":
    main()
