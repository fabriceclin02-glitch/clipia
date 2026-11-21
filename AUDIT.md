# Audit Clipia — 21 novembre 2026 (base X10)

Audit du dépôt `clipia` avant la version **Clipia X10 10.3.0**, **Clipia Nova 2.6.0** et **APK téléphone 8.11.0**.

## 1. Ce qui était cassé (corrigé dans cette version)

| Problème | Effet pour l'utilisateur | Correction |
|---|---|---|
| Groq a retiré `llama-3.3-70b-versatile` et `llama-3.1-8b-instant` (16 août 2026) et `qwen/qwen3-32b` (17 juillet 2026) | Le cerveau gratuit par défaut (Groq) ne répondait plus dans l'appli téléphone et dans Clipia Nova | Remplacés par `openai/gpt-oss-120b`, `qwen/qwen3.6-27b`, `openai/gpt-oss-20b` |
| DeepSeek a retiré `deepseek-chat` et `deepseek-reasoner` (24 juillet 2026) | Erreur avec une clé DeepSeek | `deepseek-v4-flash` et `deepseek-v4-pro` |
| Gemini 2.5 réservé aux anciens utilisateurs | Une nouvelle clé Gemini pouvait être refusée | `gemini-flash-latest`, `gemini-3.8-flash`, `gemini-4-argon` |
| Kimi : `kimi-k2-0905-preview` ancien | — | `kimi-k3` (nouveau moteur aussi dans Nova) |
| Moteurs `cerebras` et `sambanova` déclarés deux fois | Entrées en double, la seconde n'était jamais utilisée | Doublons supprimés (62 moteurs) |
| Le site Clipia avait pris la sphère de Nova (anneaux verts, `clipia-fx.js`) | Logo/sphère différents de l'original voulu | Sphère et logo d'origine X10 rétablis |
| Deux sections avec le même identifiant `telephone` sur le site | Ancre ambiguë | La seconde devient `appli-telephone` |
| Le texte de la vidéo d'accueil parlait de la voix « Kodi » | Contradiction : le mot d'appel est « Clipia » | Corrigé |

## 2. Ce qui sert (gardé)

- `index.html` (site Clipia X10), `nova.html` (onglet Clipia Nova), `communaute/` (chat), `app/` (appli téléphone/PWA), `android/` (APK Clipia), `nova/` (navigateur), `source/` (Clipia X10 ordinateur), `kodi/` (dépôt Kodi Clipia), `store/`, `depot-ia/`, `social/`, `google/`.
- `telechargements/` : installeurs X10 et APK. `liens.json` alimente les boutons du site.
- Pages `developpeur.html`, `cabinet.html`, `cgv.html`, `merci.html`, `acheter.html` (redirige vers l'option développeur).
- Workflows GitHub : `pages.yml` (site), `apk.yml` (APK), `nova.yml` (Nova 4 plateformes), `release.yml` (Release X10), `ci.yml`, `store-verif.yml`, `evolution.yml`.
- Vidéos : X10 présentation, X10 installation, Kodi V1, Kodi voix, Clipia OS, Projets, Nova, et les 5 vidéos d'origine remises (téléphone, Kodi, code/GLM, touche Espace, tout installer).

## 3. Ce qui ne sert pas ou plus (signalé, non supprimé)

- `proposition-deal-connection/` et `proposition-dl-outillage/` (22 Mo) : maquettes pour des clients, sans rapport avec Clipia. Gardées pour ne pas casser les liens déjà envoyés ; à déplacer dans un dépôt à part.
- `source-x8-videos/` : scripts de fabrication des anciennes vidéos ; dépendent de fichiers absents (`/home/claude/lab/...`), donc inutilisables tels quels.
- Images jamais affichées : `img/og-x8.jpg`, `img/poster-v6.jpg`, `img/orbe.jpg`, `img/x8-mcp.jpg`, `img/x8-planning.jpg`, `img/x8-sauvegarde.jpg`, `img/x8-tiktok.jpg`, `img/x8-atelier-projets.jpg`, `img/qr-app.svg`, et une partie des captures numérotées `img/13` à `img/27`.
- `PUBLIER.md` parle de MEGA alors que tout est hébergé sur GitHub : obsolète.
- `_journal/derniere-compilation.txt` : journal d'un échec de compilation APK du 30 octobre, déjà réglé : **supprimé**.

## 4. Points qui restent à faire (non vérifiés ici)

- Les 5 vidéos d'origine : les écrans titres « X8/X9 » ont été recouverts par des cartes « X10 », mais la **voix off** peut encore dire l'ancien nom, et de petites captures d'écran à l'intérieur (ex. « Installation de Clipia X8 » dans « Tout installer ») montrent encore l'ancien numéro.
- Aucun appel réel n'a été fait aux nouveaux modèles (pas de clé API ici) : les identifiants viennent de la documentation des fournisseurs.
- Le fichier `.dmg` macOS est fabriqué sous Linux et n'a jamais été testé sur un vrai Mac.
- Mac et Linux : non signés ; Windows affiche l'avertissement SmartScreen.
