from unsloth import FastLanguageModel
import torch
from datasets import load_dataset
from trl import SFTTrainer, SFTConfig

max_seq_length = 2048
dtype = None
load_in_4bit = True

print("🚀 Initializing Unsloth Base Model (Llama-3 70B Instruct)...")
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name = "unsloth/llama-3-70b-Instruct-bnb-4bit",
    max_seq_length = max_seq_length,
    dtype = dtype,
    load_in_4bit = load_in_4bit,
)

print("🔗 Injecting LoRA Adapters...")
model = FastLanguageModel.get_peft_model(
    model,
    r = 16,
    target_modules = ["q_proj", "k_proj", "v_proj", "o_proj",
                      "gate_proj", "up_proj", "down_proj",],
    lora_alpha = 16,
    lora_dropout = 0,
    bias = "none",
    use_gradient_checkpointing = "unsloth",
    random_state = 3407,
    use_rslora = False,
    loftq_config = None,
)

print("💾 Loading Brita Golden Master Dataset...")
dataset = load_dataset("json", data_files="brita_training_data.jsonl", split="train")

from unsloth.chat_templates import get_chat_template
tokenizer = get_chat_template(
    tokenizer,
    chat_template = "llama-3",
    mapping = {"role" : "from", "content" : "value", "user" : "human", "assistant" : "gpt"},
)

def formatting_prompts_func(examples):
    convos = examples["conversations"]
    texts = [tokenizer.apply_chat_template(convo, tokenize = False, add_generation_prompt = False) for convo in convos]
    return { "text" : texts, }

dataset = dataset.map(formatting_prompts_func, batched = True,)

print("🔥 Igniting SFT Trainer...")
trainer = SFTTrainer(
    model = model,
    tokenizer = tokenizer,
    train_dataset = dataset,
    dataset_text_field = "text",
    max_seq_length = max_seq_length,
    dataset_num_proc = 2,
    packing = True,
    args = SFTConfig(
        per_device_train_batch_size = 1,
        gradient_accumulation_steps = 8,
        warmup_steps = 5,
        max_steps = 20,
        learning_rate = 2e-4,
        fp16 = not torch.cuda.is_bf16_supported(),
        bf16 = torch.cuda.is_bf16_supported(),
        logging_steps = 1,
        optim = "adamw_8bit",
        weight_decay = 0.01,
        lr_scheduler_type = "linear",
        seed = 3407,
        output_dir = "outputs",
        save_strategy = "no",
    ),
)

print("⚡ BAKING LORA WEIGHTS...")
trainer_stats = trainer.train()

print("✅ Saving Sovereign Weights...")
model.save_pretrained("brita_sovereign_lora")
tokenizer.save_pretrained("brita_sovereign_lora")

import json
config_path = "brita_sovereign_lora/adapter_config.json"
try:
    with open(config_path, "r") as f:
        config = json.load(f)
    config["base_model_name_or_path"] = "failspy/Meta-Llama-3-70B-Instruct-abliterated-v3.5"
    with open(config_path, "w") as f:
        json.dump(config, f, indent=2)
    print("🔧 Patched adapter_config.json to reference failspy/Meta-Llama-3-70B-Instruct-abliterated-v3.5")
except Exception as e:
    print(f"⚠️ Failed to patch adapter_config.json: {e}")

print("🎉 Bake Complete. Ready for Z-Image Integration.")

