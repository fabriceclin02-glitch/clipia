#!/usr/bin/env bash
# Installe Kodi (officiel, via ton système) + le pack Clipia, pour Linux.
set -e
PACK="$(cd "$(dirname "$0")" && pwd)"; [ -d "$PACK/plugin.video.clipia.home" ] || PACK=/usr/share/clipia/kodi-pack
echo "== Kodi + pack Clipia =="
if ! command -v kodi >/dev/null 2>&1 && ! flatpak info org.xbmc.Kodi >/dev/null 2>&1; then
  if command -v apt-get >/dev/null 2>&1; then sudo apt-get update -qq && sudo apt-get install -y kodi; KD="$HOME/.kodi"
  elif command -v dnf >/dev/null 2>&1; then sudo dnf install -y kodi; KD="$HOME/.kodi"
  elif command -v pacman >/dev/null 2>&1; then sudo pacman -S --noconfirm kodi; KD="$HOME/.kodi"
  elif command -v flatpak >/dev/null 2>&1; then flatpak install -y flathub org.xbmc.Kodi; KD="$HOME/.var/app/org.xbmc.Kodi/data"
  else echo "Installe Kodi depuis https://kodi.tv/download/linux puis relance ce script."; exit 1; fi
fi
if [ -z "$KD" ]; then if flatpak info org.xbmc.Kodi >/dev/null 2>&1 && ! command -v kodi >/dev/null 2>&1; then KD="$HOME/.var/app/org.xbmc.Kodi/data"; else KD="$HOME/.kodi"; fi; fi
mkdir -p "$KD/addons" "$KD/userdata"
cp -r "$PACK/plugin.video.clipia.home" "$PACK/repository.clipia" "$KD/addons/"
[ -f "$KD/userdata/autoexec.py" ] || cp "$PACK/autoexec.py" "$KD/userdata/autoexec.py"
echo "Terminé. Lance Kodi : Extensions → Extensions vidéo → « Clipia — Accueil » → Clipia et réglages → Tout installer."
