# Prompt complet — faire fonctionner Clipia de A à Z

À coller tel quel dans Clipia (chat) ou dans Claude sur ton PC. Il est écrit pour que l'IA fasse chaque étape **elle-même**, vérifie le résultat, et ne dise « c'est fait » que si elle l'a constaté.

---

## LE PROMPT

Tu es mon technicien Clipia. Ton but : que TOUT fonctionne sur mon ordinateur — génération d'images, de musique, de voix, de clips, prise en main du PC, agents, et pilotage par Telegram / Slack / WhatsApp. Tu avances étape par étape. Pour chaque étape : tu agis, tu VÉRIFIES avec un outil (fichier créé, commande réussie, réponse reçue), puis tu me dis en une ligne « ✅ fait » ou « ❌ bloqué parce que… + ce que je dois faire ». Tu ne passes pas à l'étape suivante tant que la précédente n'est pas verte, sauf si elle est marquée « facultative ». Tu ne tapes jamais de mot de passe ni de numéro de carte : si une clé ou un mot de passe est nécessaire, tu me dis exactement où cliquer et je le saisis moi-même.

**Étape 0 — Lancer l'audit.** Lance `AUDIT-CLIPIA.bat` (Menu Démarrer → Clipia → « Audit complet Clipia », ou `node scripts/audit-complet.mjs`). Lis `Audit-Clipia.txt`. Établis la liste des ✗. Corrige-les dans l'ordre ci-dessous. À la fin, relance l'audit : l'objectif est « Tout est bon ».

**Étape 1 — Réseau.** Si une ligne « Réseau : … INJOIGNABLE » est rouge : vérifie le pare-feu Windows, l'antivirus, le VPN/proxy. Autorise `node.exe` (dossier `runtime`) en sortie. Teste `https://image.pollinations.ai` et `https://api.telegram.org` dans le navigateur. Sans Internet, seuls les moteurs locaux (Ollama) et le montage local fonctionnent.

**Étape 2 — Cerveau (texte).** Réglages → Moteurs. Mets au moins UN moteur qui répond : Groq (gratuit, clé sur console.groq.com), ou Ollama installé en local (`ollama pull qwen2.5:7b`), ou GLM-5.2 de Z.ai. Clique « Tester ». Vérifie qu'une phrase revient. Un modèle minuscule (moins de 3 milliards de paramètres) ne sait pas utiliser les outils : choisis plus gros.

**Étape 3 — Images.** Studio → génère une image. Si tu vois « carte colorée utilisée », lis la raison affichée entre parenthèses :
- `fetch failed` / `Pollinations a répondu 5xx` → service gratuit saturé ou bloqué : réessaie, ou ajoute une clé (OpenAI Images, Stability, fal.ai, Replicate) dans Réglages → Clés.
- `clé absente` / `401` → la clé est fausse ou vide.
Vérifie qu'un vrai fichier image existe dans `Documents\Clipia\media` (ou le dossier de données) et qu'il s'ouvre.

**Étape 4 — Voix et musique.** Voix : le moteur gratuit (Pollinations Voix) suffit ; teste « dis bonjour ». Musique : il faut une clé Suno (payant) — c'est facultatif. Transcription : clé Groq (Whisper, gratuit) — facultatif.

**Étape 5 — Vidéo.**
- Sans clé : utilise « Clip » → mode local. Il fabrique un vrai clip (visualiseur calé sur le tempo de ton audio) avec FFmpeg uniquement. Teste avec un fichier mp3/wav de ton choix. Vérifie que le .mp4 se lit.
- Avec clé (Runway, Luma, fal.ai) : Vidéo → décris un plan → Générer. Le rendu prend 1 à 5 minutes ; le fichier est téléchargé tout seul à la fin.
- Si « FFmpeg introuvable » : réinstalle Clipia (il l'inclut) ou `winget install Gyan.FFmpeg`, puis relance.

**Étape 6 — Prise en main de l'ordinateur.** Dis « ouvre le Bloc-notes et écris bonjour ». Une carte « Autoriser (10 minutes) » doit apparaître : clique-la. Vérifie que le Bloc-notes s'ouvre et que le texte apparaît. Ensuite : « montre-moi les fenêtres ouvertes », « fais une capture d'écran ». Arrêt d'urgence : dis « stop » ou clique « Arrêter ». Sur Mac : Réglages Système → Confidentialité → Accessibilité et Enregistrement d'écran → autorise Clipia/Node. Sur Linux : `sudo apt install xdotool wmctrl scrot`.

**Étape 7 — Agents.** Atelier → Agents. L'agent « Assistant PC » existe déjà (souris, clavier, navigateur, commandes). Pour un agent à toi : coche les groupes d'outils dont il a besoin — « ordinateur » pour agir sur le PC, « machine » pour les fichiers/commandes, « navigateur » pour le web. Donne-lui une tâche concrète, vérifie dans « Exécutions » qu'il a utilisé les outils (preuves). Un sous-agent ne peut pas demander ton accord : autorise d'abord une session de contrôle (étape 6) puis lance la tâche. Si un agent « ne fait rien », ouvre son exécution : la dernière ligne dit quel outil a été refusé et pourquoi.

**Étape 8 — Telegram (le plus simple).**
1. Dans Telegram, parle à @BotFather → `/newbot` → note le jeton.
2. Clipia → Connexions → Telegram → colle le jeton → Enregistrer.
3. Écris `/start` à ton bot : il te répond ton identifiant numérique.
4. Clipia → Pilotage à distance → ajoute cet identifiant dans « Autorisés ».
5. Clique « Démarrer » (il redémarre tout seul ensuite à chaque lancement de Clipia).
6. Test : écris au bot « génère une image d'un chat » puis « /etat ».

**Étape 9 — Slack.**
1. api.slack.com/apps → Create New App → From scratch.
2. Socket Mode : activé → crée un jeton d'application (`xapp-…`, scope `connections:write`).
3. OAuth & Permissions → scopes bot : `chat:write`, `im:history`, `app_mentions:read` → Install → copie le jeton `xoxb-…`.
4. Event Subscriptions : activé → bot events `message.im` et `app_mention`.
5. App Home → autorise les messages privés.
6. Clipia → Connexions → Slack : colle `xoxb-` ET `xapp-`. Ajoute ton identifiant Slack (Profil → ⋯ → Copier l'ID du membre) dans les autorisés. Démarre.
7. Test : message privé au bot « /etat ».

**Étape 10 — WhatsApp (le plus contraignant).** Meta n'appelle que des adresses publiques : ton PC doit être joignable. Facultatif si Telegram te suffit.
1. developers.facebook.com → app « Business » → ajoute WhatsApp → note le jeton, l'ID du numéro, et le secret de l'app.
2. Expose Clipia : `cloudflared tunnel --url http://127.0.0.1:8787` (ou ngrok) → tu obtiens une adresse https publique.
3. Webhook Meta : `https://<adresse>/api/webhooks/whatsapp`, jeton de vérification = celui que tu as mis dans Clipia ; abonne le champ `messages`.
4. Clipia → Connexions → WhatsApp : jeton, ID du numéro, secret, jeton de vérification. Ajoute ton numéro (format international sans +) dans les autorisés.
5. Test : envoie « bonjour » depuis ton téléphone.

**Étape 11 — Interactivité.** Pour chaque canal (chat, Telegram, Slack, WhatsApp) envoie : « génère une image de… », « ouvre le Bloc-notes », « où en sont mes productions ? ». Une action sensible depuis un canal distant te répond « ⏸ autorise-la sur ton ordinateur » : clique « Autoriser » dans Clipia, puis redemande. Vérifie que les images produites te reviennent dans la conversation.

**Étape 12 — Bilan.** Relance l'audit. Donne-moi un tableau final : chaque fonction → ✅ / ❌ / ⚪ facultative non configurée, avec pour chaque ❌ la cause exacte et l'action qui me reste. Joins `Audit-Clipia.txt`.

---

## Ce qui est impossible ou limité (à savoir)
- Sans Internet ni clé, la **génération d'images/vidéos par IA** n'existe pas : seul le clip local (visualiseur) marche.
- La **vidéo IA** (Runway, Luma, fal) est payante.
- **WhatsApp** exige une adresse publique et un compte Meta Business ; Telegram et Slack (Socket Mode) n'en ont pas besoin.
- Clipia ne **voit** une capture d'écran que si le moteur choisi sait lire les images.
- Les **actions sensibles** (contrôle du PC, commandes) demandent toujours ton accord dans l'interface : voulu, par sécurité.
