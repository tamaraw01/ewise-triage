#!/usr/bin/env bash
# Pengawas tunnel E-WISE: menjaga backend tetap terjangkau dari internet.
#
# Quick tunnel Cloudflare berumur pendek dan bisa dibuang sewaktu-waktu. Saat itu
# terjadi, cloudflared tidak keluar — ia mencoba mendaftar ulang ke tunnel yang
# sudah tiada ("Unauthorized: Tunnel not found") sampai kiamat, sehingga systemd
# melihat proses "hidup" padahal layanan sudah tidak terjangkau.
#
# Skrip ini karena itu tidak mempercayai status proses. Ia mengukur yang
# sebenarnya penting: apakah URL publik menjawab. Bila tidak, tunnel diputar
# ulang dan URL barunya disiarkan ke Vercel.
set -uo pipefail

PROJECT_DIR="/home/aditama/Projects/ewise-triage"
BACKEND_URL="http://127.0.0.1:10000/health"
STATE_DIR="/var/lib/ewise"
LOG_TUNNEL="/tmp/ewise_tunnel.log"

# Diisi lewat /etc/ewise.env (mode 600), bukan ditanam di berkas ini.
VERCEL_TOKEN="${VERCEL_TOKEN:-}"
VERCEL_PROJECT_ID="${VERCEL_PROJECT_ID:-}"
VERCEL_ORG_ID="${VERCEL_ORG_ID:-}"

# systemd tidak mewarisi PATH interaktif; node dan vercel harus ditunjuk eksplisit.
export PATH="/home/aditama/.local/bin:/home/aditama/.hermes/node/bin:/usr/local/bin:/usr/bin:/bin"
VERCEL_BIN="/home/aditama/.local/bin/vercel"

CEK_TIAP=60          # jeda antar pemeriksaan kesehatan, detik
GAGAL_AMBANG=3       # kegagalan berturut sebelum tunnel diputar ulang
BATAS_URL=180        # batas tunggu URL tunnel baru, detik

TUNNEL_PID=""
URL_SEKARANG=""
gagal_berturut=0

catat() { printf '%s %s\n' "$(date -Is)" "$*"; }

bersihkan() {
  [ -n "$TUNNEL_PID" ] && kill "$TUNNEL_PID" 2>/dev/null
  wait "$TUNNEL_PID" 2>/dev/null
  exit 0
}
trap bersihkan TERM INT

tunggu_backend() {
  # Tanpa backend hidup, tunnel hanya akan menyajikan galat ke pengguna.
  until curl -fsS -m 10 "$BACKEND_URL" >/dev/null 2>&1; do
    catat "menunggu backend di $BACKEND_URL"
    sleep 5
  done

  # Port terbuka belum berarti siap: model dimuat di latar dan permintaan
  # pertama bisa menggantung sampai kena batas waktu Cloudflare (~100 detik).
  local habis=$((SECONDS + 600))
  until curl -fsS -m 10 "$BACKEND_URL" 2>/dev/null | grep -q '"model_loaded":true'; do
    if [ $SECONDS -ge $habis ]; then
      catat "PERINGATAN: model belum termuat setelah 600s, lanjut saja"
      return 0
    fi
    catat "menunggu model selesai dimuat"
    sleep 10
  done
  catat "backend siap, model termuat"
}

matikan_tunnel() {
  [ -z "$TUNNEL_PID" ] && return 0
  kill "$TUNNEL_PID" 2>/dev/null
  wait "$TUNNEL_PID" 2>/dev/null
  pkill -f 'cloudflared tunnel --url http://127.0.0.1:10000' 2>/dev/null
  TUNNEL_PID=""
}

nyalakan_tunnel() {
  matikan_tunnel
  : > "$LOG_TUNNEL"
  cloudflared tunnel --url http://127.0.0.1:10000 >>"$LOG_TUNNEL" 2>&1 &
  TUNNEL_PID=$!
  catat "cloudflared dimulai (pid $TUNNEL_PID)"

  local habis=$((SECONDS + BATAS_URL)) url=""
  while [ $SECONDS -lt $habis ]; do
    url=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG_TUNNEL" | tail -1)
    if [ -n "$url" ] && curl -fsS -m 20 "$url/health" >/dev/null 2>&1; then
      URL_SEKARANG="$url"
      catat "tunnel aktif: $URL_SEKARANG"
      return 0
    fi
    sleep 5
  done

  catat "GAGAL: tunnel tidak menghasilkan URL sehat dalam ${BATAS_URL}s"
  return 1
}

terbitkan_penunjuk() {
  # Frontend membaca berkas ini saat dijalankan, jadi browser yang masih
  # memegang bundel lama tetap menemukan alamat baru tanpa menunggu rebuild.
  local url="$1"
  printf '%s\n' "$url" > "$PROJECT_DIR/api_base.txt"
  ( cd "$PROJECT_DIR" || return 1
    git add api_base.txt >/dev/null 2>&1
    git -c user.name="ewise-watchdog" -c user.email="watchdog@localhost" \
      commit -q -m "Alamat backend: $url" >/dev/null 2>&1
    git push -q origin master >/dev/null 2>&1
  ) && catat "penunjuk diterbitkan: $url" \
    || catat "GAGAL menerbitkan penunjuk (frontend jatuh ke nilai build)"
}

sinkron_vercel() {
  local url="$1"

  # Diterbitkan lebih dulu: penunjuk berlaku dalam detik, sedangkan rebuild
  # Vercel butuh menit. Pengguna tidak perlu menunggu build selesai.
  terbitkan_penunjuk "$url"

  if [ -z "$VERCEL_TOKEN" ] || [ -z "$VERCEL_PROJECT_ID" ]; then
    catat "LEWAT sinkron Vercel: kredensial belum diatur di /etc/ewise.env"
    return 1
  fi

  local api="https://api.vercel.com"
  local q="teamId=$VERCEL_ORG_ID"

  # Buang nilai lama; id-nya dicari agar tidak menghapus variabel lain.
  local ids
  ids=$(curl -fsS -m 30 -H "Authorization: Bearer $VERCEL_TOKEN" \
        "$api/v9/projects/$VERCEL_PROJECT_ID/env?$q" 2>/dev/null \
        | grep -oE '\{"[^{]*"key":"NEXT_PUBLIC_API_BASE"[^}]*\}' \
        | grep -oE '"id":"[^"]+"' | cut -d'"' -f4)
  for id in $ids; do
    curl -fsS -m 30 -X DELETE -H "Authorization: Bearer $VERCEL_TOKEN" \
      "$api/v9/projects/$VERCEL_PROJECT_ID/env/$id?$q" >/dev/null 2>&1
  done

  curl -fsS -m 30 -X POST -H "Authorization: Bearer $VERCEL_TOKEN" \
    -H "Content-Type: application/json" \
    "$api/v10/projects/$VERCEL_PROJECT_ID/env?$q" \
    -d "{\"key\":\"NEXT_PUBLIC_API_BASE\",\"value\":\"$url\",\"type\":\"plain\",\"target\":[\"production\",\"preview\",\"development\"]}" \
    >/dev/null 2>&1 || { catat "GAGAL menulis env Vercel"; return 1; }

  # URL tertanam saat build, jadi frontend wajib dirakit ulang.
  local dep
  dep=$(cd "$PROJECT_DIR/web" && \
        VERCEL_TOKEN="$VERCEL_TOKEN" "$VERCEL_BIN" deploy --prod --yes \
        --token "$VERCEL_TOKEN" 2>&1)
  # Periksa seluruh keluaran: memotongnya lebih dulu pernah menyembunyikan
  # penanda sukses dan membuat deploy yang berhasil dilaporkan gagal.
  if ! printf '%s' "$dep" | grep -qE '"readyState": *"READY"|Aliased'; then
    catat "GAGAL deploy Vercel: $(printf '%s' "$dep" | tail -3)"
    return 1
  fi

  mkdir -p "$STATE_DIR"
  printf '%s\n' "$url" > "$STATE_DIR/api_base"
  catat "Vercel disinkronkan dan dirakit ulang: $url"
}

sinkron_sampai_berhasil() {
  local url="$1" percobaan=0
  until sinkron_vercel "$url"; do
    percobaan=$((percobaan + 1))
    if [ "$percobaan" -ge 5 ]; then
      catat "sinkron Vercel gagal 5 kali; lanjut memantau, akan dicoba lagi saat rotasi berikutnya"
      return 1
    fi
    catat "sinkron gagal, ulangi dalam 60s (percobaan $percobaan/5)"
    sleep 60
  done
  return 0
}

# --- jalan utama ---
mkdir -p "$STATE_DIR"
tunggu_backend

until nyalakan_tunnel; do
  catat "mencoba lagi dalam 30s"
  sleep 30
done
sinkron_sampai_berhasil "$URL_SEKARANG"

while :; do
  sleep "$CEK_TIAP"

  if ! curl -fsS -m 10 "$BACKEND_URL" >/dev/null 2>&1; then
    catat "backend tidak menjawab; menunggu pulih"
    tunggu_backend
    continue
  fi

  # Sumber kebenaran: URL publik, bukan status proses cloudflared.
  if curl -fsS -m 25 "$URL_SEKARANG/health" >/dev/null 2>&1; then
    gagal_berturut=0
    continue
  fi

  gagal_berturut=$((gagal_berturut + 1))
  catat "URL publik gagal ($gagal_berturut/$GAGAL_AMBANG): $URL_SEKARANG"
  [ "$gagal_berturut" -lt "$GAGAL_AMBANG" ] && continue

  catat "memutar ulang tunnel"
  gagal_berturut=0
  until nyalakan_tunnel; do
    catat "mencoba lagi dalam 30s"
    sleep 30
  done
  sinkron_sampai_berhasil "$URL_SEKARANG"
done
