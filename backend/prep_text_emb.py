"""Muat CLIP ViT-H/14 tanpa menggandakan bobot di memori, lalu simpan embedding teks.

`open_clip.create_model_and_transforms(pretrained=...)` mengalokasi model dan
salinan state dict sekaligus: 3,94 GB dua kali, lebih besar dari RAM mesin ini.
Di sini tiap tensor dipindahkan satu per satu dengan `assign`, sehingga puncak
pemakaian tinggal satu salinan.

Embedding teks 10 kelas dihitung sekali di sini dan disimpan ke artifacts, agar
runtime tidak perlu memuat menara teks sama sekali.
"""
from __future__ import annotations

import json
import resource
import time
from pathlib import Path

import numpy as np
import torch
from safetensors.torch import safe_open

SNAP = Path(
    "/home/aditama/.cache/huggingface/hub/"
    "models--laion--CLIP-ViT-H-14-laion2B-s32B-b79K/snapshots"
)
ART = Path(__file__).parent / "artifacts"
MODEL_NAME = "ViT-H-14"


def puncak_gb() -> float:
    return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024 / 1024


def catat(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] puncak={puncak_gb():.2f}GB  {msg}", flush=True)


def cari_safetensors() -> Path:
    hits = sorted(SNAP.rglob("*.safetensors"))
    if not hits:
        raise FileNotFoundError(f"safetensors tidak ada di {SNAP}")
    return hits[0]


def muat_hemat(only_visual: bool = False) -> tuple[torch.nn.Module, object]:
    """Bangun arsitektur kosong, lalu pindahkan bobot per tensor."""
    import open_clip

    torch.set_num_threads(2)
    model, _, preprocess = open_clip.create_model_and_transforms(
        MODEL_NAME, pretrained=None, device="cpu", precision="fp32"
    )
    catat("arsitektur dibangun")

    if only_visual:
        # Menara teks tidak dipakai saat inference: embedding teks sudah dihitung.
        for nama in ("transformer", "token_embedding", "ln_final"):
            if hasattr(model, nama):
                setattr(model, nama, None)
        for nama in ("positional_embedding", "text_projection"):
            if hasattr(model, nama):
                setattr(model, nama, None)
        catat("menara teks dilepas")

    path = cari_safetensors()
    dipasang = 0
    dilewati = 0
    with safe_open(str(path), framework="pt", device="cpu") as f:
        sd_keys = set(f.keys())
        for nama, param in list(model.named_parameters()) + list(model.named_buffers()):
            if nama not in sd_keys:
                dilewati += 1
                continue
            t = f.get_tensor(nama)
            if t.shape != param.shape:
                dilewati += 1
                continue
            with torch.no_grad():
                param.data = t.to(torch.float32)
            dipasang += 1
            del t
    catat(f"bobot dipasang={dipasang} dilewati={dilewati}")
    model.eval()
    return model, preprocess


def main() -> None:
    catat("mulai")
    meta = json.loads((ART / "meta.json").read_text())
    classes = list(meta["classes"])

    model, _ = muat_hemat(only_visual=False)

    import open_clip

    tokenizer = open_clip.get_tokenizer(MODEL_NAME)
    # Prompt ensembling: rerata beberapa kalimat per kelas, seperti pada EXP 14.
    templates = [
        "a photo of a {}",
        "a photo of a discarded {}",
        "a close-up photo of a {}",
        "an image of electronic waste: {}",
    ]
    vektor = []
    with torch.no_grad():
        for c in classes:
            teks = [t.format(c.lower()) for t in templates]
            emb = model.encode_text(tokenizer(teks))
            emb = emb / emb.norm(dim=-1, keepdim=True)
            rerata = emb.mean(dim=0)
            vektor.append((rerata / rerata.norm()).float().numpy())
    arr = np.stack(vektor).astype(np.float32)
    np.save(ART / "text_emb.npy", arr)
    catat(f"text_emb.npy disimpan bentuk={arr.shape}")

    # Bukti bahwa menara visual benar-benar bekerja pada citra nyata.
    import glob

    from PIL import Image

    _, preprocess = None, None
    import open_clip as oc

    _, _, preprocess = oc.create_model_and_transforms(
        MODEL_NAME, pretrained=None, device="cpu"
    )
    sampel = sorted(glob.glob("/tmp/ewtest/modified-dataset/test/*/*.jpg"))[:1]
    if sampel:
        img = Image.open(sampel[0]).convert("RGB")
        with torch.no_grad():
            v = model.encode_image(preprocess(img).unsqueeze(0))
        v = v / v.norm(dim=-1, keepdim=True)
        sim = arr @ v[0].float().numpy()
        atas = int(np.argmax(sim))
        catat(f"uji embed: {sampel[0].split('/')[-2]} -> {classes[atas]} sim={sim[atas]:.4f}")
    print("SELESAI")


if __name__ == "__main__":
    main()
