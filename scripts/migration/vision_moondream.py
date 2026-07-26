import cv2
import sys
import json
import os
import requests
import base64
import numpy as np

def get_unc_path(filepath):
    if filepath.upper().startswith("F:\\"):
        return filepath.replace("F:\\", "\\\\100.116.12.18\\gga_lifeos_vault_alpha\\", 1)
    return filepath

def analyze(proxy_path, master_path):
    p_unc = get_unc_path(proxy_path)
    m_unc = get_unc_path(master_path)
    
    if not os.path.exists(p_unc) or not os.path.exists(m_unc):
        print(json.dumps({"error": "File not found"}))
        return
        
    proxy = cv2.imread(p_unc)
    master = cv2.imread(m_unc)
    
    if proxy is None or master is None:
        print(json.dumps({"error": "Failed to read image"}))
        return
        
    # Resize to have same height for horizontal concatenation
    h_p, w_p = proxy.shape[:2]
    h_m, w_m = master.shape[:2]
    target_h = 512
    
    proxy_resized = cv2.resize(proxy, (int(w_p * (target_h / h_p)), target_h))
    master_resized = cv2.resize(master, (int(w_m * (target_h / h_m)), target_h))
    
    # Concatenate horizontally
    combined = cv2.hconcat([proxy_resized, master_resized])
    
    cv2.imwrite('combined_debug.jpg', combined)
    
    # Encode to jpg base64
    _, buffer = cv2.imencode('.jpg', combined, [cv2.IMWRITE_JPEG_QUALITY, 85])
    combined_b64 = base64.b64encode(buffer).decode('utf-8')
    
    prompt = "Look at this split-screen image. The left side is one photo and the right side is another. Are they fundamentally the exact same photograph? Answer with just YES or NO."
    
    try:
        response = requests.post('http://localhost:11434/api/generate', json={
            "model": "moondream",
            "prompt": prompt,
            "images": [combined_b64],
            "stream": False
        })
        response.raise_for_status()
        full_response = response.json()
        answer = full_response.get("response", "").strip().upper()
        print(json.dumps({"answer": answer, "raw": full_response}))
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(json.dumps({"error": "Requires proxy_path and master_path args"}))
        sys.exit(1)
    analyze(sys.argv[1], sys.argv[2])
