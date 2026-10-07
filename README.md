# E-WISE

**E-Waste Intelligent Sorting & Exploration.** Konsol triase citra limbah elektronik.
Petugas memotret atau mengunggah satu foto barang, lalu sistem mengembalikan klaster
terdekat, jalur penanganan, dan margin keyakinan. Jika margin di bawah ambang,
label otomatis ditahan dan keputusan diserahkan ke petugas.

Semua angka pada antarmuka berasal dari artefak eksperimen konsensus (`cluster-14`),
bukan contoh karangan.

Demo: <https://ewise-nine.vercel.app>

## Cara kerja

```
kamera / berkas  ->  CLIP ViT-H/14  ->  normalisasi L2
                 ->  cosine similarity ke 14 centroid klaster
                 ->  margin top1 dikurangi top2
                 ->  margin >= 0,0297  ?  label + jalur  :  serahkan ke petugas
```

Pengelompokan tidak dijalankan ulang saat inferensi. Centroid dihitung sekali dari
hasil konsensus K-Means, Ward, dan GMM, lalu citra baru hanya dibandingkan ke
centroid itu, sehingga satu putusan adalah satu perkalian matriks.

## Angka acuan

| Ukuran | Nilai |
|---|---|
| Citra acuan | 2.660 dari 3.961 |
| Klaster final | 14 (konsensus K-Means 9, Ward 9, GMM 14) |
| Akurasi label | 87,78% |
| Purity | 96,9% |
| Stabilitas bootstrap (ARI) | 0,942 |
| Kesepakatan klaster leave-one-out | 95,94% |
| Akurasi label leave-one-out | 86,62% |
| Ambang margin | 0,0297 (persentil 5 leave-one-out) |

Ambang ini bukan angka absolut: nilainya persentil 5 dari sebaran margin pada
validasi leave-one-out, sehingga sekitar 5% kasus tersulit diarahkan ke petugas.

Dua klaster tercatat bermasalah dan tetap ditampilkan apa adanya: C11 diberi label
`Mobile` padahal 242 dari 243 citranya `Player`, dan C9 bermargin 0,0078 dengan isi
campuran. Keduanya alasan mekanisme ambang margin diperlukan.

## Struktur

| Folder | Isi |
|---|---|
| `web/` | Frontend Next.js (Vercel). `/api/predict` meneruskan citra ke backend di sisi server. |
| `backend/` | Inferensi CLIP. `app_gradio.py` untuk Hugging Face Spaces, `app.py` untuk FastAPI lokal/Docker. |

## Menjalankan lokal

### Backend

```bash
cd backend
python3 -m venv .venv
./.venv/bin/pip install torch==2.5.1 torchvision==0.20.1 \
  --index-url https://download.pytorch.org/whl/cpu
./.venv/bin/pip install -r requirements.txt
./.venv/bin/uvicorn app:app --host 0.0.0.0 --port 7860
```

Unduhan bobot CLIP sekitar 3,9 GB pada jalan pertama. Untuk mengunduh lebih dulu,
jalankan `./.venv/bin/python fetch_weights.py`.

| Metode | Jalur | Keterangan |
|---|---|---|
| GET | `/health` | status muat model |
| GET | `/clusters` | 14 klaster beserta metriknya |
| POST | `/predict` | satu citra sebagai `multipart/form-data`, medan `file` |

### Frontend

```bash
cd web
npm install
npm run dev
```

Variabel lingkungan server (opsional): `HF_TOKEN` untuk memanggil Space dengan kuota
terautentikasi. Akses kamera memerlukan `localhost` atau HTTPS.

### Docker

```bash
cd backend
docker build -t ewise-api .
docker run -p 7860:7860 ewise-api
```

## Batas penafsiran

Label adalah dugaan taksonomis dari kedekatan visual, bukan hasil pemeriksaan isi
fisik barang. Angka akurasi berlaku pada dataset acuan; citra dari kondisi lapangan
yang berbeda belum diuji. Jalur penanganan adalah pemetaan dari label kelas, bukan
rekomendasi kepatuhan regulasi.

## Sumber

Artefak diekstraksi dari pipeline klasterisasi konsensus (`cluster-14`) dan
pembandingan metode tunggal (`cluster-15`).
