from google.oauth2 import service_account
import google.auth.transport.requests
import urllib.request, json

creds = service_account.Credentials.from_service_account_file(r'C:\MneOS\serviceAccountKey.json', scopes=['https://www.googleapis.com/auth/cloud-platform'])
req = google.auth.transport.requests.Request()
creds.refresh(req)

url = f"https://serviceusage.googleapis.com/v1/projects/{creds.project_id}/services/aiplatform.googleapis.com"
r = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + creds.token})
try:
    resp = urllib.request.urlopen(r)
    print("aiplatform.googleapis.com API Status:", json.loads(resp.read())['state'])
except Exception as e:
    print('Failed to check API status:', e)
