"""Konversi menara visual CLIP ViT-H/14 ke ONNX, lalu kuantisasi INT8.

Hasil: artifacts/visual_encoder.onnx (~2,5 GB fp32)
       artifacts/visual_encoder_int8.onnx (~630 MB)

Preprocessing disimpan sebagai JSON (mean, std, size) agar runtime
tidak perlu torchvision.
"""
from __future__ import annotations

import json
import resource
import time
from pathlib import Path

import numpy as np
import torch

ART = Path(__file__).parent / "artifacts"
MODEL_NAME = "ViT-H-14"

def puncak():
    return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024 / 1024

def catat(msg):
    print(f"[{time.strftime('%H:%M:%S')}] puncak={puncak():.2f}GB  {msg}", flush=True)

def main():
    catat("mulai")

    # Muat model per-tensor (hemat memori)
    import open_clip
    from safetensors.torch import safe_open

    torch.set_num_threads(2)
    model, _, preprocess = open_clip.create_model_and_transforms(
        MODEL_NAME, pretrained=None, device="cpu", precision="fp32"
    )

    # Lepas menara teks
    for attr in ("transformer", "token_embedding", "ln_final",
                 "positional_embedding", "text_projection"):
        if hasattr(model, attr):
            setattr(model, attr, None)
    catat("arsitektur dibangun (tanpa menara teks)")

    hub = Path.home() / ".cache/huggingface/hub"
    st_file = sorted((hub / "models--laion--CLIP-ViT-H-14-laion2B-s32B-b79K").rglob("*.safetensors"))[0]
    catat(f"safetensors: {st_file}")

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
    catat(f"bobot dipasang={dipasang}")
    model.eval()

    # Simpan info preprocessing
    # CLIP ViT-H/14: input 224x224, normalize mean=[0.48145466,0.4578275,0.40821073], std=[0.26862954,0.26130258,0.27577711]
    prep_info = {
        "size": 224,
        "mean": [0.48145466, 0.4578275, 0.40821073],
        "std": [0.26862954, 0.26130258, 0.27577711],
        "interpolation": "bicubic",
    }
    (ART / "preprocess.json").write_text(json.dumps(prep_info))
    catat("preprocess.json disimpan")

    # Export ONNX
    dummy = torch.randn(1, 3, 224, 224)
    onnx_fp32 = ART / "visual_encoder.onnx"

    catat("mulai export ONNX...")
    torch.onnx.export(
        model.visual,
        dummy,
        str(onnx_fp32),
        input_names=["pixel_values"],
        output_names=["image_features"],
        dynamic_axes={"pixel_values": {0: "batch"}, "image_features": {0: "batch"}},
        opset_version=17,
        do_constant_folding=True,
    )
    sz = onnx_fp32.stat().st_size / 1024 / 1024
    catat(f"ONNX fp32 disimpan: {sz:.0f} MB")

    # Kuantisasi INT8 dinamis
    from onnxruntime.quantization import quantize_dynamic, QuantType

    onnx_int8 = ART / "visual_encoder_int8.onnx"
    catat("mulai kuantisasi INT8...")
    quantize_dynamic(
        str(onnx_fp32),
        str(onnx_int8),
        weight_type=QuantType.QInt8,
    )
    sz8 = onnx_int8.stat().st_size / 1024 / 1024
    catat(f"ONNX INT8 disimpan: {sz8:.0f} MB")

    # Verifikasi: bandingkan output fp32 vs INT8
    import onnxruntime as ort

    sess_fp32 = ort.InferenceSession(str(onnx_fp32))
    sess_int8 = ort.InferenceSession(str(onnx_int8))

    inp = {"pixel_values": dummy.numpy()}
    out_fp32 = sess_fp32.run(None, inp)[0]
    out_int8 = sess_int8.run(None, inp)[0]

    # Normalisasi L2
    out_fp32 = out_fp32 / np.linalg.norm(out_fp32, axis=-1, keepdims=True)
    out_int8 = out_int8 / np.linalg.norm(out_int8, axis=-1, keepdims=True)

    cos_sim = float(np.sum(out_fp32 * out_int8))
    catat(f"cosine similarity fp32 vs INT8: {cos_sim:.6f}")

    # Hapus fp32 (terlalu besar untuk deploy)
    onnx_fp32.unlink()
    catat(f"fp32 dihapus, sisa hanya INT8 ({sz8:.0f} MB)")

    print("SELESAI")

if __name__ == "__main__":
    main()
