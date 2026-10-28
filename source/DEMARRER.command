#!/bin/bash
cd "$(dirname "$0")"
clear
echo
echo "  ================================================"
echo "     CLIPIA — Studio créatif IA — CLENDAX"
echo "  ================================================"
echo
if ! command -v node >/dev/null; then
  echo "  [X] Node.js n'est pas installé."
  echo
  echo "      Téléchargez-le ici :  https://nodejs.org"
  echo "      ou :  brew install node"
  echo
  read -p "  Entrée pour fermer"
  exit 1
fi
echo "  [OK] Node.js $(node -v)"
if command -v ffmpeg >/dev/null; then echo "  [OK] FFmpeg détecté"
else echo "  [!]  FFmpeg absent — le montage vidéo ne fonctionnera pas."
     echo "       Pour l'installer :  brew install ffmpeg"; fi
echo
echo "  Ouverture de  http://127.0.0.1:8787"
echo "  Laissez cette fenêtre ouverte. Ctrl+C pour arrêter."
echo
( sleep 2 && open http://127.0.0.1:8787 ) >/dev/null 2>&1 &
node server/index.js
