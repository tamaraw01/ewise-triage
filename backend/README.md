---
title: E-WISE API
emoji: "🔌"
colorFrom: gray
colorTo: yellow
sdk: docker
app_port: 7860
pinned: false
---

# E-WISE API

Backend inference untuk konsol triase limbah elektronik.

Rantai: citra -> CLIP ViT-H/14 (`laion2b_s32b_b79k`) -> normalisasi L2 ->
cosine similarity ke 14 centroid klaster hasil EXP 14 -> label zero-shot klaster
+ margin top1-top2. Margin di bawah 0,0297 dikembalikan sebagai `review`
tanpa label, bukan sebagai tebakan.

## Menjalankan backend

Ikuti [panduan lokal dan Docker](../README.md#menjalankan-lokal) dari akar
repositori. `app.py` menyediakan FastAPI dengan jalur PyTorch atau ONNX,
bergantung pada ketersediaan bobot ONNX. Bobot model tidak disertakan dalam Git.

`app_gradio.py` adalah entry point Gradio terpisah. Proxy frontend menggunakan
protokol antrean Gradio, bukan endpoint multipart FastAPI di bawah. Metadata
Space pada dokumen ini memilih Docker; `Dockerfile` menjalankan `app.py`.
Konfigurasi deployment harus sesuai dengan protokol yang digunakan frontend.

## Endpoint FastAPI

| Metode | Jalur | Keterangan |
|---|---|---|
| GET | `/health` | status muat model |
| GET | `/clusters` | 14 klaster + metrik EXP 14 |
| POST | `/predict` | unggah satu citra (form field `file`) |

## Asal angka

Centroid dihitung dari 2.660 embedding CLIP citra dataset 2026
(`1_Electronic`, disaring 10 kelas berdasar prefix nama berkas).
Ambang margin 0,0297 adalah persentil 5 margin leave-one-out pada 2.660 citra
tersebut. Validasi leave-one-out: kesepakatan klaster 95,94%, akurasi label 86,62%.

Label adalah dugaan taksonomis dari kedekatan visual, bukan pemeriksaan isi fisik barang.


## Patch Gradio input guard (Space existing)

Space `Aditams/ewise-backend` memakai Gradio **6.29.0**, Python **3.12**,
`app_file: app.py` (metadata publik diperiksa 2026-10-12). Repo GitHub ini
bukan sumber auto-sync Space; perubahan lokal belum mengubah backend live.

Untuk rilis patch ini, tinjau dan sinkronkan **hanya**:
- `app_gradio.py` sebagai `app.py` di repo Space.
- `image_input.py` (wajib tersedia untuk kedua engine).
- `requirements_gradio.txt` sebagai `requirements.txt`, sambil mempertahankan
  dependensi/model tambahan yang masih dipakai Space.
- Frontmatter README Space: pertahankan `sdk_version: 6.29.0`,
  `python_version: "3.12"`, `app_file: app.py`.

Gunakan kredensial HF write yang baru/valid dan disetujui; jangan gunakan token
legacy yang terekspos atau skrip uploader lokal berisi rahasia. Commit/push
repo Space memicu rebuild HF. Jangan salin seluruh folder backend/log/.venv
atau rahasia. Verifikasi ulang `/gradio_api/call/predict` dan SSE setelah
rebuild. Dokumen ini bukan bukti patch telah dideploy.

Verifikasi lokal tanpa bobot model:
```bash
python backend/test_image_input.py
python backend/test_gradio_contract.py
# Python 3.12, gradio==6.29.0, fastapi==0.143.0, pillow==11.1.0:
python backend/test_gradio_runtime.py
```
Tes runtime menjalankan Gradio nyata dengan engine **palsu**, bukan inferensi
model. Memeriksa data URL/FileData yang dipakai frontend, upload path, batas
12 MiB sebelum PIL.open, dan PNG 6000x5000 sebelum load/convert/engine.
Guard ini tidak membatasi seluruh body HTTP/antrean/cache Gradio. Batas 3 MB
frontend/proxy tetap lebih kecil; jangan menganggap backend telah diaudit penuh.
