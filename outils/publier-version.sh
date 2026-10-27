#!/usr/bin/env bash
# Même chose que publier-version.ps1, pour macOS/Linux. Usage : outils/publier-version.sh 7.0.1 /chemin/Clipia-V7.0.1
set -euo pipefail
V="$1"; D="$2"; REPO=fabriceclin02-glitch/clipia; TAG="v$V"
mapfile -t F < <(find "$D" -maxdepth 1 -type f \( -name 'Clipia-Setup*' -o -name 'Clipia-Portable*' -o -name 'clipia_*' -o -name 'Clipia-*-macos.zip' -o -name 'Clipia-V*iso.zip.part*' \))
[ ${#F[@]} -gt 0 ] || { echo "Aucun fichier dans $D"; exit 1; }
gh release create "$TAG" "${F[@]}" --repo "$REPO" --title "Clipia X${V%%.*} $V" --notes "Clipia $V. Vérifie l'empreinte SHA-256 indiquée sur le site."
python3 - "$V" "$REPO" "$TAG" "${F[@]}" <<'PY'
import sys,json,hashlib,os
V,REPO,TAG,*F=sys.argv[1:]; L=json.load(open('liens.json',encoding='utf-8')); L['version']=V
url=lambda n:f"https://github.com/{REPO}/releases/download/{TAG}/{n}"
sha=lambda p:hashlib.sha256(open(p,'rb').read()).hexdigest()
mo=lambda p:f"{round(os.path.getsize(p)/1e6)} Mo"
for p in sorted(F):
    n=os.path.basename(p); k=None
    if n.startswith('Clipia-Setup'):k='windows'
    elif n.startswith('Clipia-Portable'):k='portable'
    elif n.startswith('clipia_'):k='linux'
    elif n.endswith('macos.zip'):k='macos'
    if k: L['fichiers'][k]={'nom':n,'url':url(n),'taille':mo(p),'sha256':sha(p)}
parts=[p for p in sorted(F) if '.iso.zip.part' in p]
if parts: L['fichiers']['iso']={'nom':f'Clipia-V{V}-windows.iso.zip ({len(parts)} parties)','parties':[{'url':url(os.path.basename(p))} for p in parts],'taille':f'{len(parts)} parties'}
json.dump(L,open('liens.json','w',encoding='utf-8'),ensure_ascii=False,indent=2)
PY
git add liens.json && git commit -m "Clipia $V : liens de téléchargement" && git push
echo "Version $V publiée."
