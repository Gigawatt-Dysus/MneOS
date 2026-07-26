from google import genai
from google.genai import types
import json

with open(r'C:\MneOS\serviceAccountKey.json', 'r') as f:
    data = json.load(f)

import os
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = r'C:\MneOS\serviceAccountKey.json'

# Vertex AI test
client = genai.Client(vertexai=True, project=data['project_id'], location='us-central1')

try:
    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents='Tell me a tiny joke.'
    )
    print('[SUCCESS Vertex] ' + response.text)
except Exception as e:
    print('[FAILED Vertex] ' + str(e))
