"""Uji E2E mesin inference dengan citra dataset nyata.

Memeriksa: model termuat, klasifikasi berjalan, dan label yang diputuskan
cocok dengan kelas asli citra (dibaca dari prefix nama berkas).
"""
import glob
import os
import random
import sys

import engine

st = engine.get_state()
print("DEVICE:", st["device"], "| AMBANG:", st["threshold"])
print("CENTROID:", st["centroids"].shape)
print("KELAS:", len(st["classes"]))

pat = "/tmp/ewtest/modified-dataset/test/*/*"
files = [p for p in glob.glob(pat) if p.lower().endswith((".jpg", ".jpeg", ".png", ".webp", ".bmp"))]
print("CITRA DITEMUKAN:", len(files))

if not files:
    print("TIDAK ADA CITRA UJI: dataset lokal tidak tersedia")
    sys.exit(2)

random.seed(11)
sample = random.sample(files, min(40, len(files)))

benar = 0
diuji = 0
review = 0
for p in sample:
    base = os.path.basename(p)
    try:
        with open(p, "rb") as f:
            out = engine.classify(f.read())
    except Exception as exc:
        print(f"GAGAL {base[:40]}: {type(exc).__name__}: {str(exc)[:90]}")
        continue

    diuji += 1
    asli = os.path.basename(os.path.dirname(p))
    label = out["cluster"]["label"]
    if out["status"] == "review":
        review += 1
    cocok = bool(label) and asli.lower().replace(" ", "") in label.lower().replace(" ", "")
    if cocok:
        benar += 1
    print(
        f"{base[:34]:36s} asli={asli:16s} -> C{out['cluster']['id']:<2} "
        f"{str(label):16s} m={out['margin']:.4f} {out['status']:10s} {'OK' if cocok else '-'}"
    )

print("-" * 70)
print(f"DIUJI={diuji} COCOK={benar} REVIEW={review}")
if diuji:
    print(f"AKURASI SAMPEL={benar / diuji * 100:.1f}%")
