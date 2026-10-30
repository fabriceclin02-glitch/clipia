# Connecter Clipia à Google (Gmail et Agenda)

Clipia n'a pas de clé Google intégrée : chacun utilise son propre projet Google (gratuit).

1. Va sur https://console.cloud.google.com → crée un projet.
2. **API et services → Bibliothèque** : active « Gmail API » et « Google Calendar API ».
3. **Écran de consentement OAuth** : type « Externe », renseigne le nom et ton e-mail. Laisse l'état **Test** et ajoute ton adresse Gmail dans « Utilisateurs test » (100 maximum).
4. **Identifiants → Créer des identifiants → ID client OAuth** : type **Application Web**.
   - Origines JavaScript autorisées : `https://fabriceclin02-glitch.github.io`
   - URI de redirection autorisés : `https://fabriceclin02-glitch.github.io/clipia/app/oauth.html`
5. Copie l'ID client (`….apps.googleusercontent.com`), puis dans Clipia → Réglages → Google : colle-le et touche « Se connecter ». Accepte l'avertissement « application non validée » (normal en mode Test).

## À savoir
- Aucun secret n'est stocké : la connexion donne un jeton d'environ 1 heure, à renouveler.
- Clipia lit tes derniers courriels et ton agenda ; elle n'envoie un e-mail qu'après ton accord à l'écran.
- Google Photos : depuis 2025, l'API ne permet plus aux applications tierces de lire ta bibliothèque. Ouvre l'application Photos depuis l'écran d'accueil.
- Ouvrir Gmail à tout le monde (hors mode Test) exige une validation de sécurité payante de Google : inutile pour un usage personnel.
