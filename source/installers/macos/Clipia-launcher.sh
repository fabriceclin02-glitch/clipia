#!/bin/bash
# Point d'entrée de Clipia.app
DIR="$(cd "$(dirname "$0")/.." && pwd)"
export CLIPIA_DATA_DIR="$HOME/Library/Application Support/Clipia"
mkdir -p "$CLIPIA_DATA_DIR"
PORT="${PORT:-8787}"; export PORT
URL="http://127.0.0.1:$PORT"
NODE=""
if command -v node >/dev/null 2>&1 && [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 20 ] 2>/dev/null; then NODE="$(command -v node)"; fi
[ -z "$NODE" ] && NODE="$DIR/Resources/node"
chmod +x "$NODE" 2>/dev/null
if curl -fs -m 2 "$URL/api/auto" >/dev/null 2>&1; then open "$URL"; exit 0; fi
( sleep 2; open "$URL" ) &
cd "$DIR/Resources/app" && exec "$NODE" server/index.js >> "$CLIPIA_DATA_DIR/clipia.log" 2>&1
