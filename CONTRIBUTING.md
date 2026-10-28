# Participer à Clipia

Clipia s'améliore grâce à sa communauté. Tu n'as pas besoin de savoir coder.

## Proposer une idée (sans code)
1. Onglet **Issues → New issue → 💡 Proposer une idée**.
2. Décris le **besoin** : qui, pour faire quoi. Pas de mot de passe, clé API ni donnée personnelle.
3. Le propriétaire lit l'idée. S'il la retient, il ajoute le label **`approuvé`**.
4. L'**agent d'évolution** (GitHub Actions) lit l'idée, prépare un correctif, lance les tests et ouvre une **Pull Request**.
5. Le propriétaire **relit le diff** et fusionne. La fusion publie automatiquement une **nouvelle version** dans *Releases*. Les versions précédentes restent toujours téléchargeables.

> Pourquoi une validation humaine ? Une idée est un texte écrit par un inconnu. Sans relecture, n'importe qui pourrait faire écrire du code malveillant à l'agent. L'agent ne peut de toute façon toucher qu'à `server/`, `web/`, `skills-defaut/`, `docs/`, `extension-chrome/` — jamais aux workflows, aux secrets ni aux dépendances.

## Proposer du code
- Fork → branche → Pull Request vers `main`. Le code vit dans `source/`.
- Zéro dépendance npm. Node 20+. Front en JavaScript vanille.
- `cd source && node scripts/selftest.mjs` doit passer.
- Pas de collecte de données, pas de nouvel appel réseau sans l'expliquer dans la PR.

## Installation de l'agent d'évolution (propriétaire)
Dans *Settings → Secrets and variables → Actions* :
- secret `LLM_API_KEY` : clé d'un fournisseur compatible OpenAI (OpenAI, Mistral, OpenRouter, ou un serveur local joignable) ;
- variables facultatives `LLM_BASE_URL` (défaut `https://api.openai.com/v1`) et `LLM_MODEL` ;
- créer les labels `idée`, `bug` et `approuvé`.
*Settings → Actions → General → Allow GitHub Actions to create and approve pull requests* doit être coché.
