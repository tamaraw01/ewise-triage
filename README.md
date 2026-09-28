# E-WISE Triage

Konsol triase citra limbah elektronik. Petugas mengarahkan kamera ke satu barang
atau mengunggah satu foto, dan sistem mengembalikan klaster terdekat beserta
jalur penanganannya. Bila keyakinannya tipis, sistem menolak memberi label dan
menyerahkan keputusan ke manusia.

Semua angka pada antarmuka berasal dari artefak eksperimen EXP 14, bukan contoh
karangan.

## Cara kerja

```
kamera / berkas  ->  CLIP ViT-H/14  ->  normalisasi L2
                 ->  cosine similarity ke 14 centroid klaster
                 ->  margin top1 dikurangi top2
                 ->  margin >= 0.0297  ?  label + jalur  :  serahkan ke petugas
```

Pengelompokan tidak dijalankan ulang saat inference. Centroid dihitung sekali
dari hasil EXP 14, lalu citra baru hanya dibandingkan ke centroid itu, sehingga
satu putusan adalah satu perkalian matriks.

## Angka acuan

| Ukuran | Nilai |
|---|---|
| Citra acuan | 2.660 dari 3.961 |
| Klaster final | 14 (konsensus KMeans 9, Ward 9, GMM 14) |
| Akurasi label EXP 14 | 87,78% |
| Kesepakatan klaster leave-one-out | 95,94% |
| Akurasi label leave-one-out | 86,62% |
| Ambang margin | 0,0297 (persentil 5 leave-one-out) |

Ambang bukan angka pilihan bebas: ia adalah persentil 5 dari sebaran margin pada
validasi leave-one-out, sehingga sekitar 5% kasus tersulit diarahkan ke
pemeriksaan manusia.

Dua klaster tercatat terbantah dan tetap ditampilkan apa adanya: C11 diberi label
`Mobile` padahal 242 dari 243 citranya `Player`, dan C9 bermargin 0,0078 dengan
isi campuran. Keduanya menjelaskan mengapa ambang margin diperlukan.

## Menjalankan

### Backend

```bash
cd backend
python3 -m venv .venv
./.venv/bin/pip install torch==2.5.1 torchvision==0.20.1 \
  --index-url https://download.pytorch.org/whl/cpu
./.venv/bin/pip install -r requirements.txt
./.venv/bin/uvicorn app:app --host 0.0.0.0 --port 7860
```

Unduhan bobot CLIP sekitar 3,9 GB pada jalan pertama. Untuk mengunduh lebih
dulu, jalankan `./.venv/bin/python fetch_weights.py`.

Endpoint:

| Metode | Jalur | Keterangan |
|---|---|---|
| GET | `/health` | status muat model |
| GET | `/clusters` | 14 klaster beserta metriknya |
| POST | `/predict` | satu citra sebagai `multipart/form-data`, medan `file` |

### Frontend

```bash
cd web
npm install
echo 'NEXT_PUBLIC_API_BASE=http://localhost:7860' > .env.local
npm run dev
```

Tanpa `NEXT_PUBLIC_API_BASE`, panel triase tetap terbuka namun mengembalikan
pesan bahwa alamat backend belum disetel. Bagian peta dan tabel klaster bekerja
sepenuhnya tanpa backend karena artefaknya sudah menyatu di sisi klien.

Akses kamera memerlukan `localhost` atau HTTPS. Pada HTTP biasa peramban
memblokir `getUserMedia`, dan antarmuka menyampaikan itu secara terbuka lalu
menawarkan jalur unggah berkas.

## Docker

```bash
cd backend
docker build -t ewise-triage-api .
docker run -p 7860:7860 ewise-triage-api
```

## Batas penafsiran

Label adalah dugaan taksonomis dari kedekatan visual citra, bukan hasil
pemeriksaan isi fisik barang. Angka akurasi berlaku pada dataset acuan; citra
dari kondisi lapangan yang berbeda belum diuji. Jalur penanganan adalah pemetaan
dari label kelas, bukan rekomendasi kepatuhan regulasi.

## Sumber

Artefak berasal dari notebook EXP 14 (`cluster-14`) dan pembandingan skenario
(`cluster-15`), Big Data Challenge Satria Data 2026.
