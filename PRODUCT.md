# E-WISE

## Tujuan

E-WISE membantu petugas mengenali kategori perangkat dari foto limbah elektronik
sebelum pemeriksaan fisik. Hasil foto merupakan dugaan berdasarkan kedekatan
visual, bukan keputusan pembongkaran, identifikasi kimia, atau sertifikasi keamanan.

## Alur penggunaan

Petugas mengunggah satu citra atau mengambil foto dengan kamera. Konsol
menampilkan kategori perangkat dan bukti kecocokan, disertai jenis penanganan
P1, P2, P3, atau peninjauan manual (MR). P1/P2/P3 membedakan jenis penanganan,
bukan tingkat urgensi, urutan proses, atau peringkat bahaya.

Petugas terlatih menentukan tindakan setelah memeriksa jenis, kondisi, dan
komponen barang secara fisik serta mengikuti SOP fasilitas. Hasil bermargin
rendah memerlukan pemeriksaan manual. C9 tetap manual karena isi klaster
campuran; C11 tetap manual karena nama Mobile bertentangan dengan kelas acuan
dominan Player. Margin tinggi tidak meniadakan dua alasan tersebut.

## Ruang kerja

Halaman utama menyediakan empat tab: Konsol, Cluster Explorer, Statistik,
dan Proses. `/dashboard` mengalihkan ke `/`.

- Konsol menerima foto dan menampilkan hasil inferensi per citra.
- Cluster Explorer menyediakan peta, pencarian/filter, distribusi ukuran,
  dan perbandingan klaster acuan.
- Statistik menyajikan audit dataset serta metrik eksperimen tersimpan.
- Proses menjelaskan tahapan eksperimen dan batas bukti tiap tahap.

Antarmuka berbahasa Indonesia. Latar charcoal membingkai foto dan peta; sage
menandai pilihan, putih tulang membedakan area kerja, dan amber menandai
peringatan. IBM Plex membedakan label dari angka. Gerakan mengikuti preferensi
reduced motion. Peta mempertahankan tampilan WebGL yang ada, termasuk perspektif
dan pengangkatan pilihan sebagai efek tampilan, bukan dimensi data ketiga.

## Data dan batas penggunaan

`web/data/analysis-flow.json` memuat seluruh 2.660 koordinat 2D dan partisi
tersimpan untuk peta serta Proses. `web/data/analytics.json` menyimpan audit dan
metrik Statistik. `web/data/meta.json` dan `web/data/clusters.json` memuat metadata
inferensi dan ringkasan klaster; `web/lib/data.ts` memuat salinan label tampilan
serta panduan operasional lokal. `web/data/scatter.json` adalah sampel lama,
bukan sumber peta penuh saat ini. Backend memakai artefak di `backend/artifacts/`.

Similaritas mentah dan margin bukan probabilitas benar. Margin foto adalah
selisih kecocokan dua centroid teratas; margin penamaan adalah selisih dua
kandidat nama klaster berbasis teks. Ambang keduanya tidak dapat dipertukarkan.
Purity mengukur proporsi kelas acuan dominan dalam klaster, bukan akurasi nama
atau kepastian hasil foto. Akurasi label, stabilitas bootstrap, dan kesepakatan
leave-one-out memiliki objek pengukuran berbeda.

Potensi material merupakan referensi kategori perangkat, bukan komposisi yang
terdeteksi. Subtipe pada paper adalah interpretasi kualitatif, bukan label
terverifikasi untuk setiap citra. Foto tidak menentukan kimia baterai. Pemulihan
timbal hanya berlaku setelah aki timbal-asam dikonfirmasi secara fisik.

Evaluasi memakai label acuan dari prefix nama berkas. Hasil pada dataset acuan
tidak membuktikan akurasi lapangan, dampak lingkungan, atau kepatuhan regulasi.
Rincian sumber, pemeriksaan lokal, dan batas provenance ada di
[docs/provenance.md](docs/provenance.md).
