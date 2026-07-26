import cv2
import numpy as np
import sys
import json
import os

def color_transfer(source, target):
    """
    Transfers the color distribution from the source to the target
    image using the L*a*b* color space.
    """
    # Convert images to L*a*b* color space
    source = cv2.cvtColor(source, cv2.COLOR_BGR2LAB).astype("float32")
    target = cv2.cvtColor(target, cv2.COLOR_BGR2LAB).astype("float32")
    
    # Compute mean and standard deviation for each channel
    (meanSrc, stdSrc) = cv2.meanStdDev(source)
    (meanTar, stdTar) = cv2.meanStdDev(target)
    
    (lMeanSrc, aMeanSrc, bMeanSrc) = (meanSrc[0][0], meanSrc[1][0], meanSrc[2][0])
    (lStdSrc, aStdSrc, bStdSrc) = (stdSrc[0][0], stdSrc[1][0], stdSrc[2][0])
    
    (lMeanTar, aMeanTar, bMeanTar) = (meanTar[0][0], meanTar[1][0], meanTar[2][0])
    (lStdTar, aStdTar, bStdTar) = (stdTar[0][0], stdTar[1][0], stdTar[2][0])
    
    # Split the target image into its channels
    (l, a, b) = cv2.split(target)
    
    # Scale and shift the channels
    l = ((l - lMeanTar) * (lStdSrc / (lStdTar + 1e-5))) + lMeanSrc
    a = ((a - aMeanTar) * (aStdSrc / (aStdTar + 1e-5))) + aMeanSrc
    b = ((b - bMeanTar) * (bStdSrc / (bStdTar + 1e-5))) + bMeanSrc
    
    # Clip values to the valid [0, 255] range
    l = np.clip(l, 0, 255)
    a = np.clip(a, 0, 255)
    b = np.clip(b, 0, 255)
    
    # Merge the channels back together and convert back to BGR
    transfer = cv2.merge([l, a, b]).astype("uint8")
    
    # Package the statistics for ML extraction
    stats = {
        "proxy": {
            "mean": [float(lMeanSrc), float(aMeanSrc), float(bMeanSrc)],
            "std": [float(lStdSrc), float(aStdSrc), float(bStdSrc)]
        },
        "master": {
            "mean": [float(lMeanTar), float(aMeanTar), float(bMeanTar)],
            "std": [float(lStdTar), float(aStdTar), float(bStdTar)]
        }
    }
    
    return cv2.cvtColor(transfer, cv2.COLOR_LAB2BGR), stats

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print(json.dumps({"error": "Usage: python histo_transplant.py <master_path> <proxy_path> <out_path>"}))
        sys.exit(1)
        
    master_path = sys.argv[1]
    proxy_path = sys.argv[2]
    out_path = sys.argv[3]
    
    try:
        master = cv2.imread(master_path)
        if master is None:
            raise Exception(f"Failed to load master image: {master_path}")
            
        proxy = cv2.imread(proxy_path)
        if proxy is None:
            raise Exception(f"Failed to load proxy image: {proxy_path}")
            
        result, stats = color_transfer(proxy, master)
        
        # Ensure output directory exists
        out_dir = os.path.dirname(out_path)
        if not os.path.exists(out_dir):
            os.makedirs(out_dir, exist_ok=True)
            
        cv2.imwrite(out_path, result)
        print(json.dumps({"success": True, "out_path": out_path, "stats": stats}))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
