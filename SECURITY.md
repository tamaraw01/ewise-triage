# Keamanan

Jangan kirim kredensial, data pribadi, atau foto sensitif dalam issue publik.
Laporkan kerentanan melalui fitur **Report a vulnerability** di tab Security GitHub jika tersedia. Jika kanal privat belum tersedia, buat issue yang hanya meminta kanal kontak, tanpa detail eksploitasi.

## Pemrosesan foto

Pemilihan foto memulai analisis otomatis. Browser mengirim citra melalui proxy E-WISE ke backend di Hugging Face. Metadata citra dapat ikut terkirim. Repo ini tidak menetapkan kebijakan retensi penyedia hosting; jangan menganggap foto langsung dihapus.

Token backend harus tetap berada di environment server. Jangan memakai awalan `NEXT_PUBLIC_` untuk rahasia. File `.env`, script deployment lokal, dan kredensial tidak boleh masuk Git atau konteks build Docker.

Layanan publik membutuhkan pembatasan trafik dan kuota pada penyedia hosting. Validasi unggahan bukan pengganti autentikasi atau rate limiting.
