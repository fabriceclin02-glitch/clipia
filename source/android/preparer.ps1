# Prépare le projet Android sous Windows. Clic droit > Exécuter avec PowerShell.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
Write-Host "1/4 - copie de l'interface" -ForegroundColor Cyan
Remove-Item -Recurse -Force www -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path www | Out-Null
Copy-Item -Recurse ..\web\* www\
Write-Host "2/4 - dependances Capacitor" -ForegroundColor Cyan
npm install
Write-Host "3/4 - plateforme Android" -ForegroundColor Cyan
if (-not (Test-Path android)) { npx cap add android }
Write-Host "4/4 - synchronisation" -ForegroundColor Cyan
npx cap sync android
Write-Host "`nPret. Ensuite :" -ForegroundColor Green
Write-Host "  npx cap open android"
Write-Host "  cd android ; .\gradlew assembleDebug"
