# Clipia FCMLL 1.1

Une assistante complète, sur votre machine, qui tient dans 4 Go.

**Paramètres : 4,0 milliards** (3,6 milliards hors embeddings) · 36 couches ·
attention GQA 32 têtes Q / 8 têtes KV · contexte 32 768 jetons en natif,
131 072 avec YaRN · 119 langues · appel d'outils natif.
**Taille sur le disque : environ 2,9 Go** en quantification Q5_K_M.

---

## Ce que c'est, exactement

Clipia FCMLL 1.1 est **un modèle de langage ouvert, configuré et orchestré pour
être Clipia**. Trois couches :

1. **La base.** [Qwen3-4B](https://huggingface.co/Qwen/Qwen3-4B) d'Alibaba, sous
   licence Apache 2.0. C'est elle qui porte les 4 milliards de paramètres, les
   119 langues, le raisonnement et le code.
2. **L'identité.** Un `Modelfile` qui définit qui est Clipia, comment elle
   répond, son protocole d'appel d'outils, ses règles d'honnêteté et ses limites
   sur la machine — plus un réglage d'échantillonnage choisi pour une
   assistante : assez de liberté pour que la langue reste vivante, assez de
   contrainte pour qu'elle n'invente pas.
3. **Les outils.** Quinze outils déclarés (image, vidéo, musique, voix, écoute,
   3D, documents, web, fichiers, machine, terminal, agents, sous-agents,
   mémoire, tâches programmées). FCML 1.1 les appelle ; les moteurs spécialisés
   exécutent. Une seule interlocutrice, une seule voix.

## Ce que ce n'est pas

Autant le dire avant que vous le découvriez.

- **Ce ne sont pas des poids réentraînés.** Les 4 milliards de paramètres sont
  ceux de Qwen3-4B, inchangés. Ce qui est de Clipia, c'est la couche d'identité,
  de comportement et d'outils — ce qui, à l'usage, fait l'essentiel de la
  différence, mais ce n'est pas un entraînement. Voir « Phase 2 » plus bas.
- **Ce n'est pas un modèle multimodal.** FCML 1.1 ne voit pas une image et
  n'entend pas un son par elle-même. Elle passe par ses outils. Le résultat est
  le même pour vous ; la mécanique est différente, et elle le dit si on le lui
  demande.
- **Ce n'est pas une fusion de plusieurs modèles.** On ne fusionne des poids
  qu'entre modèles de même architecture et de mêmes dimensions. Qwen avec GLM
  avec Mistral, ça n'existe pas, et aucun outil ne le fait.

## Installer

Il faut [Ollama](https://ollama.com/download) — c'est lui qui fait tourner le
modèle en local, hors ligne, sans clé.

```
git clone https://github.com/fabriceclin02-glitch/clipia.git
cd clipia/fcml
node construire.mjs
```

Sous Windows, double-cliquez sur `Construire Clipia FCML.bat`.

Le script télécharge la base, crée le modèle, puis **mesure** : taille réelle
sur le disque, paramètres déclarés, contexte, et vitesse en jetons par seconde.
Il affiche ce qu'il a mesuré, pas ce qu'on espérait.

Ensuite :

```
ollama run clipia-fcml:1.1
```

Ou, dans Clipia : **Cerveau → Ollama → clipia-fcml:1.1**.

## Vitesse

Un modèle de 4 milliards de paramètres en Q5_K_M tourne sur un PC sans carte
graphique dédiée. Sur 8 Go de RAM, comptez quelques jetons par seconde en
processeur seul, nettement plus avec un GPU. C'est le compromis du format : il
répond tout de suite aux tours simples, et Clipia bascule sur un gros modèle
distant quand une tâche le mérite vraiment.

`construire.mjs` vous donne le chiffre réel de **votre** machine. N'en croyez
aucun autre.

## Phase 2 : des poids qui soient vraiment Clipia

Pour que l'identité passe des instructions aux paramètres, il faut un
affinage LoRA sur une vraie matière : vos conversations, vos projets, votre
façon d'écrire. Ce qu'il faut pour ça :

- un GPU loué, quelques heures — de l'ordre de 20 à 200 €
- un jeu de données d'exemples, construit depuis vos propres échanges
- l'export en GGUF, puis le même `Modelfile` par-dessus

Ce que ça change : le ton et les réflexes deviennent natifs, sans dépendre d'un
long message système. Ce que ça ne change pas : les capacités brutes. Un modèle
de 4 milliards de paramètres affiné reste un modèle de 4 milliards de
paramètres.

## Licence et attribution

Apache 2.0, comme la base. Voir `LICENSE` et `NOTICE`.

Clipia FCMLL 1.1 est construite sur Qwen3-4B, publié par l'équipe Qwen d'Alibaba
Cloud sous licence Apache 2.0. Clipia n'est pas affiliée à Alibaba ni à l'équipe
Qwen, et ne parle pas en leur nom.

CLENDAX — Clin Fabrice, Flize (Ardennes) — fabriceclin02@gmail.com
