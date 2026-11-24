@echo off
chcp 65001 >nul
title Clipia FCML 1.1 - construction
cd /d "%~dp0"
set NODE=%LOCALAPPDATA%\Programs\Clipia\runtime\node.exe
if not exist "%NODE%" set NODE=node
"%NODE%" construire.mjs
echo.
echo   Appuyez sur une touche pour fermer.
pause >nul
