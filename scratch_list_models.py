import os
from google import genai

os.environ['GEMINI_API_KEY'] = "AQ.Ab8RN6LQGIJ5f4MFvTFAA-qglmbZgTyQKsllIdfDwmVJ7AHdhg"
client = genai.Client()

try:
    models = client.models.list()
    for m in models:
        print(m.name, m.supported_actions)
except Exception as e:
    print('[FAILED]', e)
