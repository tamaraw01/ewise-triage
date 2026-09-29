"""Kuantisasi INT8 dari hasil ekspor ONNX fp32 yang sudah ada.

Dipisah dari export_onnx.py agar tahap ekspor (berat, ~6 menit) tidak perlu
diulang bila kuantisasi terputus. Membaca artifacts/visual_encoder.onnx beserta
bobot eksternalnya, menulis artifacts/visual_encoder_int8.onnx.
"""
from __future__ import annotations

import resource
import time
from pathlib import Path

ART = Path(__file__).parent / "artifacts"
FP32 = ART / "visual_encoder.onnx"
INT8 = ART / "visual_encoder_int8.onnx"


def catat(msg: str) -> None:
    puncak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024 / 1024
    print(f"[{time.strftime('%H:%M:%S')}] puncak={puncak:.2f}GB  {msg}", flush=True)


def main() -> int:
    if not FP32.exists():
        print(f"GAGAL: {FP32.name} tidak ada, jalankan export_onnx.py dulu")
        return 1

    from onnxruntime.quantization import QuantType, quantize_dynamic

    catat("mulai kuantisasi INT8 (bobot eksternal dibaca dari artifacts/)")
    quantize_dynamic(
        str(FP32),
        str(INT8),
        weight_type=QuantType.QInt8,
    )
    catat(f"INT8 ditulis: {INT8.stat().st_size / 1e6:.0f} MB (indeks)")
    print("SELESAI")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
