import os
import sys
import requests
import torch
import warnings
from PIL import Image

sys.stdout.reconfigure(encoding='utf-8')
warnings.filterwarnings('ignore')

def test_vision_pipeline(target_path):
    print(f"=======================================================")
    print(f"👁️  G.I.G.I. Vision Sandbox")
    print(f"=======================================================")
    print(f"Target: {target_path}")

    if not os.path.exists(target_path):
        print(f"\n❌ Error: Path does not exist or is inaccessible: {target_path}")
        print("If this is a G: Drive file, ensure Google Drive is running and authenticated.")
        sys.exit(1)

    # 1. Load Florence-2
    print("\nLoading Microsoft Florence-2-large Vision Model (fp16)...")
    try:
        from transformers import AutoProcessor, AutoModelForCausalLM
        import sys
        import types
        import importlib.util
        
        # Mock flash_attn to bypass Windows build requirements
        flash_mock = types.ModuleType("flash_attn")
        flash_mock.__spec__ = importlib.util.spec_from_loader("flash_attn", loader=None)
        sys.modules['flash_attn'] = flash_mock
        
        flash_bert_mock = types.ModuleType("flash_attn.bert_padding")
        flash_bert_mock.__spec__ = importlib.util.spec_from_loader("flash_attn.bert_padding", loader=None)
        sys.modules['flash_attn.bert_padding'] = flash_bert_mock
        
        model_id = "microsoft/Florence-2-large"
        
        model = AutoModelForCausalLM.from_pretrained(
            model_id, 
            trust_remote_code=True, 
            torch_dtype=torch.float16
        ).to("cuda")
        
        processor = AutoProcessor.from_pretrained(model_id, trust_remote_code=True)
        print("✅ Florence-2 Loaded Successfully")
    except Exception as e:
        print(f"❌ Failed to load Vision Model: {e}")
        print("Note: You may need to run 'pip install timm' for Florence-2.")
        sys.exit(1)

    # 2. Gather target files
    files_to_process = []
    if os.path.isfile(target_path):
        files_to_process.append(target_path)
    elif os.path.isdir(target_path):
        valid_exts = {'.jpg', '.jpeg', '.png', '.webp'}
        for root, _, files in os.walk(target_path):
            for file in files:
                if os.path.splitext(file)[1].lower() in valid_exts:
                    files_to_process.append(os.path.join(root, file))
                    if len(files_to_process) >= 5:
                        break
            if len(files_to_process) >= 5:
                break
    
    if not files_to_process:
        print("❌ No valid images found at target path.")
        sys.exit(1)

    # 3. Process
    print(f"\nProcessing {len(files_to_process)} images...\n")
    for filepath in files_to_process:
        filename = os.path.basename(filepath)
        print(f"📸 Image: {filename}")
        
        try:
            # Inference with Florence-2
            image = Image.open(filepath).convert("RGB")
            task_prompt = "<DETAILED_CAPTION>"
            
            inputs = processor(text=task_prompt, images=image, return_tensors="pt").to("cuda", torch.float16)
            
            generated_ids = model.generate(
                input_ids=inputs["input_ids"],
                pixel_values=inputs["pixel_values"],
                max_new_tokens=1024,
                num_beams=3,
                do_sample=False
            )
            
            generated_text = processor.batch_decode(generated_ids, skip_special_tokens=False)[0]
            parsed_answer = processor.post_process_generation(generated_text, task=task_prompt, image_size=(image.width, image.height))
            caption = parsed_answer[task_prompt]
            
            print(f"💬 Caption: {caption}")
            
            # Vectorization
            vector_text = f"{filename} {caption}"
            res = requests.post("http://localhost:5005/embed", json={"text": vector_text})
            
            if res.status_code == 200:
                embedding = res.json().get("embedding")
                print(f"🔢 Vector: Successfully generated 1024-dim embedding.")
            else:
                print(f"❌ Vectorizer error: {res.status_code}")
                
        except Exception as e:
            print(f"❌ Failed processing {filename}: {e}")
            
        print("-" * 50)

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python vision_sandbox.py <path_to_image_or_folder>")
        sys.exit(1)
    
    target = sys.argv[1]
    test_vision_pipeline(target)
