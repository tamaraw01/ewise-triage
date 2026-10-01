---
title: E-WISE Triage API
emoji: "🔌"
colorFrom: gray
colorTo: yellow
sdk: docker
app_port: 7860
pinned: false
---

# E-WISE Triage API

Backend inference untuk konsol triase limbah elektronik.

Rantai: citra -> CLIP ViT-H/14 (`laion2b_s32b_b79k`) -> normalisasi L2 ->
cosine similarity ke 14 centroid klaster hasil EXP 14 -> label zero-shot klaster
+ margin top1-top2. Margin di bawah 0,0297 dikembalikan sebagai `review`
tanpa label, bukan sebagai tebakan.

## Endpoint

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
