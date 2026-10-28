#!/usr/bin/env bash
cd "$(dirname "$0")"
clear
echo
echo "  ================================================"
echo "     CLIPIA — Studio créatif IA — CLENDAX"
echo "  ================================================"
echo
if ! command -v node >/dev/null; then
  echo "  [X] Node.js n'est pas installé."
  echo "      Debian/Ubuntu :  sudo apt install nodejs"
  echo "      ou :  https://nodejs.org"
  echo
  exit 1
fi
echo "  [OK] Node.js $(node -v)"
if command -v ffmpeg >/dev/null; then echo "  [OK] FFmpeg détecté"
else echo "  [!]  FFmpeg absent — montage vidéo indisponible (sudo apt install ffmpeg)"; fi
echo
echo "  Ouverture de  http://127.0.0.1:8787"
echo "  Ctrl+C pour arrêter."
echo
( sleep 2 && xdg-open http://127.0.0.1:8787 ) >/dev/null 2>&1 &
node server/index.js
