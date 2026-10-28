# Installer Clipia — pas à pas

Clipia s'ouvre dans ton navigateur (adresse `http://127.0.0.1:8787`) et tourne **sur ta machine**.
Les installeurs embarquent leur propre Node.js : tu n'as rien d'autre à installer.

| Système | Fichier | Taille approx. |
|---|---|---|
| Windows 10/11 (64 bits) | `Clipia-Setup-1.2.1-windows-x64.exe` | ~35 Mo |
| Windows 10/11 — **portable**, sans installation | `Clipia-Portable-1.2.1-windows-x64.zip` | ~45 Mo |
| Linux Debian / Ubuntu / Mint (64 bits) | `clipia_1.2.1_amd64.deb` | ~40 Mo |
| macOS | `Clipia-1.2.1-macos.zip` (conseillé) ou `Clipia-1.2.1-macos.dmg` | ~55 Mo |

## 1. Installer

### Windows
1. Double-clique `Clipia-Setup-1.2.1-windows-x64.exe`. Aucun droit administrateur n'est demandé.
2. Si Windows affiche « Windows a protégé votre ordinateur » : **Informations complémentaires → Exécuter quand même** (l'installeur n'est pas signé par un éditeur payant).
3. Suis les écrans (Suivant → Installer → Terminer). Un raccourci **Clipia** apparaît sur le Bureau et dans le menu Démarrer.
4. Lance **Clipia** : le navigateur s'ouvre sur l'application au bout de ~3 secondes.
5. Pour arrêter : menu Démarrer → **Quitter Clipia**.

### Linux (Debian, Ubuntu, Mint…)
```bash
sudo apt install ./clipia_1.2.1_amd64.deb
clipia            # ou cherche « Clipia » dans le menu des applications
```
Désinstaller : `sudo apt remove clipia` (tes projets restent dans `~/.local/share/clipia`).
Autres distributions : `ar x clipia_1.2.1_amd64.deb && tar xf data.tar.*` puis lance `opt/clipia/bin/clipia`.

### macOS
1. Dézippe `Clipia-1.2.1-macos.zip`, glisse **Clipia.app** dans *Applications* (ou ouvre le `.dmg` et fais-le glisser).
2. Premier lancement : **clic droit sur Clipia → Ouvrir → Ouvrir** (l'app n'est pas notariée Apple).
3. Si macOS dit que l'app est endommagée : dans le Terminal, `xattr -dr com.apple.quarantine /Applications/Clipia.app`.
4. Clipia utilise le Node.js du système s'il est ≥ 20, sinon celui qui est embarqué (version Intel : sur Mac Apple Silicon, macOS peut proposer d'installer Rosetta).
5. Pour arrêter : ferme l'onglet puis, dans le Terminal, `curl -X POST -H "x-clipia-accord: 1" http://127.0.0.1:8787/api/systeme/quitter`.

## 2. Premier lancement — rendre Clipia « prêt à l'emploi »

Au premier démarrage, Clipia regarde ta machine et te propose **une préparation en un clic** :

1. **IA gratuites hors ligne (recommandé).** Installe [Ollama](https://ollama.com/download) (gratuit). Clipia détecte ensuite ta mémoire (RAM) et propose les modèles qui tiennent : p. ex. 8 Go → `phi3.5:3.8b`, 16 Go et plus → `qwen3:8b`, plus un modèle minuscule de secours et un modèle de mémoire. Clique **« Oui, prépare tout »** : les téléchargements s'affichent avec une barre de progression. Rien n'est téléchargé sans ton accord.
2. **IA gratuites en ligne (sans carte bancaire).** Menu **Coffre de clés** → crée une clé gratuite chez Groq, Google Gemini, OpenRouter (modèles `:free`), GitHub Models, Cerebras… et colle-la. Pollinations (texte et image) marche **sans clé**.
3. **IA payantes.** Même écran **Coffre de clés** : colle ta propre clé OpenAI, Anthropic, Mistral, DeepSeek, xAI, Stability, Runway, Luma, ElevenLabs, Suno, fal, Replicate…. Clipia ne peut pas fournir ces clés : elles sont liées à ton compte et à ta facturation. Elles sont chiffrées sur ta machine.
4. **OpenRouter.** Ajoute ta clé OpenRouter dans le Coffre de clés (il existe des modèles `:free`). Le catalogue en direct, gratuits d'abord, est lisible à `http://127.0.0.1:8787/api/openrouter/catalogue` quand Internet est disponible.
5. **OpenClaw (agents).** Optionnel. Il demande Node.js 26 : `npm install -g openclaw`, puis `openclaw onboard`. Choisis ton modèle, puis donne à Clipia le jeton de la passerelle (variable `OPENCLAW_GATEWAY_TOKEN` ou Coffre de clés, fournisseur « openclaw »). La version « clé USB » de Clipia contient OpenClaw déjà installé.

## 3. Utiliser

- **Clipia (accueil)** : parle ou écris. Gros bouton micro pour la conversation vocale. Le moteur est choisi automatiquement (**Auto**), ou à la main dans la liste.
- **Projets & agents** : crée des projets qui restent enregistrés, des agents et des sous-agents, lance-les, reprends un travail interrompu. Un agent n'a **jamais** accès à ta machine ni à ton navigateur sauf si tu coches ces groupes.
- **Accès machine & navigateur** : désactivé par défaut. Les actions sensibles demandent ton accord, un par un.
- **Création** : image, vidéo, musique, voix, paroles, livres… selon les moteurs que tu as connectés. Clipia n'ajoute aucune limite de contenu ; les fournisseurs appliquent chacun leur politique.

## 4. Où sont mes données ?

| Système | Dossier |
|---|---|
| Windows | `%APPDATA%\Clipia` |
| Linux | `~/.local/share/clipia` |
| macOS | `~/Library/Application Support/Clipia` |

Sauvegarde = copier ce dossier. Réinstaller ou mettre à jour ne l'efface pas.

## 5. Problèmes courants

| Symptôme | Solution |
|---|---|
| Rien ne s'ouvre | Ouvre à la main `http://127.0.0.1:8787`. |
| « Port déjà utilisé » | Clipia tourne déjà (ouvre l'adresse ci-dessus), ou lance avec `PORT=8790`. |
| « Clé manquante pour… » | Choisis **Auto** ou un moteur local, ou ajoute la clé dans Coffre de clés. |
| Aucun modèle local | Installe Ollama, relance Clipia, clique « Oui, prépare tout ». |
| Montage vidéo indisponible | Installe FFmpeg (`sudo apt install ffmpeg`, `brew install ffmpeg`, ou ffmpeg.org). |

## Construire les installeurs soi-même
`bash installers/build-all.sh` (nécessite `makensis`, `dpkg-deb`, `xorriso`, `zip`, `npm`). Les installeurs sont produits dans `dist/`.


## Version portable Windows (sans installation)
Dézippe `Clipia-Portable-1.2.1-windows-x64.zip` où tu veux (même une clé USB), double-clique **Clipia.exe**. Rien n'est installé ni écrit dans le registre ; tes données restent dans le dossier `donnees` à côté. `Quitter-Clipia.exe` arrête Clipia.

## Appeler Clipia à la voix (mode appel)
Dans la zone de saisie, clique sur **📣** : dis « Clipia », elle fait un bip, répond « Oui ? » et écoute. Tu peux aussi tout dire d'un trait : « Clipia, fais-moi un clip ». Ce mode utilise la reconnaissance vocale de **Chrome ou Edge** (le service du navigateur transcrit ; ce n'est pas 100 % hors ligne). Clique à nouveau sur 📣 pour le couper.

## Clipia OS (système sur clé USB)
Voir `GUIDE-CLIPIA-OS.md` : système Linux complet (base Ubuntu 24.04) qui démarre depuis une clé USB, avec Clipia intégrée.


## Nouveautés de la V3

- **Conversations = projets** : chaque échange est enregistré tout seul et rangé à gauche ; clique pour le reprendre, même après un redémarrage.
- **Guide pas à pas** : pour une tâche (clip, installation…), Clipia donne des étapes cochables et précises, sauvegardées avec la conversation.
- **Assistant de démarrage** : clé Groq gratuite (test avant activation) ou Qwen en local via Ollama.
- **Modèles locaux recommandés selon la RAM** (Qwen 3, DeepSeek R1, Gemma 3) ; les modèles minuscules ne sont plus choisis par défaut.
- **Correcteur d'orthographe** en français dans toutes les zones de saisie.
- **OpenClaw** : page d'aide `/openclaw.html` (exige Node.js 24.22 ou plus récent).

## Nouveautés de la V4 — ton agent personnel

- **Installation guidée** (menu « Installation guidée ») : Groq, Qwen local, Claude, Claude Code, images, vidéo, musique, voix, extension Chrome. Un seul bouton « Tout installer d'un coup » ; pour les clés, Clipia te guide pas à pas et les teste.
- **Animation « Bonjour, je suis configuré »**, puis un questionnaire (tutoiement, style : ami, entrepreneur, direct…, ce que tu fais, tes objectifs). Tout est enregistré ; en disant « Clipia », elle te répond dans le style choisi.
- **Créer mon IA** : agents, sous-agents, workflows, projets enregistrés ; reprise des conversations passées.
- **Contrôle de l'ordinateur** : souris, clavier, applications, captures d'écran — uniquement après ton autorisation (10 minutes), arrêt d'urgence à tout moment, jamais de mot de passe ni de carte.
- **Extension Chrome** : dossier « extension-chrome » (Clipia l'ouvre pour toi). Chrome → chrome://extensions → Mode développeur → Charger l'extension non empaquetée. Chrome n'autorise pas l'installation automatique d'une extension depuis un programme : ces 4 gestes sont obligatoires.

## V6
- Premier lancement : assistant plein écran « Bonjour, je suis Clipia » (animation 3D), 7 étapes : Groq, modèles locaux (Ollama/Qwen), sous-agents, accès à l'ordinateur (cases), compétences OpenClaw, installation, puis « Comment veux-tu que nous discutions ? ».
- Menu « Comment te parler » et Configuration : styles (ami, entrepreneur, créateur, psychologue, coach…), création de ses propres styles, accès cochables, import des compétences OpenClaw.
- Mode psychologue : carnet de séances local (effaçable). Soutien, pas un avis médical ; 3114 en cas de détresse.
