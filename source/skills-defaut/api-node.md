# API Node

> Écrire une petite API HTTP en Node, sans dépendance.

## Attendu

Un `server.js` qui démarre avec `node server.js`, et un `README.md` qui liste les routes.

## Règles

- Module `node:http` natif, pas d'Express sauf demande explicite
- Modules ES (`import`), avec `"type": "module"` dans `package.json`
- Chaque route renvoie du JSON et un code HTTP juste
- Erreurs attrapées et renvoyées en `{ "erreur": "..." }`, jamais de pile brute
- Données en fichier JSON avec écriture atomique (`.tmp` puis `rename`)
- Port configurable par variable d'environnement, 3000 par défaut
