# Publier une application dans le Clipia Store (gratuit)

Le Clipia Store est un catalogue ouvert : `store/catalogue.json`. Aucun frais, aucun compte payant.

## Ajouter ton application
1. Ouvre une « Pull request » (ou une « Issue » avec le modèle *Store — nouvelle application*) sur ce dépôt.
2. Ajoute une entrée dans `store/catalogue.json` :

```json
{
  "id": "mon-app",
  "nom": "Mon application",
  "desc": "Une phrase claire.",
  "cat": "Développement",
  "type": "apk",
  "pkg": "com.exemple.monapp",
  "url": "https://github.com/moi/mon-app/releases/download/v1.0/mon-app.apk",
  "sha256": "empreinte SHA-256 de l'APK (64 caractères)",
  "icone": "🧩",
  "dev": "Ton nom"
}
```

- `type` : `apk` (installation directe dans Clipia), `fdroid` (fiche F-Droid), `web` (application web : `url` en https).
- Pour `apk` : lien **https** direct vers l'APK + `sha256` obligatoire. Clipia refuse d'installer si l'empreinte ne correspond pas.
  Calcul : `sha256sum mon-app.apk`.
3. Une vérification automatique contrôle le format. Un mainteneur relit puis publie.

## Règles
Pas de logiciel malveillant, pas de publicité trompeuse, pas de collecte cachée de données. Le code source ouvert est encouragé.

## Dépôt IA
Les agents partageables sont dans `depot-ia/catalogue.json` (même principe : une pull request).
