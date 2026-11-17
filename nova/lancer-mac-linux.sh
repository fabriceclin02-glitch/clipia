#!/bin/sh
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Node.js est requis : https://nodejs.org"; exit 1; }
[ -d node_modules ] || npm install
npm start
