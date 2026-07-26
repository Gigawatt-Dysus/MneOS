import sqlite3

conn = sqlite3.connect(r'C:\MneOS\staging.db')
cursor = conn.cursor()

cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = cursor.fetchall()
print('Tables:', tables)

for t in tables:
    table_name = t[0]
    cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
    count = cursor.fetchone()[0]
    print(f"Table: {table_name} | Count: {count}")
    
    # Check schema
    cursor.execute(f"PRAGMA table_info({table_name})")
    schema = cursor.fetchall()
    print(f"Schema for {table_name}: {schema}")
