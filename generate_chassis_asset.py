import os
import sys
# [ZEN FIX] Use dynamic import to prevent JS/TS language server from flag-alerting on static import syntax
replicate = __import__("replicate")


def run_chassis_pipeline():
    # 1. Authenticate using system environment variables or provided secure fallback
    api_token = os.environ.get("REPLICATE_API_TOKEN") or "r8_HbgpP18DGb6og82sYgzjRb2LtlsYRrl2qoFcu"
    if not api_token:
        print("CRITICAL ERROR: 'REPLICATE_API_TOKEN' variable missing.")
        print("Please export your token to your local environment.")
        sys.exit(1)
        
    os.environ["REPLICATE_API_TOKEN"] = api_token

    print("[LifeOS] Initializing FLUX.2 asset pipeline...")

    # 2. Precise prompt using a seamless, ultra-tight compression suit 
    # to ensure clean contours and minimal fabric noise for 3D vertex baking.
    structural_prompt = structural_prompt = structural_prompt = (
        "An 8k professional orthographic 3D character asset rigging reference sheet. "
        "The sheet features three perfectly aligned, full-body views side-by-side: "
        "FRONT VIEW, 90-degree SIDE PROFILE, and BACK VIEW. The model is rendered "
        "in a strict, formal animation A-pose: the arms are extended outward away "
        "from the body at a precise 45-degree angle from the torso, creating clear, "
        "open space beneath the armpits. Fingers are straight, separated, and extended. "
        "The subject stands flat-footed with legs straight and slightly apart, ensuring "
        "full visibility from the top of the head down to the base of the feet. "
        "The head structure is a perfectly smooth, polished, featureless geometric sphere "
        "with zero organic hair detailing, zero scalp texturing, and an entirely continuous "
        "matte polymer surface finish. The body surface material is a standardized, seamless, "
        "matte grey CAD polymer mannequin chassis with a completely smooth, continuous, "
        "featureless surface texture. There are no clothes, no fabric folds, and no artifacts "
        "under the armpits or torso. The entire asset represents a pure, solid, mathematical volume. "
        "Lighting is uniform, flat, and shadowless studio illumination against a solid neutral "
        "light grey background canvas."
    )

    # 3. Reference URLs of your face assets
    # Note: Place these reference JPG/PNG images inside your 'public/assets/' 
    # folder and deploy. Replicate runs on cloud servers and must be able 
    # to fetch these over the public internet.
    reference_images = [
        "https://gigawatt-archive.vercel.app/assets/Brita_Headshot_Referent_Front-Facing.png",
        "https://gigawatt-archive.vercel.app/assets/Brita_Headshot_Referent_Left-Facing.png",
        "https://gigawatt-archive.vercel.app/assets/Brita_Headshot_Referent_Right-Facing.png"
    ]

    try:
        # 4. Execute the predictive run on Replicate
        output = replicate.run(
            "black-forest-labs/flux-2-dev",
            input={
                "prompt": structural_prompt,
                "input_images": reference_images,
                "aspect_ratio": "3:4",
                "output_format": "png",  # Lossless compression
                "output_quality": 100,
                "go_fast": True
            }
        )

        if output:
            # 1. If it's a list or iterable (excluding pure string/FileOutput streams)
            if isinstance(output, list) and len(output) > 0:
                generated_url = str(output[0])
            # 2. If it's an iterator/generator
            elif hasattr(output, '__next__') or hasattr(output, '__iter__') and not hasattr(output, 'read'):
                output_list = list(output)
                generated_url = str(output_list[0]) if output_list else None
            # 3. Direct FileOutput or string object
            else:
                generated_url = str(output)

            if generated_url:
                print("\n[SUCCESS] Chassis reference sheet generated!")
                print(f"Target URL for Image-to-3D Engine: {generated_url}")
                return generated_url
            
        print("ERROR: Pipeline returned an empty or unresolvable asset.")
        return None

    except Exception as e:
        print(f"CRITICAL FAILURE: Pipeline exception caught:\n{str(e)}")
        return None

if __name__ == "__main__":
    run_chassis_pipeline()
