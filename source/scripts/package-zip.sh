#!/usr/bin/env bash
# Crée l'archive de distribution Clipia
set -euo pipefail
cd "$(dirname "$0")/.."
NOM="clipia-1.0.0"
rm -rf "/tmp/$NOM" "/tmp/$NOM.zip"
mkdir -p "/tmp/$NOM"
for f in server web desktop android installers docs scripts skills-defaut package.json .env.example README.md .gitignore Dockerfile docker-compose.yml COMMENCER-ICI.txt DEMARRER.bat DEMARRER.command demarrer.sh; do
  cp -r "$f" "/tmp/$NOM/"
done
mkdir -p "/tmp/$NOM/data"
echo "Ce dossier reçoit le coffre chiffré, la base et vos médias. Il n'est jamais versionné." > "/tmp/$NOM/data/LISEZ-MOI.txt"
cd /tmp && zip -rq "$NOM.zip" "$NOM" -x '*.DS_Store' && echo "/tmp/$NOM.zip  ($(du -h "$NOM.zip" | cut -f1))"
