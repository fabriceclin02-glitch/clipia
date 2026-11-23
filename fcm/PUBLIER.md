# Publier Clipia FCM 1.1 sur ollama.com

Le modèle fait environ 2,9 Go : trop gros pour un dépôt Git (GitHub refuse les
fichiers de plus de 100 Mo, 2 Go même avec LFS). Sa place est le registre
d'Ollama, qui est fait pour ça et qui donne la commande d'installation en une
ligne à qui veut l'essayer.

GitHub garde la recette — `Modelfile`, scripts, documentation — et c'est ce qui
rend le projet lisible et reproductible.

## Les trois commandes

Il faut un compte sur https://ollama.com (gratuit) et votre nom d'utilisateur.

```
ollama create VOTRE-NOM/clipia-fcm:1.1 -f Modelfile
ollama push VOTRE-NOM/clipia-fcm:1.1
```

La première fois, Ollama demande à lier votre clé publique à votre compte : il
affiche un lien, vous le collez dans le navigateur, et c'est fini.

Ensuite, n'importe qui l'installe avec :

```
ollama run VOTRE-NOM/clipia-fcm:1.1
```

## La fiche du modèle

Sur ollama.com, la description du modèle est ce que les gens lisent avant de
l'essayer. Reprenez les trois premières lignes du README : les paramètres, la
taille, et ce que c'est exactement. Dire franchement que la base est Qwen3-4B
inspire plus confiance que de le laisser deviner — et ça se voit de toute façon
dans le `Modelfile`.
