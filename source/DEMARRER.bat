@echo off
title Clipia - Studio creatif IA
cd /d "%~dp0"
cls
echo.
echo   ================================================
echo      CLIPIA - Studio creatif IA - CLENDAX
echo   ================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   [X] Node.js n'est pas installe.
  echo.
  echo   Telechargez-le ici :  https://nodejs.org
  echo   Prenez la version LTS, installez, puis relancez ce fichier.
  echo.
  pause
  exit /b 1
)
echo   [OK] Node.js detecte
where ffmpeg >nul 2>nul
if errorlevel 1 (
  echo   [!]  FFmpeg absent - le montage video ne fonctionnera pas.
  echo        Pour l'installer :  winget install -e --id Gyan.FFmpeg
) else (
  echo   [OK] FFmpeg detecte
)
echo.
echo   Ouverture de  http://127.0.0.1:8787
echo   Laissez cette fenetre ouverte. Fermez-la pour arreter Clipia.
echo.
start "" http://127.0.0.1:8787
node server/index.js
echo.
echo   Clipia s'est arrete.
pause
