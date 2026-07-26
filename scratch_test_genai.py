import os
from google import genai
from google.genai import types

os.environ['GEMINI_API_KEY'] = "AQ.Ab8RN6LQGIJ5f4MFvTFAA-qglmbZgTyQKsllIdfDwmVJ7AHdhg"

client = genai.Client()

try:
    response = client.models.generate_content(
        model='gemini-1.5-flash',
        contents='Tell me a tiny joke.'
    )
    print('[SUCCESS]', response.text)
except Exception as e:
    print('[FAILED]', e)
