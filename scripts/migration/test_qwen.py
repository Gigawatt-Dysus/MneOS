import io
import base64
import urllib.request
import json
from PIL import Image
import sys

def test_qwen(filepath):
    print(f"Loading {filepath}...")
    task_prompt = "Describe this image in detail but neutrally. Focus on overall scene, people, actions, and environment. Avoid over-emphasizing any single object like clothing or shoes unless central."
    
    # Compress identically to the pipeline (Drop to 512 to kill TTFT)
    image = Image.open(filepath).convert("RGB")
    image.thumbnail((512, 512))
    buffered = io.BytesIO()
    image.save(buffered, format="JPEG", quality=85)
    img_b64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
    
    url = "http://localhost:11434/api/generate"
    data = {
        "model": "qwen2.5vl:3b",
        "prompt": task_prompt,
        "images": [img_b64],
        "stream": False,
        "options": {
            "num_ctx": 8192
        }
    }
    
    print("Sending to Ollama (Qwen2.5-VL) with dynamic context sizing...")
    req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers={'Content-Type': 'application/json'})
    
    try:
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode('utf-8'))
            print("\n--- CAPTION ---")
            print(result.get('response', '').strip())
            print("---------------\n")
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode('utf-8')
        print(f"\n❌ HTTP Error {e.code}: {err_msg}")
    except Exception as e:
        print(f"\n❌ Error: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_qwen.py <path_to_image>")
    else:
        test_qwen(sys.argv[1])
