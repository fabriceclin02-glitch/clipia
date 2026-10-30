#!/usr/bin/env bash
# Installe Kodi (officiel) + le pack Clipia sur macOS. Double-clique ce fichier (clic droit > Ouvrir si Apple le bloque).
cd "$(dirname "$0")"; PACK="$(pwd)"
echo "== Kodi + pack Clipia =="
if [ ! -d /Applications/Kodi.app ]; then
  if command -v brew >/dev/null 2>&1; then brew install --cask kodi
  else echo "Télécharge Kodi sur https://kodi.tv/download/macos, glisse-le dans Applications, puis relance ce fichier."; open "https://kodi.tv/download/macos"; exit 1; fi
fi
KD="$HOME/Library/Application Support/Kodi"; mkdir -p "$KD/addons" "$KD/userdata"
cp -R "$PACK/plugin.video.clipia.home" "$PACK/repository.clipia" "$KD/addons/"
[ -f "$KD/userdata/autoexec.py" ] || cp "$PACK/autoexec.py" "$KD/userdata/autoexec.py"
echo "Terminé. Ouvre Kodi : Extensions → Extensions vidéo → « Clipia — Accueil »."
