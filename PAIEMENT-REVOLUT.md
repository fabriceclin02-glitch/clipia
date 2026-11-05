# Vendre Clipia X10 avec Revolut — ce qu'il y a à faire

Clipia X10 = **10 € à vie**, sans version gratuite. Le cabinet de psychologues = 2 h incluses, puis **5 € l'heure**.
Le principe : le client paie sur une page **Revolut** → il reçoit un **code signé** (lié à son e-mail) → il le colle dans Clipia. Aucun compte à gérer, aucune carte bancaire ne passe chez toi.

## Ce qui est déjà fait
- L'application X10 demande un code au premier lancement (écran d'activation).
- Pages du site : `acheter.html` (10 €), `cabinet.html` (heures), `cgv.html`, `merci.html`.
- Outil vendeur `outils/licence.mjs` : fabrique les codes avec **ta clé privée** (`Clipia-CLE-PRIVEE.json`, remise séparément, à ne jamais publier).
- Modèle de passerelle automatique : `outils/passerelle-revolut/worker.js` (étape 2).

## Étape 1 — Démarrer tout de suite (semi-manuel, sans programmation)
1. **Compte Revolut Business** (nécessaire pour encaisser des paiements de clients ; le compte perso ne suffit pas). Il demande ton statut (micro-entreprise) et ton SIRET.
2. Dans Revolut Business : **Encaisser / Accepter des paiements → Liens de paiement** (« Payment links »). Crée :
   - un lien **10,00 €** « Clipia X10 — licence à vie » ;
   - cinq liens pour le cabinet : **5 € (1 h), 10 € (2 h), 25 € (5 h), 50 € (10 h), 100 € (20 h)**.
   Les noms exacts des menus peuvent varier selon ton pays/offre : cherche « Payment link » ou « Lien de paiement ».
3. Ouvre `paiement-config.json` et colle chaque lien (https://…) dans le champ `lien` correspondant. Publie (commit + push) : les boutons de `acheter.html` et `cabinet.html` s'activent.
4. À chaque paiement, Revolut te notifie. Récupère l'e-mail du client (demande-le dans la description du lien : « indique ton e-mail dans la note ») puis, sur ton PC :
   - licence : `node outils/licence.mjs creer client@mail.fr`
   - recharge : `node outils/licence.mjs recharge client@mail.fr 5`
   Envoie-lui le code par e-mail. Délai annoncé sur le site : « sous 24 h ».

## Étape 2 — Automatiser (le client reçoit son code seul, en quelques minutes)
Il faut un petit serveur : le modèle `outils/passerelle-revolut/worker.js` tourne sur **Cloudflare Workers** (gratuit).
1. Compte Cloudflare gratuit → Workers → créer un Worker → coller `worker.js`.
2. **Merchant API Revolut** : Revolut Business → Paramètres → API → Merchant API → génère la clé **secrète** (`sk_…`) et crée un **webhook** vers `https://<ton-worker>.workers.dev/webhook` sur l'événement `ORDER_COMPLETED` ; note le « signing secret ».
3. Un service d'e-mail (par ex. **Resend**, gratuit au départ) avec un domaine d'expédition ; clé API.
4. Dans Cloudflare → Settings → **Secrets** (jamais dans le code) : `REVOLUT_SECRET_KEY`, `REVOLUT_WEBHOOK_SECRET`, `CLIPIA_CLE_PRIVEE` (le champ `cle` de `Clipia-CLE-PRIVEE.json`), `RESEND_KEY` ; variables : `REVOLUT_API`, `SITE`, `MAIL_DE`, `MAIL_COPIE`.
5. Teste d'abord en **sandbox** (`https://sandbox-merchant.revolut.com`) avec les cartes de test de Revolut, puis passe en production (`https://merchant.revolut.com`).
6. Dans `paiement-config.json`, renseigne `"commander": "https://<ton-worker>.workers.dev"` : les pages du site pourront alors créer la commande avec l'e-mail saisi (adaptation de `acheter.html` à prévoir : appel `POST /commander`, puis redirection vers `checkout_url`).
⚠ Ce modèle n'a pas été testé avec un vrai compte Revolut : vérifie le format des appels et de la signature dans la documentation Revolut (developer.revolut.com → Merchant API) pendant ton essai en sandbox.

## À compléter avant de vendre (obligations)
- **SIRET** et **médiateur de la consommation** dans `cgv.html` (champs « [à compléter] »).
- Déclarer l'activité (micro-entreprise) et la TVA selon ton régime (franchise en base ou non) : le prix affiché est « TTC ».
- Garde ta clé privée **hors de GitHub** (clé USB / gestionnaire de mots de passe). Si elle fuit, il faudra changer la clé publique (`source/server/noyau/licence-publique.json`) et republier : les anciens codes cesseront de fonctionner.

## Limites à connaître
- Un code est lié à un e-mail mais peut être utilisé sur plusieurs ordinateurs (pas de compteur central) : acceptable à 10 €, et plus simple pour le client.
- Les versions < X10 déjà téléchargées restent gratuites ; les téléchargements du site restent publics, c'est le **code** qui active X10.
- L'application Android (APK) et la PWA ne sont pas verrouillées : elles servent de compagnon du PC.
