import os
import re

ROOT_DIR = r"C:\MneOS"

# Directories to explicitly skip
SKIP_DIRS = {".git", "node_modules", "dist", "build", "_backups", ".agent", "logs", "__pycache__"}

# Valid extensions to target
TARGET_EXTS = {".ts", ".tsx", ".js", ".jsx", ".py", ".md", ".json", ".bat", ".ps1", ".env", ".env.local"}

# Regex patterns (case insensitive)
pattern_backslash = re.compile(re.escape(r"C:\MneOS"), re.IGNORECASE)
pattern_forwardslash = re.compile(re.escape(r"C:/MneOS"), re.IGNORECASE)

replacement_backslash = r"C:\MneOS"
replacement_forwardslash = r"C:/MneOS"

files_modified = 0
replacements_made = 0

print("Starting surgical Great Path Sweep (Directory paths only)...")

for dirpath, dirnames, filenames in os.walk(ROOT_DIR):
    # Modify dirnames in-place to skip unwanted directories
    dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
    
    for filename in filenames:
        ext = os.path.splitext(filename)[1].lower()
        if ext in TARGET_EXTS or filename.startswith(".env"):
            filepath = os.path.join(dirpath, filename)
            
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    content = f.read()
            except UnicodeDecodeError:
                # Skip binary or non-utf8 files
                continue
                
            new_content = pattern_backslash.sub(lambda m: replacement_backslash, content)
            new_content = pattern_forwardslash.sub(lambda m: replacement_forwardslash, new_content)
            
            if new_content != content:
                # Count how many replacements were made
                count = len(pattern_backslash.findall(content)) + len(pattern_forwardslash.findall(content))
                replacements_made += count
                files_modified += 1
                
                with open(filepath, "w", encoding="utf-8") as f:
                    f.write(new_content)
                print(f"Updated: {filepath} ({count} replacements)")

print(f"\nSweep Complete. Modified {files_modified} files with a total of {replacements_made} path replacements.")
