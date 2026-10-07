"""Mesin inference E-WISE.

Rantai: citra -> CLIP ViT-H/14 -> L2 -> cosine ke 14 centroid klaster (EXP 14)
-> klaster terdekat -> label zero-shot klaster + margin top1-top2.
Margin di bawah ambang empiris -> status 'review', tanpa label.
"""
from __future__ import annotations

import io
import json
import logging
import os
import threading
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageFile

ImageFile.LOAD_TRUNCATED_IMAGES = True
log = logging.getLogger("ewise")

ART = Path(__file__).parent / "artifacts"
MODEL_NAME = "ViT-H-14"
PRETRAIN = "laion2b_s32b_b79k"

_lock = threading.Lock()
_state: dict = {}


def _load_artifacts() -> dict:
    centroids = np.load(ART / "centroids.npy").astype(np.float32)
    clusters = json.loads((ART / "clusters.json").read_text())
    meta = json.loads((ART / "meta.json").read_text())
    norms = np.linalg.norm(centroids, axis=1, keepdims=True)
    centroids = centroids / np.clip(norms, 1e-12, None)

    text_emb_path = ART / "text_emb.npy"
    text_emb = np.load(text_emb_path).astype(np.float32) if text_emb_path.exists() else None

    return {
        "centroids": centroids,
        "clusters": {c["id"]: c for c in clusters},
        "cluster_list": clusters,
        "meta": meta,
        "threshold": float(meta["review_margin_threshold"]),
        "classes": list(meta["classes"]),
        "text_emb": text_emb,
    }


def _muat_hemat(device: str) -> tuple[torch.nn.Module, object]:
    """Muat bobot dari safetensors per tensor, tanpa menggandakan alokasi."""
    import open_clip
    from safetensors.torch import safe_open

    # Satu core disisakan untuk uvicorn dan OS; memakai semua core justru
    # membuat thread berebut dan permintaan pertama makin lambat.
    torch.set_num_threads(max(1, (os.cpu_count() or 4) - 1))

    # Bangun arsitektur kosong (tanpa bobot), hanya menara visual.
    model, _, preprocess = open_clip.create_model_and_transforms(
        MODEL_NAME, pretrained=None, device="cpu", precision="fp32"
    )

    # Hapus menara teks: embedding teks sudah pra-hitung di text_emb.npy.
    for attr in ("transformer", "token_embedding", "ln_final",
                 "positional_embedding", "text_projection"):
        if hasattr(model, attr):
            setattr(model, attr, None)
    log.info("Menara teks dilepas")

    # Cari safetensors atau .bin di cache HF Hub atau direktori lokal.
    hub = Path.home() / ".cache/huggingface/hub"
    patterns = [hub / "models--laion--CLIP-ViT-H-14-laion2B-s32B-b79K"]
    st_file = None
    for base in patterns:
        hits = sorted(base.rglob("*.safetensors"))
        if hits:
            st_file = hits[0]
            break

    if st_file is None:
        # Fallback: unduh via open_clip (HF Space punya cukup RAM).
        log.info("Safetensors lokal tidak ditemukan, muat via open_clip pretrained")
        model2, _, preprocess = open_clip.create_model_and_transforms(
            MODEL_NAME, pretrained=PRETRAIN, device=device
        )
        model2.eval()
        return model2, preprocess

    dipasang = 0
    with safe_open(str(st_file), framework="pt", device="cpu") as f:
        sd_keys = set(f.keys())
        for nama, param in list(model.named_parameters()) + list(model.named_buffers()):
            if nama not in sd_keys:
                continue
            t = f.get_tensor(nama)
            if t.shape != param.shape:
                continue
            with torch.no_grad():
                param.data = t.to(torch.float32)
            dipasang += 1
            del t
    log.info("Bobot dipasang: %d tensor", dipasang)

    model = model.to(device)
    model.eval()
    return model, preprocess


def get_state() -> dict:
    """Muat model sekali, aman dipanggil dari beberapa permintaan sekaligus."""
    with _lock:
        if _state:
            return _state

        art = _load_artifacts()
        device = "cuda" if torch.cuda.is_available() else "cpu"
        log.info("Memuat model ke %s", device)

        model, preprocess = _muat_hemat(device)

        # Jika text_emb belum pra-hitung, hitung sekarang.
        if art["text_emb"] is None:
            import open_clip

            tokenizer = open_clip.get_tokenizer(MODEL_NAME)
            templates = [
                "a photo of a {}",
                "a photo of a discarded {}",
                "a close-up photo of a {}",
                "an image of electronic waste: {}",
            ]
            vektor = []
            with torch.no_grad():
                for c in art["classes"]:
                    teks = [t.format(c.lower()) for t in templates]
                    emb = model.encode_text(tokenizer(teks).to(device))
                    emb = emb / emb.norm(dim=-1, keepdim=True)
                    rerata = emb.mean(dim=0)
                    vektor.append((rerata / rerata.norm()).cpu().float().numpy())
            art["text_emb"] = np.stack(vektor).astype(np.float32)
            np.save(ART / "text_emb.npy", art["text_emb"])
            log.info("text_emb.npy dihitung dan disimpan")

        art["model"] = model
        art["preprocess"] = preprocess
        art["device"] = device
        _state.update(art)
        return _state


def embed(image_bytes: bytes) -> np.ndarray:
    """Citra -> vektor CLIP ternormalisasi L2 (1024 dimensi)."""
    st = get_state()
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    tensor = st["preprocess"](img).unsqueeze(0).to(st["device"])
    with torch.no_grad():
        v = st["model"].encode_image(tensor)
    v = v.cpu().float().numpy()[0]
    return (v / max(float(np.linalg.norm(v)), 1e-12)).astype(np.float32)


def classify(image_bytes: bytes) -> dict:
    """Putusan triase untuk satu citra, beserta bukti angkanya."""
    st = get_state()
    v = embed(image_bytes)

    scores = st["centroids"] @ v
    order = np.argsort(-scores)
    top1, top2 = int(order[0]), int(order[1])
    margin = float(scores[top1] - scores[top2])
    accepted = margin >= st["threshold"]

    c1 = st["clusters"][top1]
    c2 = st["clusters"][top2]

    zs = st["text_emb"] @ v
    zs_order = np.argsort(-zs)
    zero_shot = [
        {"label": st["classes"][int(i)], "similarity": round(float(zs[int(i)]), 4)}
        for i in zs_order[:4]
    ]

    ranking = [
        {
            "cluster": int(i),
            "label": st["clusters"][int(i)]["label"],
            "similarity": round(float(scores[int(i)]), 4),
        }
        for i in order[:5]
    ]

    return {
        "status": "classified" if accepted else "review",
        "margin": round(margin, 4),
        "threshold": round(st["threshold"], 4),
        "top_similarity": round(float(scores[top1]), 4),
        "cluster": {
            "id": top1,
            "label": c1["label"] if accepted else None,
            "route": c1["route"] if accepted else "MANUAL_REVIEW",
            "handling": c1["handling"] if accepted else "Margin keyakinan di bawah ambang, perlu pemeriksaan petugas",
            "n_images": c1["n_images"],
            "purity": c1["purity"],
            "contested": c1["purity"] < 0.5,
        },
        "runner_up": {"id": top2, "label": c2["label"]},
        "ranking": ranking,
        "zero_shot": zero_shot,
        "disclaimer": "Label adalah dugaan taksonomis dari kedekatan visual, bukan pemeriksaan isi fisik barang.",
    }
