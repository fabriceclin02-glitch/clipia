@echo off
title Clipia Nova
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js est requis : https://nodejs.org  & start https://nodejs.org & pause & exit /b)
if not exist node_modules (echo Premiere installation, patientez 1 a 2 minutes... & call npm install)
call npm start
