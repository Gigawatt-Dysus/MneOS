import cv2
import sys
import json
import os
import numpy as np
from skimage.metrics import structural_similarity as ssim

def get_unc_path(filepath):
    if filepath.upper().startswith("F:\\"):
        return filepath.replace("F:\\", "\\\\100.116.12.18\\gga_lifeos_vault_alpha\\", 1)
    return filepath

def dhash(image, hash_size=8):
    # Resize to hash_size + 1 x hash_size
    resized = cv2.resize(image, (hash_size + 1, hash_size))
    # Compute differences between adjacent pixels
    diff = resized[:, 1:] > resized[:, :-1]
    # Convert binary array to integer
    return sum([2 ** i for (i, v) in enumerate(diff.flatten()) if v])

def analyze(proxy_path, master_path):
    p_unc = get_unc_path(proxy_path)
    m_unc = get_unc_path(master_path)
    
    if not os.path.exists(p_unc) or not os.path.exists(m_unc):
        print(json.dumps({"error": "File not found"}))
        return
        
    proxy = cv2.imread(p_unc, cv2.IMREAD_GRAYSCALE)
    master = cv2.imread(m_unc, cv2.IMREAD_GRAYSCALE)
    
    if proxy is None or master is None:
        print(json.dumps({"error": "Failed to read image"}))
        return
        
    # --- STAGE 1: SSIM ---
    # Resize proxy to master's exact dimensions for SSIM
    proxy_resized_ssim = cv2.resize(proxy, (master.shape[1], master.shape[0]))
    score, _ = ssim(proxy_resized_ssim, master, full=True)
    
    if score > 0.85:
        print(json.dumps({
            "answer": "YES",
            "decision": "AUTO_PRUNE_COMPRESSED",
            "reason": f"SSIM Match ({score:.3f})"
        }))
        return

    # --- STAGE 2: dHash ---
    # If SSIM fails (due to slight crop/aspect ratio change), fallback to perceptual diff
    hash_p = dhash(proxy)
    hash_m = dhash(master)
    
    # Calculate Hamming distance (number of bits that differ)
    hamming_distance = bin(hash_p ^ hash_m).count('1')
    
    if hamming_distance < 10:
        print(json.dumps({
            "answer": "YES",
            "decision": "AUTO_PRUNE_COMPRESSED",
            "reason": f"dHash Match (Distance: {hamming_distance}, SSIM: {score:.3f})"
        }))
        return
        
    # --- STAGE 3: Collision ---
    print(json.dumps({
        "answer": "NO",
        "decision": "TAKEOUT_COLLISION",
        "reason": f"Failed Math (SSIM: {score:.3f}, dHash Dist: {hamming_distance})"
    }))

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(json.dumps({"error": "Requires proxy_path and master_path args"}))
        sys.exit(1)
    analyze(sys.argv[1], sys.argv[2])
