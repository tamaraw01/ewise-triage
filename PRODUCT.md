# E-WISE

## Tujuan

E-WISE membantu petugas memilah foto limbah elektronik dan penguji riset
memeriksa hasil pengelompokan citra. Konsol triase dan Cluster Explorer tersedia
di halaman utama.

## Alur penggunaan

Petugas mengunggah satu citra atau mengambil foto dengan kamera. Konsol
menampilkan hasil inferensi dan jalur penanganan P1, P2, P3, atau MR.
Hasil dengan margin rendah memerlukan pemeriksaan petugas. Antarmuka juga
menandai C9 dan C11 untuk pemeriksaan manual karena masalah pada klaster acuan.

Cluster Explorer menampilkan sebaran citra, komposisi kelas, dan metrik klaster
untuk pemeriksaan hasil riset.

## Antarmuka

Antarmuka berbahasa Indonesia. Latar charcoal menjaga foto sebagai fokus;
hijau sirkuit menandai aksi dan pilihan, putih tulang digunakan untuk teks,
dan amber untuk peringatan. Panel input dan hasil mempertahankan alur kerja.
IBM Plex digunakan untuk keterbacaan label dan angka. Gerakan dibatasi dan
mengikuti preferensi reduced motion pengguna.

## Data dan batas penggunaan

Metrik dan visualisasi berasal dari `web/data/meta.json`,
`web/data/clusters.json`, dan `web/data/scatter.json`. Backend menggunakan
centroid serta metadata di `backend/artifacts/` untuk inferensi.

Label menunjukkan kedekatan visual, bukan hasil pemeriksaan fisik barang.
Jalur penanganan bukan rekomendasi kepatuhan regulasi. Validasi pada dataset
acuan tidak membuktikan akurasi pada kondisi lapangan atau dampak lingkungan.
