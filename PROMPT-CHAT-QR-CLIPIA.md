# Prompt — Messagerie « type WhatsApp » pour Clipia + QR code de connexion

À coller dans Claude Code (ou Clipia) sur le dépôt `clipia`. Il s'appuie sur ce qui existe déjà : l'accès distant (`server/noyau/acces-distant.js`, routes `/telephone`, `/api/telephone/demander`, `/mcp`, jeton), l'APK WebView (`android/`, pont `window.ClipiaAndroid`) et le cerveau complet (`noyauBoucle.converser`).

---

## LE PROMPT

Tu es développeur senior sur Clipia (désktop Node dans `source/`, PWA + APK Android dans `app/` et `android/`). Objectif : une **messagerie privée façon WhatsApp, uniquement entre le téléphone (APK) et l'IA Clipia qui tourne sur le PC / Mac / Linux**, appairée par **QR code**. Tu travailles étape par étape. À chaque étape tu codes, tu TESTES (Playwright / scripts / selftest) et tu ne passes à la suivante que si c'est vert. Tu ne dis « fait » que si tu l'as constaté. Pas de dépendance npm côté serveur (le projet n'en a aucune) : le QR se génère avec un module maison ou une bibliothèque embarquée en un fichier.

### Étape 1 — Appairage par QR (côté ordinateur)
1. Dans l'interface web desktop, section « Pilotage à distance », ajoute le bouton **« Connecter mon téléphone »**.
2. Il appelle `POST /api/appairage/creer` (réservé à l'interface : en-tête `x-clipia-accord: 1`). Le serveur génère un **code d'appairage à usage unique**, aléatoire (≥ 128 bits), valable **2 minutes**, stocké en mémoire (jamais sur disque).
3. Le QR encode une URL : `clipia://pair?h=<adresse1,adresse2>&p=<port>&c=<code>&n=<nom du PC>&v=1` (adresses = IP du réseau local + éventuelle adresse de tunnel publique si l'accès distant est actif). Affiche aussi le code en toutes lettres et un compte à rebours ; bouton « Nouveau QR ».
4. Génère le QR **côté serveur en SVG** (encodeur QR maison, niveau de correction M) ; route `GET /api/appairage/qr.svg?id=…`. Teste qu'un décodeur (zbarimg ou jsQR dans Playwright) relit exactement l'URL.

### Étape 2 — Appairage (serveur)
1. `POST /api/appairage/valider {code, appareil}` (appelé par le téléphone) : vérifie le code (comparaison en temps constant), le **consomme** (impossible de le réutiliser), limite à 5 essais / minute / IP, puis crée un **appareil appairé** : `{id, nom, jeton (≥ 256 bits, stocké haché SHA-256), creeLe, dernierVu}` dans `store`.
2. Renvoie `{jeton, serveur:{nom, version}}` une seule fois. Le jeton remplace le jeton global actuel de l'accès distant : chaque téléphone a **son** jeton, révocable.
3. Côté PC : liste des téléphones appairés (nom, dernière connexion) avec **« Déconnecter »** (révoque le jeton, coupe la connexion en direct) et notification « Nouveau téléphone connecté : … ».
4. Sécurité : écoute sur le réseau local uniquement si l'utilisateur active « Accès téléphone » ; tout appel venant de l'extérieur exige le jeton d'appareil ; refuse tout le reste (comme `estDistant` / `cheminTelephone` aujourd'hui). Aucun secret (clés API, coffre) n'est jamais renvoyé au téléphone.

### Étape 3 — Messagerie temps réel
1. Modèle : `conversations` (une conversation principale « Clipia » + possibilité de plusieurs fils nommés) et `messages {id, convId, role: 'moi'|'clipia', type: 'texte'|'image'|'audio'|'fichier'|'action', texte, fichier, statut: 'envoyé'|'reçu'|'lu'|'erreur', ts}` persistés côté PC (`store`), donc l'historique est le même sur le téléphone et dans l'application desktop.
2. Transport : **Server-Sent Events** `GET /api/chat/flux` (jeton d'appareil) pour recevoir en direct, `POST /api/chat/envoyer` pour émettre. Reprise après coupure (`Last-Event-ID`) et file d'attente hors ligne côté téléphone avec renvoi automatique.
3. À réception d'un message « moi », le serveur passe par **le même cerveau que le chat** (`noyauBoucle.converser`, avec historique des 8 derniers échanges), publie : `reçu` → indicateur **« Clipia écrit… »** → réponse en **flux** (texte qui arrive par morceaux) → `lu`.
4. Pièces jointes : image / photo (caméra de l'APK), note vocale (transcrite par le moteur de transcription disponible), fichier. Les images et clips produits par Clipia reviennent dans la conversation, lisibles et téléchargeables.
5. Actions sensibles (contrôle du PC, commandes) : la réponse contient une **carte « Autorisation requise »** avec boutons Autoriser / Refuser **sur le téléphone** ET sur le PC ; l'accord passe par `noyauMachine.accorder` comme aujourd'hui (jamais auto-accordé).

### Étape 4 — Interface « WhatsApp-like » (APK + PWA)
1. Nouvel écran `app/js/chat-pc.js` (+ styles) : en-tête avec avatar Clipia, nom du PC, pastille **en ligne / hors ligne**, bulles vertes (moi) et blanches/sombres (Clipia) avec heure et coches ✓ ✓✓, séparateurs de jours, zone de saisie arrondie, boutons 📎 (fichier), 📷 (photo), 🎤 (maintenir pour parler), ➤ envoyer, défilement automatique, thème clair/sombre, **mode sombre par défaut**.
2. Liste de conversations (comme la page d'accueil de WhatsApp) : conversation « Clipia », fils créés, recherche, dernier message, non-lus.
3. Rendu : markdown léger, blocs de code avec bouton copier, images/vidéos/audios en ligne, cartes d'action. Réponse vocale facultative (synthèse du téléphone via `ClipiaAndroid`).
4. Accessibilité : contrastes AA, zones tactiles ≥ 44 px, clavier qui ne masque pas la saisie, fonctionne en 360 px de large.
5. Rien d'autre qu'une discussion avec Clipia : pas de contacts, pas d'autres utilisateurs.

### Étape 5 — Côté APK : scan et connexion
1. Écran « Connecter à mon ordinateur » : bouton **Scanner le QR** (caméra via l'API du WebView + `BarcodeDetector`, repli : bibliothèque JS embarquée ; ajoute la permission CAMERA si besoin et gère le refus), ou saisie manuelle de l'adresse + code.
2. Le deep link `clipia://pair?...` ouvre aussi l'appli (intent-filter déjà présent pour `clipia://oauth` : ajoute `pair`).
3. Essaie les adresses dans l'ordre (réseau local d'abord, tunnel ensuite), valide le code, enregistre `{adresses, jeton, nom}` dans le stockage de l'appli (pas en clair dans les logs), puis ouvre la conversation. Reconnexion automatique, bascule local ↔ tunnel selon le réseau.
4. `usesCleartextTraffic` est déjà vrai pour le réseau local ; pour le tunnel, exige HTTPS. Message clair si le PC est éteint / Clipia fermé / pare-feu : « Ton ordinateur est hors ligne — lance Clipia ».

### Étape 6 — Hors du Wi-Fi (facultatif mais prévu)
Option « Accès depuis l'extérieur » : démarre un tunnel (cloudflared / ngrok détecté sur la machine, jamais installé en silence), place l'adresse https dans le QR, avertit l'utilisateur de ce que cela expose, et reste protégé par le jeton d'appareil + limitation de débit.

### Étape 7 — Installeurs, site, versions
Ajoute le tout aux installeurs (Windows/Linux/macOS), incrémente les versions (desktop 8.6.0, APK 8.10.0), mets à jour `liens.json` et la page de téléchargement du site avec une section « Discuter avec ton IA depuis ton téléphone » + courte vidéo / capture.

### Tests obligatoires (tu les écris et tu les lances)
- Le code QR est à usage unique, expire à 2 min, 5 essais max, comparaison en temps constant.
- Un téléphone révoqué ne peut plus ni lire ni écrire (401 immédiat, flux coupé).
- Un message envoyé hors ligne part à la reconnexion, une seule fois (pas de doublon).
- Aucun secret du coffre ne sort ; aucune route sensible sans jeton d'appareil.
- Parcours complet en Playwright : QR affiché → appairage simulé → message → réponse en flux → image reçue.
- `selftest` et build de l'APK verts.

### Rendu final
Tableau : chaque fonction → ✅ testé / ⚠ non testé (et pourquoi). Liste ce qui n'a pas pu être vérifié sur un vrai téléphone (caméra, réseau réel, tunnel).

---

## Choix de conception à connaître
- **Pas de serveur cloud** : le téléphone parle directement à ton ordinateur (réseau local ou tunnel). Rien ne transite par un tiers, mais le PC doit être allumé avec Clipia lancé.
- **Un jeton par téléphone**, révocable depuis le PC.
- **Les accords sensibles restent obligatoires** : même depuis le téléphone, une action sur le PC demande un « Autoriser » explicite.
