@echo off
chcp 65001 >nul
title Audit Clipia
cd /d "%~dp0"
if exist "runtime\node.exe" (set "NODE=runtime\node.exe") else (set "NODE=node")
"%NODE%" app\scripts\audit-complet.mjs 2>nul || "%NODE%" scripts\audit-complet.mjs
echo.
echo Le resultat est dans Audit-Clipia.txt - envoie-le moi.
pause
