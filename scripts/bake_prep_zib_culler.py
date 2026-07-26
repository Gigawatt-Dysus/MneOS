import os
import shutil
import base64
import json
from openai import OpenAI

# Configuration
XAI_API_KEY = os.getenv("XAI_API_KEY")
SOURCE_DIR = r"G:\My Drive\[ Documents ]\[ Project GIGI - MneOS - Eric Cornett ]\[ People ]\[ Evers, Ruth Marie ]\Meta Renders"
VAULT_DIR = r"F:\ZIB_Dataset_Bake\datasets"

PORTRAIT_DIR = os.path.join(VAULT_DIR, "ruthie_portrait")
ANATOMY_DIR = os.path.join(VAULT_DIR, "ruthie_anatomy")
NSFW_DIR = os.path.join(VAULT_DIR, "ruthie_nsfw")
# Bypass the 25-image guillotine for the 170-image Omni-LoKr
TARGET_IMAGE_COUNT = 999

client = OpenAI(
    api_key=XAI_API_KEY,
    base_url="https://api.xai.com/v1",
)

def encode_image(image_path):
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

def evaluate_image(image_path):
    base64_image = encode_image(image_path)
    
    system_prompt = """
    You are an expert Z-Image-Base LoRA dataset curator. You evaluate images for biometric training.
    
    Task 1: Evaluate the image on a scale of 1-10 for training value.
    Prioritize: Photometric variety, dynamic lighting, anatomical clarity, absence of AI artifacts.
    
    Task 2: Classify the image composition into one of three strict categories based on content.
    Output MUST be exactly 'portrait' (head/face/shoulder, with or without glasses), 'anatomy' (full body clothed or nude reference), or 'nsfw' (explicit sexual content or highly suggestive nude action).
    
    Task 3: Write a Parameterized Identity caption.
    Rule 1: MUST start with the exact class trigger: 
            If portrait: 'Ruthie_v4 portrait, '
            If anatomy: 'Ruthie_v4 anatomy, '
            If nsfw: 'Ruthie_v4 nsfw, '
    Rule 2: You MUST explicitly list her 'body specs array' using clinical, comma-separated tags (e.g., pale skin, b-cup breasts, athletic build).
    Rule 3: Describe the clothing, lighting, camera angle, and EXPLICITLY describe the environment/background. (e.g. 'neutral studio backdrop', 'busy city street, blurred bokeh background').
    Rule 4: Do NOT describe her eye color, hair color, or facial features (we want the base token to absorb the face).
    
    Respond in pure JSON format:
    {
        "score": 8,
        "classification": "portrait",
        "caption": "Ruthie_v4 portrait, pale skin, wearing wireframe glasses, extreme close up, looking down 45 degrees, neutral grey studio backdrop."
    }
    """
    
    try:
        response = client.chat.completions.create(
            model="grok-vision-beta",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": system_prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}"
                            }
                        }
                    ]
                }
            ],
            response_format={ "type": "json_object" }
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        print(f"Error evaluating image: {e}")
        return {"score": 0, "classification": "portrait", "caption": ""}

def main():
    if not XAI_API_KEY:
        print("CRITICAL: XAI_API_KEY not found in environment.")
        return

    os.makedirs(PORTRAIT_DIR, exist_ok=True)
    os.makedirs(ANATOMY_DIR, exist_ok=True)
    os.makedirs(NSFW_DIR, exist_ok=True)
    
    print("Beginning MneOS ZIB Dataset Culling...")
    results = []
    
    # Iterate through golden renders
    valid_extensions = ('.webp', '.jpg', '.jpeg', '.png')
    if not os.path.exists(SOURCE_DIR):
        print(f"CRITICAL: SOURCE_DIR not found at {SOURCE_DIR}")
        return

    for root, _, files in os.walk(SOURCE_DIR):
        for filename in files:
            if filename.lower().endswith(valid_extensions):
                path = os.path.join(root, filename)
                print(f"Evaluating: {filename} (from {os.path.basename(root)})...")
            
            eval_data = evaluate_image(path)
            eval_data['original_path'] = path
            eval_data['filename'] = filename
            results.append(eval_data)
            
    # Sort by score descending, drop failures (score < 5)
    valid_results = [r for r in results if r['score'] >= 5]
    valid_results.sort(key=lambda x: x['score'], reverse=True)
    
    print(f"\nEvaluation Complete. Copying {len(valid_results)} high-quality images to Vault F:...")
    
    for idx, item in enumerate(valid_results):
        if item['classification'] == 'portrait':
            target_dir = PORTRAIT_DIR
        elif item['classification'] == 'nsfw':
            target_dir = NSFW_DIR
        else:
            target_dir = ANATOMY_DIR
        
        # New filename e.g. ruthie_01.webp
        ext = os.path.splitext(item['filename'])[1]
        new_filename = f"ruthie_{str(idx).zfill(3)}"
        
        dest_image = os.path.join(target_dir, new_filename + ext)
        dest_txt = os.path.join(target_dir, new_filename + ".txt")
        
        # Copy image and write sidecar
        shutil.copy2(item['original_path'], dest_image)
        with open(dest_txt, 'w', encoding='utf-8') as f:
            f.write(item['caption'])
            
        print(f"[{item['classification'].upper()}] -> {new_filename} | Score: {item['score']}")

    print("\nZIB Golden Master Dataset assembled and copied to F: Vault successfully.")

if __name__ == "__main__":
    main()
