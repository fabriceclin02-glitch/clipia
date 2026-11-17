# Clipia Nova 2 — le navigateur compagnon qui protège ses utilisateurs

Conçu par **Clin Fabrice — CLENDAX (Flize, Ardennes)**.
Moteur Chromium (le même que Chrome) · Windows · macOS · Linux.

## Tester tout de suite (Windows)

1. Installez **Node.js** (version LTS) : https://nodejs.org
2. Dézippez le dossier `clipia-nova`.
3. Double-cliquez sur **LANCER-WINDOWS.bat**.
   La première fois, l'installation prend 1 à 2 minutes, puis Clipia Nova s'ouvre.

Mac / Linux : ouvrez un terminal dans le dossier et lancez `./lancer-mac-linux.sh`.

## Nouveautés 2.0

- Compagnon Clipia plein écran (Ctrl+Espace) : sphère 3D interactive qui écoute, parle et répond
- Voix : dictée (Whisper via Groq gratuit ou OpenAI), réponses à voix haute, mode mains libres « Clipia… »
- Mémoire locale (« Clipia, souviens-toi que… »)
- Plus de 30 raccourcis clavier (F1), recherche dans la page, zoom, favoris, historique
- Mode Tor intégré (Ctrl+Maj+N) pour les sites .onion, avec Tor officiel fourni (Windows, Mac, Linux PC)
- Android : voix native, sphère compagnon, .onion via Tor Browser

## Ce qu'il contient

- Animation 3D de démarrage (sphère Clipia) et assistant de configuration en 6 étapes
- Onglets, barre d'adresse/recherche (Google, DuckDuckGo, Qwant, Ecosia, Bing), historique
- **Clipia IA** (Ctrl+J) : Claude, ChatGPT, Gemini, Mistral, DeepSeek, Groq, Grok, GLM, OpenRouter, Ollama (local)
  - bouton « Mes modèles » : liste tous les modèles disponibles avec la clé de l'utilisateur
  - résumer / traduire / expliquer la page, idées de clip, rédaction de posts, lecture vocale
  - styles : Ami, Entrepreneur, Créateur de projet, Studio Clipia, Écoute, style personnalisé
- **Clipia Store** : applications à installer sur l'accueil, espace de soumission développeurs
- **Mails** : Gmail, Outlook, Yahoo, iCloud, Proton, Orange, SFR, Free, La Poste
- **Bouclier** : blocage des traqueurs, HTTPS automatique, clés chiffrées par le système,
  caméra/micro/position sur autorisation, effacement des données en un clic

## Créer les installeurs

- Sur votre PC : `npm install` puis `npm run dist:win` → dossier `dist/` (installeur + version portable)
- Pour les 3 systèmes d'un coup : déposez le dossier sur GitHub, puis publiez un tag `v1.0.0`.
  Le fichier `.github/workflows/build.yml` compile Windows, Mac et Linux et les met dans les Releases.

## Limites de la version 1.0

- Le Store est local : la publication des applis développeurs pour tous demande un petit serveur.
- Mises à jour automatiques et signature de code (certificat) à ajouter avant la diffusion publique.
- Google peut parfois refuser la connexion à Gmail dans un navigateur peu connu : dans ce cas, réessayez, ou utilisez une autre messagerie.
- Pas de version téléphone : Android/iPhone demandent une application séparée.
