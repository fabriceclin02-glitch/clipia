# Clipia pour Android — du projet au Play Store

Clipia sur Android est l'interface web empaquetée par Capacitor. Le téléphone ne peut héberger ni FFmpeg ni les modèles : **le rendu reste sur votre ordinateur ou votre serveur**, le mobile sert à piloter et à consulter.

Au premier lancement, l'application demande l'adresse du serveur dans **Paramètres → Serveur**. Pas besoin de recompiler pour changer de serveur.

## 0. Prérequis

- [Android Studio](https://developer.android.com/studio) (apporte le SDK et Gradle)
- Node 20 ou plus

## 1. Préparation automatique

```bash
cd android
./preparer.sh          # macOS, Linux
```
```powershell
cd android
.\preparer.ps1         # Windows
```

Le script copie l'interface, installe Capacitor, ajoute la plateforme Android, génère les icônes depuis `resources/icon.png` et synchronise. Comptez cinq minutes la première fois.

## 2. APK de test, tout de suite

```bash
cd android && ./gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
```

Cet APK s'installe directement sur votre téléphone (autorisez les sources inconnues). Il est signé avec la clé de débogage : parfait pour tester, impossible à publier.

## 3. Faire parler le téléphone à votre ordinateur

Sur la machine où tourne Clipia :

```bash
HOST=0.0.0.0 node server/index.js
```

Sans `HOST=0.0.0.0`, le serveur n'écoute que lui-même et le téléphone ne le verra pas. Relevez ensuite l'adresse locale de la machine (`ipconfig` sur Windows, `ifconfig` sur Mac et Linux), du type `192.168.1.20`, et saisissez `http://192.168.1.20:8787` dans Paramètres → Serveur. Les deux appareils doivent être sur le même Wi-Fi.

## 4. Clé de signature (à faire une seule fois, à conserver précieusement)

```bash
keytool -genkey -v -keystore clipia-release.keystore \
  -alias clipia -keyalg RSA -keysize 2048 -validity 10000
```

Créez `android/key.properties` :

```properties
storePassword=VOTRE_MOT_DE_PASSE
keyPassword=VOTRE_MOT_DE_PASSE
keyAlias=clipia
storeFile=../../clipia-release.keystore
```

> Si vous perdez ce fichier .keystore, vous ne pourrez plus mettre à jour l'application sur le Play Store. Sauvegardez-le hors de votre ordinateur.

## 5. Construction de l'AAB

```bash
npx cap sync android
cd android && ./gradlew bundleRelease
# → android/app/build/outputs/bundle/release/app-release.aab
```

## 6. Dépôt sur le Play Store

1. Compte développeur Google Play (frais d'inscription uniques, 25 $).
2. Play Console → Créer une application → Clipia, français, gratuite ou payante.
3. **Contenu de l'application**, à remplir intégralement :
   - Politique de confidentialité (URL publique obligatoire — modèle fourni dans `docs/confidentialite.md`)
   - Sécurité des données : déclarez la collecte (compte, contenus créés) et le chiffrement en transit
   - Classification du contenu : questionnaire IARC
   - Public cible : 18 ans et plus recommandé pour une app de création IA
   - Déclaration IA générative : **obligatoire** depuis 2024, décrivez les garde-fous et le signalement de contenu
4. Versions → Production → importer l'AAB.
5. Test interne d'abord (20 testeurs sur 14 jours sont exigés pour les nouveaux comptes personnels).

## 7. Facturation

Google impose son système de facturation pour les contenus numériques consommés dans l'app. Deux voies conformes :

- **Google Play Billing** : ajoutez `@capacitor-community/in-app-purchases`, créez les abonnements dans la Play Console, et faites-les correspondre aux plans Clipia côté serveur.
- **Abonnement acheté hors application** : l'utilisateur s'abonne sur votre site web, l'app ne fait que refléter son statut. Ne mettez aucun lien de paiement dans l'app — c'est le motif de refus le plus fréquent.

Stripe fonctionne pour la version web et bureau sans restriction.
