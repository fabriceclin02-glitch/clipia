# Clipia pour Android

Application Android de Clipia. Elle affiche la page de Clipia
(`https://fabriceclin02-glitch.github.io/clipia/app/`) et lui prête la voix du
téléphone : la reconnaissance vocale et la synthèse vocale d'Android, qui ne
sont pas disponibles autrement dans une WebView.

## Comment l'APK est fabriqué

Rien à faire à la main. À chaque modification de `android/` ou de `app/`,
GitHub compile l'application et range le fichier dans
`telechargements/Clipia-<version>.apk`, puis met `liens.json` à jour pour que
le site propose le téléchargement.

L'atelier : `.github/workflows/apk.yml` — on peut aussi le lancer à la demande
depuis l'onglet **Actions** du dépôt (« Construire l'APK Android » →
*Run workflow*).

## Changer la version

Dans `app/build.gradle` :

```
versionCode 30100        // doit toujours augmenter
versionName "3.1.0"      // donne son nom au fichier APK
```

Android refuse d'installer une mise à jour dont le `versionCode` est inférieur
ou égal à celui déjà installé.

## La clé de signature

Android exige qu'une mise à jour soit signée avec **la même clé** que la
version déjà installée. Aucune clé n'est rangée dans ce dépôt : publier une
clé privée permettrait à n'importe qui de signer une fausse mise à jour de
Clipia.

Tant qu'aucun secret n'est défini, l'atelier fabrique une clé à chaque
compilation. L'APK s'installe sans problème, mais **la version suivante ne
s'installera pas par-dessus** : il faudra désinstaller Clipia d'abord. La clé
de chaque compilation est jointe au résultat (onglet Actions → la compilation
→ pièce jointe *Clipia-cle-de-signature*).

### Fixer la clé une fois pour toutes (2 minutes)

1. Onglet **Actions** → dernière compilation → télécharger la pièce jointe
   *Clipia-cle-de-signature* (elle contient `clipia.keystore` et son mot de
   passe). La garder en lieu sûr, hors de GitHub.
2. Encoder la clé : `base64 -w0 clipia.keystore` (sur Windows :
   `certutil -encode clipia.keystore sortie.txt`).
3. Dépôt GitHub → **Settings → Secrets and variables → Actions → New
   repository secret**, et créer :

| Secret | Contenu |
|---|---|
| `CLIPIA_KEYSTORE_B64` | le résultat de l'encodage base64 |
| `CLIPIA_KEYSTORE_MDP` | le mot de passe indiqué dans `mots-de-passe.txt` |
| `CLIPIA_KEY_ALIAS` | `clipia` |
| `CLIPIA_KEY_MDP` | le même mot de passe |

À partir de là, toutes les compilations utilisent cette clé et les mises à
jour s'installent normalement par-dessus la précédente.

## Compiler sur son ordinateur

Il faut Android Studio (ou le SDK Android) et Java 17 :

```
cd android
gradle assembleRelease
```

L'APK sort dans `app/build/outputs/apk/release/`.
