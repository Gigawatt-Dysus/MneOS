import re
from pymongo import MongoClient
import random

# Connect to DB
client = MongoClient('mongodb://zen:sovereign@100.116.12.18:27017')
db = client['LifeOS']

# We specifically want to test images with people, faces, crowds, or complex human situations.
# We'll query for captions that explicitly describe these things.
regex = re.compile('people|person|man|woman|boy|girl|crowd|face|smiling|standing|sitting|wearing', re.IGNORECASE)
query = {
    'aiModel': 'gemini-2.5-flash',
    'caption': regex
}

# Fetch 1000 matching documents and randomly sample 10 to ensure a good mix
print("Fetching from DB...")
docs = list(db['pending_accessions'].find(query).limit(1000))
print(f"Found {len(docs)} matching documents. Shuffling...")
random.shuffle(docs)
sampled_docs = docs[:10]

html_content = '''
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Gemini Validation Test - Humans & Complex Scenes</title>
<style>
body { font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #111; color: #eee; }
img { max-width: 100%; height: auto; border: 1px solid #444; border-radius: 4px; margin-bottom: 10px; }
h3 { color: #58a6ff; margin-top: 40px; }
.caption { background: #222; padding: 15px; border-left: 4px solid #58a6ff; line-height: 1.5; margin-bottom: 40px;}
</style>
</head>
<body>
<h1>Gemini 2.5 Flash - Human & Complex Situation Sample</h1>
<p>Here are 10 random images containing people, faces, crowds, or complex human interactions.</p>
'''

for i, doc in enumerate(sampled_docs):
    original_name = doc.get('originalName') or doc.get('fileName') or 'Unknown'
    caption = doc.get('caption', 'none')
    
    thumb_url = ''
    if 'thumbnailUrls' in doc:
        thumb_url = doc['thumbnailUrls'].get('large') or doc['thumbnailUrls'].get('medium') or doc['thumbnailUrls'].get('small') or ''
    elif 'url' in doc:
        thumb_url = doc['url']
        
    html_content += f'<h3>{i+1}. {original_name}</h3>\n'
    if thumb_url and thumb_url.startswith('http'):
        html_content += f'<img src="{thumb_url}" alt="{original_name}">\n'
    html_content += f'<div class="caption"><strong>Caption:</strong> {caption}</div>\n'

html_content += '''
</body>
</html>
'''

with open('gemini_manual_check_humans.html', 'w', encoding='utf-8') as f:
    f.write(html_content)
    
print("Successfully wrote gemini_manual_check_humans.html")
