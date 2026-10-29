# Sources de Clipia OS 4

`overlay/` : fichiers ajoutés au système (services, scripts, thème de démarrage, fond d'écran, entrées de menu).
`assembler.sh`, `synchro.sh`, `finaliser.sh`, `refaire.sh` : assemblage du système de fichiers et de l'image ISO (debootstrap Ubuntu 24.04, mksquashfs, xorriso).
Guide d'utilisation : branche `os-images` (GUIDE-CLIPIA-OS.md). Le code de l'interface (Réglages, installeur, visite) est dans `source/web/os.html` et `source/server/noyau/os.js`.
