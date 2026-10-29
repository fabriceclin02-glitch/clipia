<div align="center">

# CLIPIA X8
### Studio créatif IA — CLENDAX
*Une idée. Tout est possible.*

</div>

---

Clipia transforme une musique en clip vidéo complet, génère vos visuels, écrit vos textes et publie sur vos plateformes. Il parle à **37 moteurs IA** — payants, gratuits, ou tournant entièrement sur votre machine — et se branche à **29 services** via OAuth.

**Il fonctionne sans aucun abonnement IA.** Ollama + ComfyUI + whisper.cpp + FFmpeg en local, et vous produisez des clips illimités, gratuitement, hors ligne.

---

## Démarrer en 30 secondes

```bash
node server/index.js
```

Puis ouvrez **http://127.0.0.1:8787**. Aucune installation npm, aucune dépendance : Node 20+ suffit.

Si vous préférez un installateur qui met aussi Node, FFmpeg et Ollama en place :

| Système | Commande |
|---|---|
| Windows | clic droit sur `installers\installer-windows.ps1` → Exécuter avec PowerShell |
| macOS / Linux | `bash installers/installer-unix.sh` |
| Docker | `docker compose up -d` (Clipia + Ollama inclus) |

---

## Ce que fait Clipia

### Musique → Clip
Déposez un MP3. Clipia enchaîne sept étapes :

1. **Analyse** — durée, BPM, temps forts, via FFmpeg
2. **Paroles** — transcription horodatée mot à mot (Whisper, AssemblyAI, Deepgram ou whisper.cpp local)
3. **Scénario** — un LLM découpe le morceau en plans visuels datés
4. **Visuels** — génération de chaque plan (Flux, SDXL, DALL·E, ou ComfyUI local)
5. **Animation** — image→vidéo (Luma, Runway, Kling) ou **Ken Burns local, gratuit**
6. **Montage** — assemblage synchronisé, karaoké incrusté, étalonnage, vignettage
7. **Export** — 16:9 YouTube · 9:16 TikTok/Shorts/Reels · 1:1 Instagram · 2.35:1 cinéma

### Le reste du studio
- **Klipia, l'assistant** — conversation streamée avec n'importe quel modèle
- **Image et 3D** — visuels, pochettes, maquettes de t-shirts, fiches produit
- **Vidéo** — plans générés à la demande
- **Paroles et voix** — transcription karaoké, voix off multilingue
- **Workflows** — enchaînements automatiques : clip → extrait vertical → publication partout
- **Médiathèque, file de tâches, quotas, abonnements**

---

## Les 37 moteurs IA

<table>
<tr><th>Cloud</th><th>Local — gratuit</th></tr>
<tr valign="top"><td>

OpenAI · Anthropic Claude · Google Gemini · Mistral · DeepSeek · Groq · OpenRouter · Together · Fireworks · xAI Grok · Perplexity · Cohere · Qwen · Hugging Face · Stability · fal.ai · Replicate · Runway · Luma · ElevenLabs · AssemblyAI · Deepgram · Suno

</td><td>

**Ollama** · LM Studio · llama.cpp · vLLM · Jan.ai · LocalAI · Text-Gen WebUI · **ComfyUI** · Automatic1111 · **whisper.cpp** · **FFmpeg**

</td></tr>
</table>

Ajouter un moteur n'est qu'une ligne dans `server/providers/registry.js` : tout serveur compatible OpenAI marche sans écrire une seule ligne de code supplémentaire.

---

## Les 29 connecteurs

| Groupe | Services |
|---|---|
| **Diffusion** | YouTube, TikTok, Instagram, Facebook, X, Twitch, LinkedIn, Pinterest, Reddit |
| **Musique** | Spotify, SoundCloud, Bandcamp, distribution |
| **Stockage** | Google Drive, Dropbox, Notion, S3 (et R2, B2, MinIO) |
| **Boutique** | Etsy, Shopify, Printful |
| **Paiement** | Stripe, PayPal, Lemon Squeezy |
| **Outils** | GitHub, Discord, Slack, webhook générique, SMTP, serveur MCP |

Un seul moteur OAuth générique les gère tous (PKCE, rafraîchissement de jetons, stockage chiffré). Déclarez cette URL de redirection dans chaque console développeur :

```
http://127.0.0.1:8787/api/connectors/callback
```

---

## Sécurité

- **Coffre AES-256-GCM** — les clés sont chiffrées au repos dans `data/vault.enc`. Le navigateur ne reçoit jamais une valeur, seulement un indice masqué (`sk-a••••••••7890`).
- **Clé maîtresse** générée au premier lancement dans `data/secrets.json`, en permissions `600`.
- **Aucune clé dans le front** — tous les appels aux fournisseurs partent du serveur.
- **Webhooks Stripe** vérifiés par HMAC avec comparaison à temps constant et fenêtre de 5 minutes.
- **Webhooks sortants** signés `X-Clipia-Signature`.

---

## Déploiement

| Cible | Dossier | Commande |
|---|---|---|
| Serveur / VPS | racine | `node server/index.js` derrière Caddy ou Nginx |
| Docker | racine | `docker compose up -d` |
| Windows / Mac / Linux | `desktop/` | `npm install && npm run build:win` (ou `:mac`, `:linux`) |
| Android / Play Store | `android/` | voir `android/README.md` |
| Navigateur (PWA) | — | menu du navigateur → « Installer l'application » |

---

## API

Tout ce que fait l'interface passe par HTTP — pilotez Clipia depuis n8n, Make, un script ou un agent IA.

```bash
curl -X POST http://127.0.0.1:8787/api/taches \
  -H "content-type: application/json" \
  -d '{"type":"clip","payload":{
        "audioPath":"/chemin/morceau.mp3",
        "style":"néon nocturne, grain argentique",
        "ratio":"tiktok",
        "llm":{"provider":"ollama","model":"llama3.3"},
        "imageProvider":"comfyui"}}'
```

Routes principales : `/api/etat` · `/api/fournisseurs` · `/api/chat` (SSE) · `/api/coffre` · `/api/connecteurs` · `/api/taches` (+ `/flux` en SSE) · `/api/medias` · `/api/abonnement` · `/api/webhooks/stripe`

---

## Structure

```
clipia/
├─ server/              Backend Node, zéro dépendance
│  ├─ lib/              env · coffre chiffré · stockage
│  ├─ providers/        registre 37 moteurs · passerelle · média
│  ├─ connectors/       manifestes 29 services · OAuth · publication
│  ├─ pipelines/        musique → clip
│  ├─ jobs/             file de tâches + exécuteurs
│  └─ billing/          abonnements Stripe
├─ web/                 Interface du studio (PWA)
├─ desktop/             Electron — Windows, macOS, Linux
├─ android/             Capacitor — Play Store
├─ installers/          Scripts PowerShell et Bash
├─ docs/                Architecture, confidentialité, démarrage
└─ data/                Coffre, base, médias (jamais versionné)
```

---

<div align="center">

**Clin Fabrice — CLENDAX** · Flize, Ardennes
[fabriceclin02@gmail.com](mailto:fabriceclin02@gmail.com)

</div>


## Nouveautés de Clipia X8 (8.2.0) — « deux cerveaux »
- **8.2.0** : **Sauvegarder mon IA** (fichier `.clipiabak` chiffré par mot de passe → clé USB, dossier Dropbox/MEGA, Dropbox direct ; réimport complet, l'ancien contenu est mis de côté), **agent plus autonome** (jamais deux fois la même action, vérification avant de conclure, échelle de secours, initiatives proposées sur l'accueil), **extension Chrome** mise en avant, **QR codes iPhone/Android** (sphère 3D sur le téléphone), accueil « vitrine » (MP3 → clip, chanteur/chanteuse virtuel, Publier partout, moteurs de clip : Canva et open source, Visual Studio Code), connecteurs **Telegram, Slack et WhatsApp** refaits (signatures vérifiées, anti-rejeu, Slack en mode Socket sans adresse publique, commandes `/etat` `/travail` `/stop`) ; **client MCP** (branche n'importe quel outil MCP, accord à chaque appel) ; **tâches planifiées** (routines lancées en arrière-plan) ; détection d'injection renforcée ; correctif : le bouton de dictée ne recouvre plus « Envoyer ».

- **Deux cerveaux** : Clipia est *toujours* disponible (texte ou voix) pendant que ses **travaux tournent en arrière-plan** (jusqu'à 3 en parallèle, chacun avec son journal et son flux en direct).
- **Réponses instantanées sans attendre** : « sur quoi tu travailles ? », « explique-moi ce que tu fais », « arrête », « mets en pause » sont traités tout de suite, même en plein travail.
- **Annonces vocales polies** : Clipia te prévient quand un travail avance ou se termine, mais attend que tu aies fini de parler.
- **Lancer d'autres projets en parallèle** par la voix ou le chat ; un travail en arrière-plan ne peut pas en lancer un autre (pas d'emballement) et les accords sensibles ne se donnent que depuis l'interface.
- **Pause / reprise** : un travail qui attend ton accord se met en pause et reprend après ton clic ; au redémarrage, les travaux interrompus sont repris proprement.
- **Entreprise** (nouveau menu) : 10 missions prêtes (étude de marché, offre, business plan, site vitrine, devis/factures, démarches, prospection, réseaux sociaux, aide aux autres…), 10 nouvelles compétences et 4 nouveaux agents.
- **Communauté** (nouveau menu) : propose une idée en un clic (ouvre le formulaire GitHub), vérifie les mises à jour, retrouve toutes les versions.
- **Évolution via GitHub** : idée → validation du propriétaire (label `approuvé`) → agent d'évolution → tests → Pull Request → relecture humaine → nouvelle version publiée ; les anciennes versions restent téléchargeables. Voir `CONTRIBUTING.md`.
- **Logithèque élargie** (cochable à l'installation) : LibreOffice, Pandoc, Tesseract, ImageMagick, Joplin, KeePassXC, Thunderbird, Scribus, yt-dlp, faster-whisper, modèles locaux Qwen / Llama / Nomic, n8n, et liens Odoo, Cal.com, Penpot, Nextcloud, guichet des entreprises.
- `node scripts/selftest.mjs` : auto-test sans dépendance (syntaxe, garde-fous de l'agent d'évolution, démarrage du serveur).

## Nouveautés de Clipia X7 (7.0.1)
- **Studio montage** (vidéo + musique) : un prompt → scènes, images, musique ; timeline, texte, filtres, export MP4.
- **Skills & extensions** : cerveaux gratuits de Google (Gemini via AI Studio, Gemma local), méthodes activables, clés dans le coffre chiffré.
- **Résoudre un problème** : message d'erreur ou capture d'écran → cause, étapes, ce qu'il faut réinstaller, réparation en un clic.
- **Conseil** à chaque réponse, et une **solution** sous chaque erreur.
- **Atelier d'apps** : sites web complets, applications, jeux, par une équipe d'agents qui teste avant de livrer.
- Le temps offert (2 h, puis 5 €/h) ne concerne **que le cabinet de psychologues** ; tout le reste est libre.
- Elle ne prononce plus son propre nom : « Clipia » ne peut venir que de toi pour l'interrompre.
- **Écoute permanente + sphère 3D plein écran** (interactive) pendant l'écoute et la parole ; elle disparaît quand Clipia travaille. Stop à la voix (« stop », « OK », « Clipia tais-toi », « Clipia »), filtre anti-écho.
- **Dictée partout** : un bouton 🎙 sur chaque champ de chaque section + pastille Clipia visible hors chat.
- **Logithèque** : logiciels libres (musique, vidéo, image, code, IA locale, Google, Tailscale, cloudflared, OpenClaw) installés pas à pas, et cochables dans l'installeur Windows.
- **Commandes sur l'ordinateur** : ouvrir/fermer des fenêtres (« ferme la fenêtre de gauche »), lancer des programmes, installer des logiciels, créer un site/une application (accord requis pour le sensible ; jamais de mot de passe ni de carte).
- **Mode autopilote** : décomposition, exécution, vérification de chaque étape, repli sur une autre voie, mémoire de ce qui a marché, workflows et agents.
- **Pont OpenClaw** (menu « Pont OpenClaw ») : 50 compétences officielles d'OpenClaw (licence MIT, © OpenClaw Foundation, dossier `server/noyau/openclaw-skills/`) livrées avec Clipia, détection de ton OpenClaw local (prioritaire), import en un clic, outils `openclaw_savoirs` et `openclaw_cli` (état, modèles, `agent exec` avec accord).
- **Téléphone & MCP** (menu « Téléphone & MCP ») : désactivé par défaut ; jeton secret dans le coffre ; appli installable (`/telephone`, QR code) ; serveur MCP `/mcp` (outils `clipia_demander`, `clipia_etat`, `clipia_competences`). Toute requête qui ne vient pas de l'ordinateur lui-même (autre IP, tunnel, autre nom d'hôte) n'atteint que ces chemins, avec le jeton. Hors de chez soi : Tailscale ou Cloudflare Tunnel (Logithèque).
- Limite assumée : Clipia n'est pas « sans censure » ; les modèles gardent leurs règles (utilise un modèle local ouvert si tu veux plus de liberté) et les actions sensibles demandent ton accord.
- **Promotion en 1 clic** (7.0.1) : agent « Promoteur » + compétence « Promotion de Clipia » ; il prépare et remplit dans ton Chrome, et demande ton accord avant chaque publication.
