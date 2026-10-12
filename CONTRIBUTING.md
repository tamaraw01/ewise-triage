# Kontribusi

Perubahan harus menjaga Konsol, Cluster Explorer, akses keyboard, dan pemisahan hasil unggahan dari statistik riset.

Dari direktori `web`, jalankan:

```sh
npm ci
npm run lint
npm test
npx tsc --noEmit
npm run build
```

Untuk perubahan UI, jalankan server produksi lalu `python3 scripts/ui-check.py http://localhost:3000`. Pemeriksaan ini memerlukan Google Chrome dan modul Python `websocket-client`. Validasi API dapat diuji dengan `python3 scripts/api-check.py http://localhost:3000`.

Jangan sertakan foto pribadi, kredensial, path mesin, log deployment, atau instruksi agen. Jelaskan perilaku yang berubah dan sertakan hasil uji nyata dalam pull request. Perubahan model harus mempertahankan provenance artefak dan menjelaskan batas evaluasi.
