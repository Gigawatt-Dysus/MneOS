import os
import urllib.request
import subprocess
import sys

TARGET_DIR = os.path.join(os.path.dirname(__file__), "lfm_build")
os.makedirs(TARGET_DIR, exist_ok=True)

MODEL_URL = "https://huggingface.co/LiquidAI/LFM2.5-VL-1.6B-GGUF/resolve/main/LFM2.5-VL-1.6B-Q4_0.gguf"
MMPROJ_URL = "https://huggingface.co/LiquidAI/LFM2.5-VL-1.6B-GGUF/resolve/main/mmproj-LFM2.5-VL-1.6b-F16.gguf"

MODEL_FILE = os.path.join(TARGET_DIR, "LFM2.5-VL-1.6B-Q4_0.gguf")
MMPROJ_FILE = os.path.join(TARGET_DIR, "mmproj-LFM2.5-VL-1.6b-F16.gguf")
MODELFILE_PATH = os.path.join(TARGET_DIR, "Modelfile_LFM")

def report_hook(count, block_size, total_size):
    if total_size > 0:
        percent = int(count * block_size * 100 / total_size)
        if percent % 10 == 0:
            sys.stdout.write(f"\rDownloading... {percent}%")
            sys.stdout.flush()

def download_file(url, filename):
    if os.path.exists(filename):
        print("\n[OK] " + os.path.basename(filename) + " already exists. Skipping download.")
        return
    print("\n[+] Downloading " + os.path.basename(filename) + "...")
    urllib.request.urlretrieve(url, filename, reporthook=report_hook)
    print("\n[OK] Downloaded " + os.path.basename(filename) + " successfully.")

def build_modelfile():
    print("\n[+] Building Modelfile...")
    modelfile_content = f"""FROM ./{os.path.basename(MODEL_FILE)}
ADAPTER ./{os.path.basename(MMPROJ_FILE)}
TEMPLATE \"\"\"{{{{ if .System }}}}<|im_start|>system
{{{{ .System }}}}<|im_end|>
{{{{ end }}}}{{{{ if .Prompt }}}}<|im_start|>user
{{{{ .Prompt }}}}<|im_end|>
{{{{ end }}}}<|im_start|>assistant
\"\"\"
PARAMETER stop "<|im_start|>"
PARAMETER stop "<|im_end|>"
"""
    with open(MODELFILE_PATH, "w", encoding="utf-8") as f:
        f.write(modelfile_content)
    print("[OK] Modelfile built.")

def compile_model():
    print("\n[+] Compiling model into Ollama (lfm2.5-vl:1.6b)...")
    # Change cwd so Ollama finds the files referenced in the Modelfile correctly
    result = subprocess.run(["ollama", "create", "lfm2.5-vl:1.6b", "-f", "Modelfile_LFM"], cwd=TARGET_DIR)
    if result.returncode == 0:
        print("\n[OK] Compilation complete! The model 'lfm2.5-vl:1.6b' is locked and loaded.")
        print("You can now update the sandbox script to use 'lfm2.5-vl:1.6b' and run it.")
    else:
        print("\n[FAIL] Compilation failed.")

if __name__ == "__main__":
    print("=======================================================")
    print("LFM2.5-VL-1.6B OLLAMA COMPILER")
    print("=======================================================")
    download_file(MODEL_URL, MODEL_FILE)
    download_file(MMPROJ_URL, MMPROJ_FILE)
    build_modelfile()
    compile_model()
