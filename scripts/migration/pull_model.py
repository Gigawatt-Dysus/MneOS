import requests
import json
import sys
import codecs

# Force stdout to utf-8 if possible, or just strip emojis
sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')

URL = "https://whvwjntp43bppf-11434.proxy.runpod.net/api/pull"
MODEL = "llava:13b"

print(f"Pulling {MODEL} from {URL}...")

try:
    with requests.post(URL, json={"name": MODEL}, stream=True) as r:
        r.raise_for_status()
        for line in r.iter_lines():
            if line:
                data = json.loads(line.decode('utf-8'))
                status = data.get('status', '')
                if 'total' in data and 'completed' in data:
                    total_mb = data['total'] / (1024 * 1024)
                    comp_mb = data['completed'] / (1024 * 1024)
                    pct = (comp_mb / total_mb) * 100
                    sys.stdout.write(f"\r{status}: {comp_mb:.1f}MB / {total_mb:.1f}MB ({pct:.1f}%)")
                    sys.stdout.flush()
                else:
                    print(f"\n{status}")
    print("\nPull complete!")
except Exception as e:
    print(f"\nError pulling model: {e}")
