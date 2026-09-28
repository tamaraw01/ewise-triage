# DESIGN.md — E-WISE Triage

Arahan desain untuk konsol triase limbah elektronik berbasis klaster CLIP.
Dokumen ini adalah sumber arah (soul). `antislop.md` adalah filter di atasnya.

## Identitas

**Produk:** E-WISE Triage, konsol pemilahan citra limbah elektronik.
**Pengguna:** petugas pemilah di fasilitas pengumpulan, dan penguji akademik yang memeriksa metodologi.
**Konteks pakai:** berdiri di dekat tumpukan barang, satu tangan memegang ponsel, cahaya tidak menentu, butuh jawaban cepat yang bisa dipercaya atau ditolak dengan jujur.

**Bahasa visual:** panel instrumen industri. Bukan panel yang bergaya industri, tapi panel yang berfungsi seperti alat ukur: angka dibaca sekali lihat, status tidak ambigu, ketidakpastian ditampilkan bukan disembunyikan.

## Dial

`Dial: ENERGY 2 / RHYTHM 2 / MOTION 1`

- **ENERGY 2:** alat kerja, bukan halaman pemasaran. Tegas dan percaya diri, tidak berteriak.
- **RHYTHM 2:** konsisten dengan beberapa pemutus. Layar triase adalah satu kolom keputusan vertikal; peta klaster adalah bidang lebar; tabel klaster adalah daftar padat. Tiga komposisi berbeda karena tiga tugas berbeda.
- **MOTION 1:** gerak hanya melayani status. Transisi keadaan (menunggu, berhasil, gagal) dan umpan balik hover. Tidak ada scroll-reveal, tidak ada parallax. Alat ukur tidak menari.

## Palet

Inti (2 warna + netral):
- `--void: #100E0B` latar arang hangat. Dipilih agar citra unggahan yang berwarna menjadi objek paling terang di layar.
- `--iron: #1C1915` bidang panel, satu tingkat di atas latar.
- `--bone: #E8E3D9` teks utama, putih tulang bukan putih murni agar tidak menyilaukan pada layar terang di lapangan.

Aksen (1):
- `--amber: #F0A030` dipakai HANYA untuk dua hal: penanda jalur berbahaya (baterai) dan nilai keyakinan yang sedang dibaca. Tidak untuk dekorasi, tidak untuk setiap tombol.

**Pembeda jalur penanganan tidak memakai warna.** Lima jalur (BOARD, HAZARD, DISPLAY, APPLIANCE, BULK) dibedakan oleh kode teks monospace dan bobot tipografi, bukan lima warna berbeda. Hanya HAZARD yang mendapat amber, karena hanya HAZARD yang berkonsekuensi keselamatan. Ini menjaga palet tetap 2 inti + 1 aksen dan membuat amber tetap berarti.

## Tipografi

- **IBM Plex Sans** untuk teks dan judul. Dipilih karena dirancang IBM untuk antarmuka teknis dan papan kendali, cocok dengan bahasa panel instrumen, dan bukan pilihan bawaan model (Inter, Geist, Space Grotesk).
- **IBM Plex Mono** khusus untuk angka terukur: skor kosinus, margin, jumlah citra, kode jalur. Alasan: angka pada alat ukur harus sejajar kolom agar bisa dibandingkan sekilas. Mono tidak dipakai untuk judul besar.

## Motif identitas

**Takik skala ukur (measurement tick).** Deretan garis pendek tidak rata panjang, seperti skala pada jangka sorong atau meter analog. Muncul di tiga tempat dan hanya tiga: penanda kepala bagian, batang pengukur margin keyakinan, dan sumbu peta klaster. Satu gestur, diulang, spesifik pada gagasan "mengukur".

## Aturan kejujuran tampilan

Ini bagian dari desain, bukan tambahan:

1. Setiap angka yang tampil berasal dari artefak notebook nyata (EXP 14) atau dari perhitungan langsung atas citra yang diunggah. Tidak ada angka hiasan.
2. Klaster yang label zero-shot-nya tidak cocok dengan isi sebenarnya (C9, C11) ditandai terbuka sebagai terbantah, lengkap dengan komposisi aslinya. Kegagalan model ditampilkan.
3. Hasil dengan margin di bawah ambang empiris (0,0297, persentil 5 margin leave-one-out) tidak diberi label. Layar menampilkan penolakan, bukan tebakan.
4. Label adalah dugaan taksonomis dari kedekatan visual, bukan pemeriksaan isi fisik barang. Kalimat ini muncul di antarmuka, bukan hanya di dokumentasi.

## Titik fokus per layar

- **Triase:** batang keyakinan beserta putusan jalur. Semua elemen lain tunduk padanya.
- **Peta klaster:** sebaran 2D itu sendiri.
- **Tabel klaster:** kolom margin, karena itu yang memisahkan klaster tepercaya dari yang terbantah.
- **Metodologi:** rantai pipeline.
