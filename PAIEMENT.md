# Encaisser l'option développeur (PayPal) et le cabinet (Revolut)

Clipia X10 est **gratuite**. Deux choses se paient :

## 1. Option développeur — 9,90 € / mois, PayPal (compte chocos08@gmail.com)
Le lien de paiement est déjà dans `paiement-config.json` (champ `dev.lien`) : abonnement mensuel PayPal vers **chocos08@gmail.com**. La page `developpeur.html` l'ouvre après acceptation des conditions.

À faire côté PayPal :
1. Le compte chocos08@gmail.com doit être un compte **PayPal Business** (les abonnements par bouton ne marchent pas avec un compte personnel). Vérifie-le dans PayPal → Paramètres du compte.
2. Fais un premier essai toi-même (ou en mode Sandbox PayPal) pour vérifier que l'abonnement se crée bien.
3. À chaque paiement, PayPal t'envoie un e-mail avec l'adresse du client. Sur ton PC, avec ta clé privée `Clipia-CLE-PRIVEE.json` à côté de `outils/licence.mjs` :
   `node outils/licence.mjs dev client@mail.fr 1`
   puis envoie-lui le code par e-mail. Un code = 1 mois (31 jours) ; refais-en un à chaque mois payé (tu peux aussi donner `3` ou `12` mois d'un coup).
4. Le client l'active dans Clipia : bouton « </> Dév » → e-mail + code.

Pour résilier : le client annule dans PayPal → Paiements automatiques.
Plus tard, on pourra automatiser l'envoi du code avec les notifications PayPal (IPN/webhook) et un petit service.

## 2. Cabinet — recharges d'heures (Revolut)
Inchangé : liens de paiement Revolut dans `paiement-config.json` (`cabinet`), codes avec `node outils/licence.mjs recharge client@mail.fr 5`.

## Sécurité
- Ne mets **jamais** ta clé privée ni un mot de passe PayPal/Revolut dans GitHub.
- `paiement-config.json` ne contient que des liens publics.
