@echo off
chcp 65001 >nul
title Publier Clipia sur ollama.com
echo.
echo  === Publier le modele Clipia sur ollama.com ===
echo.
echo  Avant : 1) Ollama installe (https://ollama.com/download)
echo          2) Un compte sur https://ollama.com (gratuit)
echo          3) Ta cle Ollama ajoutee au compte : https://ollama.com/settings/keys
echo             (le contenu du fichier %%USERPROFILE%%\.ollama\id_ed25519.pub)
echo.
set /p PSEUDO=Ton pseudo ollama.com :
if "%PSEUDO%"=="" goto fin
cd /d "%~dp0"
echo.
echo  Telechargement de la base (qwen2.5:3b)...
ollama pull qwen2.5:3b || goto erreur
echo  Creation du modele %PSEUDO%/clipia ...
ollama create %PSEUDO%/clipia -f Modelfile || goto erreur
echo  Envoi sur ollama.com ...
ollama push %PSEUDO%/clipia || goto erreur
echo.
echo  C'est en ligne : https://ollama.com/%PSEUDO%/clipia
echo  Tout le monde peut l'installer avec :  ollama run %PSEUDO%/clipia
goto fin
:erreur
echo.
echo  Une etape a echoue. Verifie que ta cle est bien ajoutee sur https://ollama.com/settings/keys
:fin
echo.
pause
