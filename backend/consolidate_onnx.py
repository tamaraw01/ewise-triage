"""Rapikan hasil ekspor ONNX menjadi satu berkas mandiri.

torch.onnx.export memecah bobot >2 GB ke ratusan berkas eksternal (batas protobuf).
Skrip ini menggabungkan model INT8 ke satu berkas, memverifikasi ia masih bisa
dimuat, lalu menghapus seluruh sisa berkas eksternal.

Aman dijalankan ulang: bila sudah rapi, ia berhenti tanpa mengubah apa pun.
"""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

ART = Path(__file__).parent / "artifacts"
INT8 = ART / "visual_encoder_int8.onnx"

# Berkas sah yang tidak boleh ikut terhapus.
DILINDUNGI = {
    "centroids.npy",
    "clusters.json",
    "meta.json",
    "preprocess.json",
    "text_emb.npy",
    "visual_encoder_int8.onnx",
}


def main() -> int:
    if not INT8.exists():
        print(f"GAGAL: {INT8.name} belum ada")
        return 1

    import onnx

    print(f"memuat {INT8.name} ({INT8.stat().st_size / 1e6:.0f} MB di indeks)")
    model = onnx.load(str(INT8), load_external_data=True)

    tmp = ART / "_gabung.onnx"
    onnx.save_model(model, str(tmp), save_as_external_data=False)
    ukuran = tmp.stat().st_size / 1e6
    print(f"digabung jadi satu berkas: {ukuran:.0f} MB")

    if ukuran > 2000:
        print("GAGAL: hasil gabungan >2 GB, tidak muat di kontainer 2 GB")
        tmp.unlink()
        return 1

    tmp.replace(INT8)

    # Verifikasi berkas tunggal benar-benar bisa dijalankan.
    import numpy as np
    import onnxruntime as ort

    sess = ort.InferenceSession(str(INT8), providers=["CPUExecutionProvider"])
    nama = sess.get_inputs()[0].name
    keluar = np.asarray(sess.run(None, {nama: np.zeros((1, 3, 224, 224), dtype=np.float32)})[0])
    print(f"verifikasi jalan: bentuk keluaran {keluar.shape}")

    dibuang = 0
    for p in ART.iterdir():
        if p.name in DILINDUNGI:
            continue
        if p.is_dir():
            shutil.rmtree(p)
        else:
            p.unlink()
        dibuang += 1
    print(f"berkas sisa ekspor dihapus: {dibuang}")

    sisa = sorted(p.name for p in ART.iterdir())
    total = sum(p.stat().st_size for p in ART.iterdir()) / 1e6
    print(f"isi artifacts ({total:.0f} MB): {sisa}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
