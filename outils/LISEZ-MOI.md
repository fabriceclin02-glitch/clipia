# Publier et mettre à jour le site Clipia

## Mettre à jour une version (2 minutes)
1. Installe GitHub CLI une fois : `winget install GitHub.cli`, puis `gh auth login`.
2. Dans le dossier du dépôt du site : `.\outils\publier-version.ps1 -Version 7.0.1 -Dossier "C:\...\Clipia-V7.0.1"`
   (macOS/Linux : `outils/publier-version.sh 7.0.1 /chemin/Clipia-V7.0.1`).
3. Le script crée la Release GitHub (gros fichiers, pas de limite de 100 Mo), calcule les empreintes SHA-256, met à jour `liens.json` et publie. Le site affiche la nouvelle version en 1 à 2 minutes.

## Brancher ton nom de domaine (.fr / .com)
1. Réserve le domaine chez OVH, Gandi, Namecheap… (l'extension « .ia » n'existe pas ; l'extension IA est « .ai »).
2. Chez le registrar, ajoute les enregistrements DNS :
   - 4 × **A** sur `@` : 185.199.108.153 · 185.199.109.153 · 185.199.110.153 · 185.199.111.153
   - 1 × **CNAME** sur `www` : fabriceclin02-glitch.github.io
3. GitHub → dépôt → Settings → Pages → *Custom domain* : saisis ton domaine, puis coche *Enforce HTTPS* (le certificat arrive en quelques minutes à 24 h).
4. Ajoute un fichier `CNAME` à la racine du dépôt contenant uniquement ton domaine (ex. `clipia.fr`).

## Compter les visites et les téléchargements (gratuit, sans cookies)
1. Crée un compte sur goatcounter.com (choisis un code, ex. `clipia`).
2. Dans `index.html`, remplis `<meta name="goatcounter" content="clipia">` avec ton code, puis publie. Les clics de téléchargement sont comptés comme événements.
3. Les téléchargements des Releases GitHub ont aussi leur propre compteur, visible sous chaque fichier de la Release.
