#!/usr/bin/env bash
# Prépare le projet Android. À lancer depuis le dossier android/.
set -euo pipefail
cd "$(dirname "$0")"
echo "1/4 · copie de l'interface"
rm -rf www && mkdir -p www && cp -r ../web/* www/
echo "2/4 · dépendances Capacitor"
npm install
echo "3/4 · plateforme Android"
[ -d android ] || npx cap add android
echo "4/4 · icônes et écran de lancement"
npx @capacitor/assets generate --android 2>/dev/null || echo "   (facultatif : npm i -D @capacitor/assets)"
npx cap sync android
echo
echo "Prêt. Ensuite :"
echo "  npx cap open android      → ouvre Android Studio"
echo "  cd android && ./gradlew assembleDebug    → APK de test"
echo "  cd android && ./gradlew bundleRelease    → AAB pour le Play Store"
