"""Uji paritas jalur ONNX INT8 terhadap jalur torch fp32.

Menjalankan kedua mesin pada citra yang sama, lalu membandingkan:
  - cosine similarity vektor embedding
  - kesamaan putusan (status, cluster id, runner_up)
  - selisih margin

Kuantisasi INT8 mengubah angka sedikit; yang wajib sama adalah PUTUSANNYA.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))

import engine as e_torch
import engine_onnx as e_onnx


def main(paths: list[str]) -> int:
    if not e_onnx.tersedia():
        print("GAGAL: visual_encoder_int8.onnx belum ada")
        return 1

    gagal = 0
    for p in paths:
        data = Path(p).read_bytes()

        v_onnx = e_onnx.embed(data)
        v_torch = e_torch.embed(data)
        cos = float(np.dot(v_onnx, v_torch))

        r_onnx = e_onnx.classify(data)
        r_torch = e_torch.classify(data)

        sama_status = r_onnx["status"] == r_torch["status"]
        sama_cluster = r_onnx["cluster"]["id"] == r_torch["cluster"]["id"]
        sama_runner = r_onnx["runner_up"]["id"] == r_torch["runner_up"]["id"]
        d_margin = abs(r_onnx["margin"] - r_torch["margin"])

        ok = sama_status and sama_cluster and cos > 0.99
        if not ok:
            gagal += 1

        print(f"--- {Path(p).name} ---")
        print(f"  cosine(onnx, torch) : {cos:.6f}")
        print(f"  status              : {r_torch['status']} -> {r_onnx['status']}  {'OK' if sama_status else 'BEDA'}")
        print(f"  cluster id          : {r_torch['cluster']['id']} -> {r_onnx['cluster']['id']}  {'OK' if sama_cluster else 'BEDA'}")
        print(f"  runner_up id        : {r_torch['runner_up']['id']} -> {r_onnx['runner_up']['id']}  {'OK' if sama_runner else 'BEDA'}")
        print(f"  margin              : {r_torch['margin']:.4f} -> {r_onnx['margin']:.4f}  (selisih {d_margin:.4f})")
        print(f"  VERDIKT             : {'LULUS' if ok else 'GAGAL'}")

    print()
    print(f"RINGKASAN: {len(paths) - gagal}/{len(paths)} lulus")
    return 1 if gagal else 0


if __name__ == "__main__":
    berkas = sys.argv[1:] or ["/tmp/ewise_e2e/flat.png", "/tmp/ewise_e2e/noise.png"]
    raise SystemExit(main(berkas))
