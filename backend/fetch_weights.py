"""Unduh bobot CLIP ViT-H/14 sampai tuntas, tahan terhadap sesi yang berakhir."""
import sys
import time

from huggingface_hub import hf_hub_download

REPO = "laion/CLIP-ViT-H-14-laion2B-s32B-b79K"
FILE = "open_clip_pytorch_model.bin"

for attempt in range(1, 41):
    try:
        print(f"[percobaan {attempt}] mulai", flush=True)
        p = hf_hub_download(repo_id=REPO, filename=FILE)
        print("SELESAI:", p, flush=True)
        sys.exit(0)
    except Exception as exc:
        print(f"[percobaan {attempt}] gagal: {type(exc).__name__}: {str(exc)[:200]}", flush=True)
        time.sleep(10)

print("GAGAL TOTAL setelah 40 percobaan", flush=True)
sys.exit(1)
