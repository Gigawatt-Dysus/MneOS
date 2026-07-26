import sqlite3
import cv2
import numpy as np
import os
import random

# Function to convert F:\ drive paths to Tailscale UNC paths
def get_unc_path(filepath):
    if filepath.upper().startswith("F:\\"):
        return filepath.replace("F:\\", "\\\\100.116.12.18\\gga_lifeos_vault_alpha\\", 1)
    return filepath

def analyze_pair(proxy_path, master_path):
    proxy = cv2.imread(proxy_path)
    master = cv2.imread(master_path)
    
    if proxy is None or master is None:
        return "ERROR_LOADING"
        
    p_h, p_w = proxy.shape[:2]
    m_h, m_w = master.shape[:2]
    
    # Check aspect ratio
    p_aspect = p_w / p_h
    m_aspect = m_w / m_h
    
    # If aspect ratio differs by more than 1%, it's definitely cropped
    if abs(p_aspect - m_aspect) > 0.01:
        return "CROPPED"
        
    # Check color histogram (to detect filters like B&W, Sepia, heavy saturation)
    # Resize master to proxy size for fair comparison
    master_resized = cv2.resize(master, (p_w, p_h), interpolation=cv2.INTER_AREA)
    
    # Convert to HSV to compare Hue and Saturation heavily
    p_hsv = cv2.cvtColor(proxy, cv2.COLOR_BGR2HSV)
    m_hsv = cv2.cvtColor(master_resized, cv2.COLOR_BGR2HSV)
    
    # Calculate histograms for Hue and Saturation
    p_hist = cv2.calcHist([p_hsv], [0, 1], None, [50, 60], [0, 180, 0, 256])
    m_hist = cv2.calcHist([m_hsv], [0, 1], None, [50, 60], [0, 180, 0, 256])
    
    cv2.normalize(p_hist, p_hist, 0, 1, cv2.NORM_MINMAX)
    cv2.normalize(m_hist, m_hist, 0, 1, cv2.NORM_MINMAX)
    
    # Compare using Bhattacharyya distance (0 means identical, 1 means completely different)
    distance = cv2.compareHist(p_hist, m_hist, cv2.HISTCMP_BHATTACHARYYA)
    
    # We allow some variance because compression alters colors slightly
    if distance > 0.15:
        return f"FILTERED (dist: {distance:.3f})"
        
    return f"PHANTOM_EDIT (dist: {distance:.3f})"

def run_census():
    print("ðŸ”Ž Connecting to SQLite and dropping the stone...")
    conn = sqlite3.connect('C:/MneOS/staging.db')
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT filepath FROM airlock_jobs 
        WHERE filepath LIKE '%-edited%'
    """)
    edited_files = cursor.fetchall()
    conn.close()
    
    if not edited_files:
        print("No edited files found.")
        return
        
    print(f"Found {len(edited_files)} proxy candidates in DB. Selecting 50 random samples...")
    random.shuffle(edited_files)
    
    phantom_count = 0
    cropped_count = 0
    filtered_count = 0
    error_count = 0
    tested = 0
    
    for (filepath,) in edited_files:
        if tested >= 50:
            break
            
        proxy_unc = get_unc_path(filepath)
        # Try to guess the master name (remove '-edited')
        # Handle cases like DSC_1274-edited.JPG or S7300008-edited(1).JPG
        
        # simple replace of "-edited"
        master_unc = proxy_unc.replace("-edited", "", 1)
        
        if os.path.exists(proxy_unc) and os.path.exists(master_unc):
            status = analyze_pair(proxy_unc, master_unc)
            if "PHANTOM" in status:
                phantom_count += 1
            elif "CROP" in status:
                cropped_count += 1
            elif "FILTERED" in status:
                filtered_count += 1
            else:
                error_count += 1
                
            tested += 1
            print(f"[{tested}/50] {os.path.basename(proxy_unc)} -> {status}")
            
    print("\\n=======================================================")
    print(f"SPLASH REPORT ({tested} valid pairs analyzed)")
    print("=======================================================")
    print(f"ðŸ‘» PHANTOM EDITS (Identical/Auto-Prune): {phantom_count} ({(phantom_count/tested)*100:.1f}%)")
    print(f"âœ‚ï¸  TRUE CROPS     (Needs HITL UI):       {cropped_count} ({(cropped_count/tested)*100:.1f}%)")
    print(f"ðŸŽ¨ TRUE FILTERS   (Needs HITL UI):       {filtered_count} ({(filtered_count/tested)*100:.1f}%)")
    print(f"â Œ ERRORS: {error_count}")
    print("=======================================================\\n")

if __name__ == "__main__":
    run_census()
