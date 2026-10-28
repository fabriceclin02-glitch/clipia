#!/usr/bin/env bash
# Construit les installeurs Clipia : Windows (.exe), Linux (.deb), macOS (.zip + .dmg).
# Nécessite : makensis, dpkg-deb, xorriso, zip, npm, python3-pil (icône).
set -euo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)"
VER="$(node -p "require('$SRC/package.json').version")"
WORK="${WORK:-$(mktemp -d)}"; DIST="${DIST:-$SRC/dist}"; NODEV="${NODEV:-26.12.1}"
mkdir -p "$DIST" "$WORK/dl"; echo "Clipia $VER — travail : $WORK"

# 0. Sources propres (sans données, clés ni outils de dev)
APP="$WORK/app"; mkdir -p "$APP"
(cd "$SRC" && tar cf - --exclude=./node_modules --exclude=./data --exclude=./android --exclude=./installers --exclude=./desktop --exclude=./dist --exclude='*.zip' --exclude=.env .) | tar xf - -C "$APP"
cp "$SRC/INSTALLATION.md" "$APP/"
sed 's/\*\*//g; s/`//g' "$SRC/INSTALLATION.md" > "$WORK/LISEZ-MOI.txt"; sed -i 's/$/\r/' "$WORK/LISEZ-MOI.txt"

# 1. Runtimes Node (binaires officiels publiés comme paquets npm)
getnode() { # $1 = plateforme npm, $2 = binaire dans l'archive
  local f="$WORK/dl/node-$1-$NODEV.tgz"
  [ -f "$f" ] || (cd "$WORK/dl" && npm pack "node-$1@$NODEV" >/dev/null 2>&1)
  mkdir -p "$WORK/n-$1"; tar xzf "$WORK/dl/node-$1-$NODEV.tgz" -C "$WORK/n-$1" --strip-components=1; echo "$WORK/n-$1/$2"
}
NODE_WIN="$(getnode win-x64 bin/node.exe)"; NODE_LIN="$(getnode linux-x64 bin/node)"; NODE_MAC="$(getnode darwin-x64 bin/node)"

# 2. Windows
W="$SRC/installers/windows"
makensis -V1 -DOUT="$WORK/Clipia.exe" -DICON="$W/clipia.ico" "$W/lanceur.nsi"
makensis -V1 -DOUT="$WORK/Quitter-Clipia.exe" -DICON="$W/clipia.ico" "$W/quitter.nsi"
FFOPT=""; [ -f "${FFMPEG_WIN_DIR:-/home/claude/ffwin}/ffmpeg.exe" ] && FFOPT="-DFFDIR=${FFMPEG_WIN_DIR:-/home/claude/ffwin}"
node "$SRC/installers/gen-nsis.mjs" > "$WORK/logiciels.nsh"; makensis -V1 -DLOGICIELS="$WORK/logiciels.nsh" $FFOPT -DVERSION="$VER" -DOUT="$DIST/Clipia-Setup-$VER-windows-x64.exe" -DICON="$W/clipia.ico" \
  -DLAUNCHER="$WORK/Clipia.exe" -DQUITTER="$WORK/Quitter-Clipia.exe" -DNODE="$NODE_WIN" -DAPPDIR="$APP" -DLISEZMOI="$WORK/LISEZ-MOI.txt" -DDIAG="$W/Diagnostic-installe.bat" "$W/clipia.nsi"


# 2b. Windows portable (zip, sans installation) : dossier Clipia-Portable/ avec node.exe, app, lanceur et données locales
makensis -V1 -DOUT="$WORK/Clipia-portable.exe" -DICON="$W/clipia.ico" "$W/lanceur-portable.nsi"
P="$WORK/Clipia-Portable"; rm -rf "$P"; mkdir -p "$P/runtime" "$P/donnees"
cp -a "$APP" "$P/app"; cp "$NODE_WIN" "$P/runtime/node.exe"
cp "$WORK/Clipia-portable.exe" "$P/Clipia.exe"; cp "$WORK/Quitter-Clipia.exe" "$P/Quitter-Clipia.exe"; sed 's/$/\r/' "$W/Diagnostic-portable.bat" > "$P/Diagnostic-Clipia.bat"
cat > "$P/LISEZ-MOI.txt" <<'LM'
CLIPIA — version portable (sans installation)

1. Dézippe ce dossier où tu veux (Bureau, clé USB...).
2. Double-clique Clipia.exe : Clipia démarre et s'ouvre dans ton navigateur.
   Pour le mode appel (dire « Clipia »), utilise Chrome ou Edge.
3. Pour arrêter : Quitter-Clipia.exe.
   Si quelque chose ne va pas : Diagnostic-Clipia.bat affiche le journal et les erreurs.
   IMPORTANT : extrais TOUT le zip (clic droit > Extraire tout) avant de lancer Clipia.exe ; ne le lance pas depuis WinRAR.

Tes données (projets, mémoire, réglages) sont dans le dossier "donnees", à côté de Clipia.exe.
Copie le dossier entier pour tout emporter. Rien n'est écrit dans le registre.

Windows peut afficher « Windows a protégé votre ordinateur » : le logiciel n'est pas signé par un éditeur payant.
Clique « Informations complémentaires » puis « Exécuter quand même ».

Premier lancement : installe Ollama (https://ollama.com/download), puis dans Clipia clique « Oui, prépare tout ».
Guide complet : app\INSTALLATION.md
LM
sed -i 's/$/\r/' "$P/LISEZ-MOI.txt"
(cd "$WORK" && rm -f "$DIST/Clipia-Portable-$VER-windows-x64.zip" && zip -qr9 "$DIST/Clipia-Portable-$VER-windows-x64.zip" Clipia-Portable)

# 3. Linux .deb
D="$WORK/deb"; rm -rf "$D"; mkdir -p "$D/DEBIAN" "$D/opt/clipia/runtime" "$D/usr/bin" "$D/usr/share/applications" "$D/usr/share/icons/hicolor/512x512/apps"
cp -a "$APP" "$D/opt/clipia/app"; cp "$NODE_LIN" "$D/opt/clipia/runtime/node"; chmod 755 "$D/opt/clipia/runtime/node"
install -m755 "$SRC/installers/linux/clipia" "$D/usr/bin/clipia"
install -m644 "$SRC/installers/linux/clipia.desktop" "$D/usr/share/applications/clipia.desktop"
install -m644 "$SRC/desktop/resources/icone.png" "$D/usr/share/icons/hicolor/512x512/apps/clipia.png"
cat > "$D/DEBIAN/control" <<CTL
Package: clipia
Version: $VER
Section: graphics
Priority: optional
Architecture: amd64
Maintainer: CLENDAX <contact@clendax.example>
Recommends: ffmpeg, xdg-utils
Installed-Size: $(du -sk "$D/opt" | cut -f1)
Description: Clipia — studio créatif IA
 Image, vidéo, musique, texte, projets persistants, agents et sous-agents.
 Multi-moteurs : Ollama, OpenRouter, OpenClaw et de nombreux fournisseurs.
 Node.js embarqué ; données dans ~/.local/share/clipia.
CTL
dpkg-deb --root-owner-group -Zxz -b "$D" "$DIST/clipia_${VER}_amd64.deb" >/dev/null

# 4. macOS
A="$WORK/Clipia.app"; rm -rf "$A"; mkdir -p "$A/Contents/MacOS" "$A/Contents/Resources"
cp -a "$APP" "$A/Contents/Resources/app"; cp "$NODE_MAC" "$A/Contents/Resources/node"
install -m755 "$SRC/installers/macos/Clipia-launcher.sh" "$A/Contents/MacOS/Clipia"; chmod 755 "$A/Contents/Resources/node"
cp "$SRC/desktop/resources/icone.png" "$A/Contents/Resources/clipia.png"
cat > "$A/Contents/Info.plist" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleName</key><string>Clipia</string><key>CFBundleDisplayName</key><string>Clipia</string>
<key>CFBundleIdentifier</key><string>com.clendax.clipia</string><key>CFBundleVersion</key><string>$VER</string>
<key>CFBundleShortVersionString</key><string>$VER</string><key>CFBundleExecutable</key><string>Clipia</string>
<key>CFBundlePackageType</key><string>APPL</string><key>LSMinimumSystemVersion</key><string>11.0</string>
<key>NSHighResolutionCapable</key><true/></dict></plist>
PL
(cd "$WORK" && rm -f "$DIST/Clipia-$VER-macos.zip" && zip -qry "$DIST/Clipia-$VER-macos.zip" Clipia.app)
# .dmg : image hybride ISO9660 + HFS+ (xorriso). Non testée sur un vrai Mac.
M="$WORK/dmg"; rm -rf "$M"; mkdir -p "$M"; cp -a "$A" "$M/"; ln -s /Applications "$M/Applications"
cp "$WORK/LISEZ-MOI.txt" "$M/LISEZ-MOI.txt"
xorriso -as mkisofs -V "Clipia X8 $VER" -hfsplus -iso-level 3 -J -R -o "$DIST/Clipia-$VER-macos.dmg" "$M" >/dev/null 2>&1

# 5. Empreintes
(cd "$DIST" && sha256sum Clipia-* clipia_* > SHA256SUMS.txt); ls -la "$DIST"
