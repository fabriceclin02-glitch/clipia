# Brancher Clipbook et ClipTok sur ton serveur gratuit (Supabase)

Sans serveur, Clipbook et ClipTok fonctionnent en **mode solo** sur le téléphone (ton journal et tes vidéos). Pour que **plusieurs personnes** communiquent, il faut un serveur. Supabase a une offre gratuite suffisante pour démarrer.

1. Crée un compte sur https://supabase.com puis « New project » (région Europe, mot de passe de base de données à garder).
2. Menu **SQL Editor** → colle tout le contenu de `social/schema.sql` → **Run**.
3. Menu **Authentication → Providers → Email** : désactive « Confirm email » (pour une inscription immédiate).
4. Menu **Project Settings → API** : copie **Project URL** et la clé **anon public** (jamais la clé `service_role`).
5. Dans Clipia → Clipbook (ou ClipTok) → « Connecter mon serveur » : colle l'URL et la clé anon. Chaque personne crée ensuite son compte dans l'appli.

## À savoir
- La clé *anon* est faite pour être dans une appli : la sécurité repose sur les règles (RLS) du schéma.
- L'offre gratuite a des limites de stockage et de bande passante : les vidéos les consomment vite.
- Obligations d'un vrai réseau social : conditions d'utilisation, politique de confidentialité (RGPD), modération des contenus signalés (table `signalements`), respect de l'âge minimum. Tu en es l'éditeur responsable.
