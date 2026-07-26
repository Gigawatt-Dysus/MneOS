import cv2
import numpy as np
import sys

def align_and_crop(master_path, proxy_path, output_path):
    print(f"Loading master: {master_path}")
    master = cv2.imread(master_path)
    print(f"Loading proxy: {proxy_path}")
    proxy = cv2.imread(proxy_path)

    if master is None or proxy is None:
        print("Error: Could not load one of the images.")
        return False

    # Convert to grayscale for feature matching
    master_gray = cv2.cvtColor(master, cv2.COLOR_BGR2GRAY)
    proxy_gray = cv2.cvtColor(proxy, cv2.COLOR_BGR2GRAY)

    # Use ORB to find keypoints and descriptors
    orb = cv2.ORB_create(5000)
    kp1, des1 = orb.detectAndCompute(proxy_gray, None)
    kp2, des2 = orb.detectAndCompute(master_gray, None)

    # Match features
    matcher = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
    matches = matcher.match(des1, des2)
    matches = sorted(matches, key=lambda x: x.distance)

    # Extract top 20% of matches
    num_good_matches = int(len(matches) * 0.2)
    matches = matches[:num_good_matches]

    if len(matches) < 4:
        print("Not enough matches to calculate homography.")
        return False

    # Extract point coordinates
    points1 = np.zeros((len(matches), 2), dtype=np.float32)
    points2 = np.zeros((len(matches), 2), dtype=np.float32)

    for i, match in enumerate(matches):
        points1[i, :] = kp1[match.queryIdx].pt
        points2[i, :] = kp2[match.trainIdx].pt

    # Find the transformation matrix from proxy to master
    # Since we want to crop the master TO the proxy's view, we map proxy bounds to master
    h, mask = cv2.findHomography(points1, points2, cv2.RANSAC)

    # Get the bounding box of the proxy image
    h_proxy, w_proxy = proxy.shape[:2]
    proxy_corners = np.float32([[0, 0], [w_proxy, 0], [w_proxy, h_proxy], [0, h_proxy]]).reshape(-1, 1, 2)
    
    # Map proxy corners to master coordinates
    mapped_corners = cv2.perspectiveTransform(proxy_corners, h)
    
    # Calculate bounding box in master
    x_min = int(np.min(mapped_corners[:, 0, 0]))
    x_max = int(np.max(mapped_corners[:, 0, 0]))
    y_min = int(np.min(mapped_corners[:, 0, 1]))
    y_max = int(np.max(mapped_corners[:, 0, 1]))

    # Ensure bounds are within master image
    x_min = max(0, x_min)
    y_min = max(0, y_min)
    x_max = min(master.shape[1], x_max)
    y_max = min(master.shape[0], y_max)

    print(f"Computed Crop Bounds in High-Res Master: X[{x_min}:{x_max}] Y[{y_min}:{y_max}]")

    # Crop the high-res master
    cropped_master = master[y_min:y_max, x_min:x_max]

    # Resize if we want it to perfectly match proxy dims, or keep native resolution
    # We will keep native high resolution!
    
    cv2.imwrite(output_path, cropped_master)
    print(f"âœ… Saved perfectly cropped High-Res master to: {output_path}")
    return True

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python cv_forge.py <master> <proxy> <output>")
        sys.exit(1)
    
    align_and_crop(sys.argv[1], sys.argv[2], sys.argv[3])
