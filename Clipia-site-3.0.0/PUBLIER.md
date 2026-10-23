# Mettre le site en ligne (gratuit) et brancher MEGA

Le site est un dossier statique : `index.html`, `liens.json`, `icone.png`. Aucun serveur, aucune base.

## 1. Envoyer les installeurs sur ton MEGA
1. Dans MEGA (web ou appli), crée un dossier « Clipia » et envoie-y : le `.exe`, le `.deb`, le `.zip` macOS, `Clipia-USB.iso.zip`.
2. Clic droit sur chaque fichier → **Obtenir le lien** → copie-le (choisis « avec clé » : `https://mega.nz/file/...#...`).
3. Ouvre `liens.json` et colle chaque lien dans le champ `"url"` correspondant. Les boutons du site passent alors de « Lien bientôt disponible » à « Télécharger ».

## 2. Publier le site (au choix, tous gratuits)
- **Cloudflare Pages** (meilleur) : dash.cloudflare.com → Workers & Pages → Create → Pages → *Upload assets* → glisse le dossier `site`. Nom du projet : `clipia` → adresse `https://clipia.pages.dev` (si le nom est libre).
- **Netlify Drop** : app.netlify.com/drop → glisse le dossier. Renomme ensuite le site en `clipia` → `https://clipia.netlify.app`.
- **GitHub Pages** : nouveau dépôt public `clipia`, envoie les 3 fichiers, Settings → Pages → Branch `main` → `https://<ton-compte>.github.io/clipia`.

Un nom exactement `clipia` peut déjà être pris : essaie `clipia-studio` ou `clendax-clipia`. Pour mettre à jour un lien plus tard, modifie seulement `liens.json` et redépose le dossier.
