import cv2
import sys
import json
import os
from skimage.metrics import structural_similarity as ssim

def analyze(proxy_path, master_path):
    p_unc = proxy_path
    m_unc = master_path
    
    if not os.path.exists(p_unc) or not os.path.exists(m_unc):
        print(json.dumps({"error": "File not found"}))
        return
        
    proxy = cv2.imread(p_unc)
    master = cv2.imread(m_unc)
    
    if proxy is None or master is None:
        print(json.dumps({"error": "Failed to read image"}))
        return
        
    p_h, p_w = proxy.shape[:2]
    
    # Resize master to match proxy exactly for SSIM
    master_resized = cv2.resize(master, (p_w, p_h), interpolation=cv2.INTER_AREA)
    
    # SSIM
    p_gray = cv2.cvtColor(proxy, cv2.COLOR_BGR2GRAY)
    m_gray = cv2.cvtColor(master_resized, cv2.COLOR_BGR2GRAY)
    score, _ = ssim(p_gray, m_gray, full=True)
    
    # Saturation Shift (using histogram distance)
    p_hsv = cv2.cvtColor(proxy, cv2.COLOR_BGR2HSV)
    m_hsv = cv2.cvtColor(master_resized, cv2.COLOR_BGR2HSV)
    
    p_hist = cv2.calcHist([p_hsv], [0, 1], None, [50, 60], [0, 180, 0, 256])
    m_hist = cv2.calcHist([m_hsv], [0, 1], None, [50, 60], [0, 180, 0, 256])
    cv2.normalize(p_hist, p_hist, 0, 1, cv2.NORM_MINMAX)
    cv2.normalize(m_hist, m_hist, 0, 1, cv2.NORM_MINMAX)
    
    import numpy as np
    distance = cv2.compareHist(p_hist, m_hist, cv2.HISTCMP_BHATTACHARYYA)
    
    is_pillar_boxed = False
    if score < 0.85:
        # Check for pillar boxing using Sobel on X axis
        sobelx = cv2.Sobel(p_gray, cv2.CV_64F, 1, 0, ksize=3)
        sobelx = cv2.convertScaleAbs(sobelx)
        v_proj = np.sum(sobelx, axis=0)
        
        mean_proj = np.mean(v_proj)
        std_proj = np.std(v_proj)
        threshold = mean_proj + 3 * std_proj
        
        # Look for spikes in the 20-40% and 60-80% regions
        left_region = v_proj[int(p_w*0.20):int(p_w*0.40)]
        right_region = v_proj[int(p_w*0.60):int(p_w*0.80)]
        
        if len(left_region) > 0 and len(right_region) > 0:
            if np.max(left_region) > threshold and np.max(right_region) > threshold:
                is_pillar_boxed = True
    
    print(json.dumps({
        "ssimScore": round(float(score), 3),
        "satDiff": round(float(distance * 100), 2), # multiply by 100 to make it 0-100 scale for UI
        "proxySize": os.path.getsize(p_unc),
        "masterSize": os.path.getsize(m_unc),
        "proxyPath": proxy_path,
        "masterPath": master_path,
        "proxyDimensions": {"w": p_w, "h": p_h},
        "masterDimensions": {"w": master.shape[1], "h": master.shape[0]},
        "isPillarBoxed": is_pillar_boxed
    }))

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Missing args"}))
        sys.exit(1)
    analyze(sys.argv[1], sys.argv[2])
