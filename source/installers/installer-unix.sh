#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════╗
# ║  CLIPIA — installateur macOS / Linux                     ║
# ║  Lancement :  bash installers/installer-unix.sh          ║
# ╚══════════════════════════════════════════════════════════╝
set -euo pipefail
RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
J='\033[1;33m'; V='\033[0;32m'; C='\033[0;36m'; R='\033[0;31m'; N='\033[0m'
titre(){ printf "\n  ${J}%s${N}\n  ----------------------------------------------------\n" "$1"; }
ok(){ printf "  ${V}[OK]${N} %s\n" "$1"; }
info(){ printf "  ${C}----${N} %s\n" "$1"; }
souci(){ printf "  ${R}[!]${N}  %s\n" "$1"; }

clear
printf "${J}
   ██████╗ ██╗     ██╗██████╗ ██╗ █████╗
  ██╔════╝ ██║     ██║██╔══██╗██║██╔══██╗
  ██║      ██║     ██║██████╔╝██║███████║
  ██║      ██║     ██║██╔═══╝ ██║██╔══██║
  ╚██████╗ ███████╗██║██║     ██║██║  ██║
   ╚═════╝ ╚══════╝╚═╝╚═╝     ╚═╝╚═╝  ╚═╝
   Studio créatif IA · CLENDAX
${N}\n"

if [[ "$OSTYPE" == darwin* ]]; then PM="brew"
elif command -v apt-get >/dev/null; then PM="apt"
elif command -v dnf >/dev/null; then PM="dnf"
elif command -v pacman >/dev/null; then PM="pacman"
else PM=""; fi

inst(){ case "$PM" in
  brew) brew install "$1" ;;
  apt) sudo apt-get update -qq && sudo apt-get install -y "$1" ;;
  dnf) sudo dnf install -y "$1" ;;
  pacman) sudo pacman -S --noconfirm "$1" ;;
  *) souci "Gestionnaire de paquets inconnu. Installez $1 manuellement." ; return 1 ;;
esac }

titre "1/5 · Node.js"
if command -v node >/dev/null && [ "$(node -v | sed 's/v//' | cut -d. -f1)" -ge 20 ]; then
  ok "Node $(node -v)"
else
  info "Installation de Node.js…"
  if [ "$PM" = "brew" ]; then inst node
  elif [ "$PM" = "apt" ]; then curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && inst nodejs
  else inst nodejs; fi
  ok "Node $(node -v)"
fi

titre "2/5 · FFmpeg"
if command -v ffmpeg >/dev/null; then ok "FFmpeg $(ffmpeg -version | head -1 | cut -d' ' -f3)"
else info "Installation de FFmpeg…"; inst ffmpeg && ok "FFmpeg installé" || souci "Sans FFmpeg, pas de montage vidéo."; fi

titre "3/5 · Configuration"
[ -f "$RACINE/.env" ] || { cp "$RACINE/.env.example" "$RACINE/.env"; ok "Fichier .env créé"; }
ok "Configuration prête"

titre "4/5 · IA locale gratuite (facultatif)"
if command -v ollama >/dev/null; then ok "Ollama présent"
else
  read -rp "  Installer Ollama pour utiliser Clipia gratuitement, sans abonnement IA ? (o/N) " rep
  if [[ "$rep" =~ ^[oOyY] ]]; then
    curl -fsSL https://ollama.com/install.sh | sh
    info "Téléchargement d'un modèle (quelques minutes)…"
    ollama pull llama3.2 || true
    ok "Ollama prêt"
  fi
fi

titre "5/5 · Raccourci"
if [[ "$OSTYPE" == darwin* ]]; then
  APP="$HOME/Applications/Clipia.app"; mkdir -p "$APP/Contents/MacOS"
  cat > "$APP/Contents/MacOS/Clipia" <<SH
#!/bin/bash
cd "$RACINE" && open http://127.0.0.1:8787 && exec node server/index.js
SH
  chmod +x "$APP/Contents/MacOS/Clipia"
  cat > "$APP/Contents/Info.plist" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleName</key><string>Clipia</string>
<key>CFBundleExecutable</key><string>Clipia</string>
<key>CFBundleIdentifier</key><string>app.clendax.clipia</string>
<key>CFBundleVersion</key><string>1.0.0</string>
<key>LSMinimumSystemVersion</key><string>11.0</string>
</dict></plist>
PL
  ok "Clipia.app créée dans ~/Applications"
else
  mkdir -p "$HOME/.local/share/applications"
  cat > "$HOME/.local/share/applications/clipia.desktop" <<DT
[Desktop Entry]
Type=Application
Name=Clipia
Comment=Studio créatif IA — CLENDAX
Exec=bash -c 'cd "$RACINE" && (xdg-open http://127.0.0.1:8787 &) && node server/index.js'
Terminal=true
Categories=AudioVideo;Audio;Video;Graphics;
DT
  ok "Entrée de menu créée"
fi

titre "Démarrage"
printf "  ${V}Clipia s'ouvre sur http://127.0.0.1:8787${N}\n\n"
cd "$RACINE"
( sleep 2 && (command -v xdg-open >/dev/null && xdg-open http://127.0.0.1:8787 || open http://127.0.0.1:8787) ) >/dev/null 2>&1 &
exec node server/index.js
