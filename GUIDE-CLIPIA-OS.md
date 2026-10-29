# Clipia OS 4 — guide d'installation et d'utilisation

Clipia OS est un vrai système d'exploitation (base **Ubuntu 24.04 LTS**, noyau Linux 6.8) aux couleurs de Clipia : écran de démarrage animé (sphère 3D), bureau complet, deux navigateurs web, gestionnaire de fichiers, terminal, éditeur, réglages, et **Clipia 8.2** installée d'office, lancée automatiquement. Il tourne en **live** (clé USB ou ISO, sans rien installer), dans une **machine virtuelle**, ou **installé sur le disque** d'un ordinateur.

## Ce qu'il faut

- Un PC **x86-64 (Intel ou AMD)** ou un **Mac Intel**. **Les Mac Apple Silicon (M1/M2/M3/M4…) ne peuvent pas le démarrer** (processeur différent) ; sur ces Mac, utilise la version macOS de Clipia.
- 4 Go de RAM minimum (8 Go conseillés), une clé USB de 8 Go minimum (16 Go conseillés), ou un disque d'au moins 10 Go pour l'installation.
- **Secure Boot désactivé** dans le BIOS/UEFI (le chargeur n'est pas signé par Microsoft).

## 1. Récupérer l'image

L'image est livrée en morceaux de moins de 100 Mo (`Clipia-OS-4.0.iso.part00`, `.part01`, …). Mets-les dans le même dossier puis recolle-les :

- **Windows** (Invite de commandes dans le dossier) : `copy /b Clipia-OS-4.0.iso.part* Clipia-OS-4.0.iso`
- **macOS / Linux** : `cat Clipia-OS-4.0.iso.part* > Clipia-OS-4.0.iso`

Vérifie l'empreinte avec `SHA256SUMS.txt` (`certutil -hashfile Clipia-OS-4.0.iso SHA256` sous Windows, `shasum -a 256 Clipia-OS-4.0.iso` ailleurs).

## 2A. Essayer dans une machine virtuelle (le plus sûr)

Aucun risque pour ton ordinateur.
- **VirtualBox** (gratuit) : Nouvelle machine → Type *Linux*, version *Ubuntu (64-bit)* → 4 Go de RAM, 2 processeurs, disque virtuel de 20 Go → Configuration → Stockage : insère l'ISO dans le lecteur optique → Système : coche **« Activer EFI »** (ou laisse le BIOS) → Démarrer.
- **VMware Workstation Player** (gratuit pour un usage personnel), **GNOME Boxes**, **UTM** (Mac Intel), **QEMU** : même principe, ISO dans le lecteur virtuel.
- Pour **installer** dans la machine virtuelle, ajoute-lui un disque virtuel d'au moins 12 Go, puis choisis « Installer Clipia OS » au menu de démarrage.

## 2B. Créer une clé USB bootable (live, avec mémoire permanente)

La clé sera **entièrement effacée**. Outils gratuits :
- **balenaEtcher** (Windows, macOS, Linux) : *Flash from file* → l'ISO → ta clé → *Flash*. C'est le plus simple.
- **Rufus** (Windows) : choisis l'ISO, schéma de partition **GPT** (ou MBR pour un très vieux PC), et si Rufus propose un mode, prends **« Image DD »**.
- **Ventoy** (Windows, Linux) : installe Ventoy sur la clé, puis copie simplement le fichier ISO dessus. Garde « Mode normal ».
- Linux : `sudo dd if=Clipia-OS-4.0.iso of=/dev/sdX bs=4M status=progress conv=fsync` (vérifie `sdX` avec `lsblk`).

Au premier démarrage, Clipia OS crée une partition **CLIPIA-DATA** dans l'espace libre de la clé : conversations, projets, mémoire et réglages restent d'un démarrage à l'autre. (Avec Ventoy, ou si la clé est pleine, les données ne sont pas conservées : Clipia OS le signale dans Réglages.)

## 3. Démarrer sur la clé

Branche la clé, redémarre et ouvre le menu de démarrage : **F12** (Dell, Lenovo), **F9** (HP), **Échap / F8** (Asus), **F11** (MSI, Gigabyte), **Option ⌥** maintenue (Mac Intel). Choisis la clé (« UEFI : … » de préférence). Le menu Clipia propose :

1. **Essayer Clipia OS** (live, données conservées sur la clé) ;
2. **Installer Clipia OS** sur cet ordinateur ou cette machine virtuelle ;
3. **Mode sûr** (affichage simple) si l'écran reste noir ;
4. **Tout en mémoire** (tu peux retirer la clé après le démarrage) ;
5. **Diagnostic** (console série, pour le support).

## 4. Installer sur le disque

Choisis « Installer Clipia OS » (ou, depuis le bureau, **Accueil → Installer sur le disque**). L'assistant 3D te guide : *disque → clavier, fuseau, nom → confirmation → installation*. La clé de démarrage n'apparaît jamais dans la liste, et il faut **taper EFFACER** : **tout le disque choisi est effacé** (pas de double démarrage avec Windows ou macOS). L'installation prend 10 à 20 minutes ; retire ensuite la clé et redémarre.

## 5. Premier démarrage : la visite guidée

Au premier lancement, la fenêtre **Clipia** s'ouvre et la **visite « Découvrir »** explique le système en six étapes (parler à Clipia, Internet, donner un cerveau à Clipia, autorisations, applications, installation). Tu peux la relancer à tout moment : **Accueil → Découvrir**.

Pour donner un cerveau à Clipia : colle une clé **Groq** gratuite (console.groq.com/keys) dans Clipia → Réglages, ou installe un modèle local avec Ollama (Internet requis une fois). **Tu saisis toujours tes clés toi-même dans l'interface de Clipia, jamais dans une conversation.**

## 6. Les Réglages de Clipia OS

**Accueil → Réglages** (ou le menu Applications) :
- **Réseau** : réseaux Wi-Fi, connexion, réseau avancé (VPN, IP fixe…) ;
- **Clavier, fuseau horaire, nom de l'ordinateur** ;
- **Son** (volume, mixeur détaillé) ;
- **Autorisations de Clipia** (voir ci-dessous) ;
- **Stockage** (état de la mémoire permanente), **À propos**, **Redémarrer / Éteindre**.

## 7. Les autorisations de Clipia sur la machine

Dans Clipia OS, Clipia tourne avec les **droits administrateur** de la machine : elle peut installer des logiciels, gérer fichiers, réseau et services, piloter les navigateurs et lancer des applications. Garde-fous : **chaque action sensible** (suppression, installation, droits administrateur, envoi de données) **te demande ton accord à l'écran** ; les clés, mots de passe et fichiers système critiques restent fermés ; et tu peux, dans Réglages, étendre son accès à **tout le disque** ou la passer en **lecture seule**.

## 8. Navigateurs et applications

Navigateur **Epiphany** (léger) et **Falkon** (moteur Chromium), **Thunar** (fichiers), terminal, éditeur de texte, mixeur son, gestion des pilotes. Les outils des machines virtuelles (presse-papier partagé, redimensionnement d'écran) sont inclus pour QEMU/KVM, VMware et VirtualBox.

## 9. Parler à Clipia

Touche la sphère pour lui parler, ou appuie sur la **barre d'espace** : Clipia se met en pause et t'écoute ; rappuie sur espace à tout moment pour l'interrompre.

## 10. Sauvegarde

Dans Clipia, **Sauvegarder mon IA** exporte tout (fichier `.clipiabak`, chiffrable) vers une clé USB, Dropbox ou MEGA. Réécrire la clé avec une nouvelle version d'ISO efface tout : sauvegarde avant.

## 11. Limites connues (honnêtement)

- Testé sur machine virtuelle (QEMU) en démarrage **UEFI**, y compris l'installation complète sur disque. **Non testé sur du matériel réel**, ni sur Mac, ni avec Secure Boot.
- Pas de Windows ni de macOS dedans : c'est un Ubuntu personnalisé ; les logiciels Windows ne s'y exécutent pas directement.
- Wi-Fi/Bluetooth/GPU récents : une partie seulement des firmwares est incluse ; au besoin, câble Ethernet ou adaptateur USB, puis outil **Pilotes**. Cartes NVIDIA : pilote libre par défaut.
- Les modèles d'IA locaux se téléchargent en ligne : l'image reste compacte.
- L'écran 3D utilise le rendu logiciel (sans carte graphique) : il est fluide sur un PC récent, plus lent dans une machine virtuelle sans accélération.
