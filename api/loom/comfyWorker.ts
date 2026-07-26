import fs from 'fs';
import path from 'path';

export async function dispatchToFal(renderPlan: any) {
    const clientId = `mneos_sovereign_${Date.now()}`;
    
    const universalNegative = "bad anatomy, extra fingers, missing fingers, deformed hands, fused digits, mutated limbs, extra arms, extra legs, floating limbs, disfigured, gross proportions, malformed, poorly drawn hands, blurry, airbrushed skin, CGI, 3D render";

    const sharedSeed = Math.floor(Math.random() * 100000000000000);

    // 1. We construct the Sovereign Z-Image Turbo API payload for the Local GGUF Pipeline
    const workflow: any = {
        "28": {
            "class_type": "UNETLoader",
            "inputs": {
                "unet_name": "z_image_turbo_bf16.safetensors",
                "weight_dtype": "default"
            }
        },
        "30": {
            "class_type": "CLIPLoader",
            "inputs": {
                "clip_name": "qwen_3_4b.safetensors",
                "type": "lumina2",
                "device": "default"
            }
        },
        "29": {
            "class_type": "VAELoader",
            "inputs": {
                "vae_name": "ae.safetensors"
            }
        },
        "50": {
            "class_type": "LoraLoader",
            "inputs": {
                "lora_name": "ruthie_z_image_v1.safetensors",
                "strength_model": 1.0,
                "strength_clip": 1.0,
                "model": ["28", 0],
                "clip": ["30", 0]
            }
        },
        "11": {
            "class_type": "ModelSamplingAuraFlow",
            "inputs": {
                "model": ["50", 0],
                "shift": 3.0
            }
        },
        "27": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": "rme_ruthie_GG_core, " + renderPlan.prompt,
                "clip": ["50", 1]
            }
        },
        "33": {
            "class_type": "ConditioningZeroOut",
            "inputs": {
                "conditioning": ["27", 0]
            }
        },
        "13": {
            "class_type": "EmptySD3LatentImage",
            "inputs": {
                "width": 1024,
                "height": 1024,
                "batch_size": 1
            }
        },
        "3": {
            "class_type": "KSampler",
            "inputs": {
                "seed": sharedSeed,
                "steps": 8,
                "cfg": 1.0,
                "sampler_name": "res_multistep",
                "scheduler": "simple",
                "denoise": 1.0,
                "model": ["11", 0],
                "positive": ["27", 0],
                "negative": ["33", 0],
                "latent_image": ["13", 0]
            }
        },
        "8": {
            "class_type": "VAEDecode",
            "inputs": {
                "samples": ["3", 0],
                "vae": ["29", 0]
            }
        },
        "9": {
            "class_type": "SaveImage",
            "inputs": {
                "filename_prefix": "Loom_Sovereign",
                "images": ["8", 0]
            }
        }
    };

    // 2. Img2Img bypass if a reference image is provided
    if (renderPlan.reference_image) {
        try {
            const rawFilename = path.basename(renderPlan.reference_image);
            const sourcePathOutput = path.join('F:\\MneOS_Loom_Output', rawFilename);
            const sourcePathInput = path.join('C:\\MneOS\\scratch\\MneOS_Comfy\\input', rawFilename);
            
            let finalPath = '';
            if (fs.existsSync(sourcePathOutput)) finalPath = sourcePathOutput;
            else if (fs.existsSync(sourcePathInput)) finalPath = sourcePathInput;

            if (finalPath) {
                console.log(`[Loom Worker] Uploading reference image to Sovereign pipeline: ${finalPath}`);
                
                // Upload the image to the remote ComfyUI instance via multipart/form-data
                const fileBuffer = fs.readFileSync(finalPath);
                const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
                const prePayload = `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="loom_ref_${Date.now()}.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`;
                const postPayload = `\r\n--${boundary}--\r\n`;
                
                const body = Buffer.concat([
                    Buffer.from(prePayload, 'utf-8'),
                    fileBuffer,
                    Buffer.from(postPayload, 'utf-8')
                ]);

                const uploadRes = await fetch('http://127.0.0.1:8189/upload/image', {
                    method: 'POST',
                    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
                    body
                });
                
                if (!uploadRes.ok) {
                    throw new Error(`Remote upload failed: ${uploadRes.statusText}`);
                }
                const uploadData = await uploadRes.json();
                const remoteFilename = uploadData.name;

                // Add LoadImage node
                workflow["111"] = {
                    "class_type": "LoadImage",
                    "inputs": {
                        "image": remoteFilename,
                        "upload": "image"
                    }
                };

                // Add VAEEncode node
                workflow["112"] = {
                    "class_type": "VAEEncode",
                    "inputs": {
                        "pixels": ["111", 0],
                        "vae": ["29", 0] // Z-Image Turbo VAE
                    }
                };

                // Hotwire the KSampler to use the VAEEncode output instead of EmptyLatentImage
                workflow["3"].inputs.latent_image = ["112", 0];
                
                // If the user just wants to enhance the skin/texture of an existing image, lock the structural pass
                if (renderPlan.pipeline_id === 'face_skin_only') {
                    workflow["3"].inputs.denoise = 0.05; // Phase 1 does nothing
                } else {
                    workflow["3"].inputs.denoise = 0.65; // Standard img2img structural change
                }
                
                // Remove the empty latent node to keep the graph clean
                delete workflow["13"];
            }
        } catch (e: any) {
            console.error(`[Loom Worker] Failed to attach reference image to local pipeline:`, e.message);
        }
    }

    // 3. Dispatch to local ComfyUI API
    try {
        console.log(`[Loom Worker] Dispatching RenderPlan to local Sovereign Forge (127.0.0.1:8189)...`);
        
        const response = await fetch('http://127.0.0.1:8189/prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: workflow,
                client_id: clientId
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Loom Worker] ComfyUI Error Response:`, errorText);
            throw new Error(`Sovereign Forge rejected the prompt: ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        const prompt_id = data.prompt_id;
        console.log(`[Loom Worker] Sovereign Job Queued. Prompt ID: ${prompt_id}`);
        
        // 4. Poll for completion
        return await pollComfyUIHistory(prompt_id, clientId);

    } catch (error: any) {
        console.error(`[Loom Worker] Sovereign Dispatch Failed:`, error.message || error);
        return { success: false, error: error.message || "Unknown ComfyUI API Error. Is the Forge running?" };
    }
}

async function pollComfyUIHistory(prompt_id: string, clientId: string): Promise<any> {
    console.log(`[Loom Worker] Polling Sovereign Forge for completion of ${prompt_id}...`);
    
    // Poll every 2 seconds for up to ~2 minutes
    for (let i = 0; i < 60; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        try {
            const res = await fetch('http://127.0.0.1:8189/history/' + prompt_id);
            if (res.ok) {
                const history = await res.json();
                if (history[prompt_id]) {
                    const outputs = history[prompt_id].outputs;
                    
                    // Node 9 is our SaveImage node
                    if (outputs && outputs["9"] && outputs["9"].images && outputs["9"].images.length > 0) {
                        const filename = outputs["9"].images[0].filename;
                        
                        // Serve the image via the Express proxy to bypass browser CSP
                        const imageUrl = `/api/comfy-output/${filename}`;
                        console.log(`[Loom Worker] Sovereign Render Complete: ${imageUrl}`);
                        return { success: true, image_url: imageUrl, client_id: clientId };
                    }
                }
            }
        } catch (e) {
            // Ignore minor connection drops during polling
        }
    }
    return { success: false, error: "Timed out waiting for the Sovereign Forge to complete the render." };
}
