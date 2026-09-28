#!/bin/bash
PROJECT_DIR="/home/aditama/Projects/ewise-triage"
VERCEL_TOKEN=$VERCEL_API_TOKEN
LOG_FILE="/tmp/ewise_tunnel.log"

export NVM_DIR="/home/aditama/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

rm -f $LOG_FILE
cloudflared tunnel --url http://127.0.0.1:10000 2>&1 | tee $LOG_FILE &
TUNNEL_PID=$!

echo "Menunggu URL Tunnel terbentuk..."
while true; do
  URL=$(grep -o 'https://.*trycloudflare.com' $LOG_FILE | head -1)
  if [ ! -z "$URL" ]; then
    echo "Ditemukan URL: $URL"
    break
  fi
  sleep 5
done

echo "Memperbarui Vercel dengan URL baru..."
export VERCEL_TOKEN=$VERCEL_TOKEN
cd $PROJECT_DIR/web

vercel env rm NEXT_PUBLIC_API_BASE production --yes --token "$VERCEL_TOKEN" || true
echo "$URL" | vercel env add NEXT_PUBLIC_API_BASE production --token "$VERCEL_TOKEN"

echo "Mendeploy ulang Vercel..."
vercel deploy --prod --yes --name ewise --token "$VERCEL_TOKEN"

echo "Vercel live! Memantau tunnel..."
wait $TUNNEL_PID
