const http = require('http');

async function testComfy() {
    const renderPlan = {
        pipeline_id: "face_skin_only",
        prompt: "test",
        reference_image: "test.png"
    };

    const universalNegative = "bad anatomy";

    const workflow = {
        "3": {
            "class_type": "KSampler",
            "inputs": {
                "seed": 1234567,
                "steps": 8,
                "cfg": 1.5,
                "sampler_name": "euler",
                "scheduler": "karras",
                "denoise": 0.05,
                "model": ["10", 0],
                "positive": ["6", 0],
                "negative": ["7", 0],
                "latent_image": ["12", 0]
            }
        },
        "4": {
            "class_type": "UnetLoaderGGUF",
            "inputs": {
                "unet_name": "realvisxl-v5.0-lightning-Q8_0.gguf"
            }
        },
        "13": {
            "class_type": "DualCLIPLoader",
            "inputs": {
                "clip_name1": "clip_l.safetensors",
                "clip_name2": "clip_g.safetensors",
                "type": "sdxl"
            }
        },
        "14": {
            "class_type": "VAELoader",
            "inputs": {
                "vae_name": "sdxl_vae.safetensors"
            }
        },
        "6": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": `rme_ruthie_core, maintaining exact structure`,
                "clip": ["10", 1]
            }
        },
        "7": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": universalNegative,
                "clip": ["10", 1]
            }
        },
        "15": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": "extreme micro-detail",
                "clip": ["13", 0]
            }
        },
        "16": {
            "class_type": "KSampler",
            "inputs": {
                "seed": 1234567,
                "steps": 8,
                "cfg": 1.5,
                "sampler_name": "euler",
                "scheduler": "sgm_uniform",
                "denoise": 0.30,
                "model": ["4", 0],
                "positive": ["15", 0],
                "negative": ["7", 0],
                "latent_image": ["3", 0]
            }
        },
        "8": {
            "class_type": "VAEDecode",
            "inputs": {
                "samples": ["16", 0],
                "vae": ["14", 0]
            }
        },
        "9": {
            "class_type": "SaveImage",
            "inputs": {
                "filename_prefix": "Loom_Sovereign",
                "images": ["8", 0]
            }
        },
        "10": {
            "class_type": "LoraLoader",
            "inputs": {
                "lora_name": "ruthie_stealth_v1.safetensors",
                "strength_model": 1.05,
                "strength_clip": 1.0,
                "model": ["4", 0],
                "clip": ["13", 0]
            }
        },
        "11": {
            "class_type": "LoadImage",
            "inputs": {
                "image": "test.png",
                "upload": "image"
            }
        },
        "12": {
            "class_type": "VAEEncode",
            "inputs": {
                "pixels": ["11", 0],
                "vae": ["14", 0]
            }
        }
    };

    try {
        const payload = JSON.stringify({ prompt: workflow, client_id: "test" });
        const req = http.request({
            hostname: '127.0.0.1',
            port: 8188,
            path: '/prompt',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        }, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => console.log("ComfyUI Response:", res.statusCode, data));
        });
        req.on('error', e => console.error(e));
        req.write(payload);
        req.end();
    } catch (e) {
        console.error(e);
    }
}

testComfy();
