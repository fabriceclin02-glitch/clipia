@echo off
chcp 65001 >nul
title Diagnostic Clipia
set "CLIPIA_DATA_DIR=%APPDATA%\Clipia"
echo ===== Journal de Clipia (60 dernières lignes) =====
powershell -NoProfile -Command "if (Test-Path '%APPDATA%\Clipia\clipia.log') { Get-Content -Tail 60 -Encoding UTF8 '%APPDATA%\Clipia\clipia.log' } else { 'Pas encore de journal.' }"
echo.
echo ===== Vérification des fichiers =====
if exist "%~dp0runtime\node.exe" (echo runtime\node.exe : OK) else (echo runtime\node.exe : MANQUANT - extrais tout le zip, ne lance pas Clipia.exe depuis WinRAR)
if exist "%~dp0app\server\superviseur.js" (echo app\server\superviseur.js : OK) else (echo app : MANQUANT ou ancienne version)
echo.
echo ===== Lancement visible du serveur (les erreurs s'affichent ici ; Ctrl+C pour arrêter) =====
set CLIPIA_NO_BROWSER=
"%~dp0runtime\node.exe" "%~dp0app\server\superviseur.js"
echo.
pause
