import requests
import os
import json
from dotenv import load_dotenv

load_dotenv(r"C:\MneOS\.env.local")
api_key = os.environ.get("VITE_XAI_API_KEY")

res = requests.get('https://api.x.ai/v1/models', headers={'Authorization': f'Bearer {api_key}'})
print(json.dumps(res.json(), indent=2))
