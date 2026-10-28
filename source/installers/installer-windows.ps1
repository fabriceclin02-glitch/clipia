# ╔══════════════════════════════════════════════════════════╗
# ║  CLIPIA — installateur Windows                           ║
# ║  Clic droit sur ce fichier → « Exécuter avec PowerShell » ║
# ╚══════════════════════════════════════════════════════════╝
$ErrorActionPreference = "Stop"
$Racine = Split-Path -Parent $PSScriptRoot

function Titre($t) { Write-Host "`n  $t" -ForegroundColor Yellow; Write-Host ("  " + "-" * 52) -ForegroundColor DarkGray }
function OK($t)    { Write-Host "  [OK] $t" -ForegroundColor Green }
function Info($t)  { Write-Host "  ---- $t" -ForegroundColor Cyan }
function Souci($t) { Write-Host "  [!]  $t" -ForegroundColor Red }

Clear-Host
Write-Host @"

   ██████╗ ██╗     ██╗██████╗ ██╗ █████╗
  ██╔════╝ ██║     ██║██╔══██╗██║██╔══██╗
  ██║      ██║     ██║██████╔╝██║███████║
  ██║      ██║     ██║██╔═══╝ ██║██╔══██║
  ╚██████╗ ███████╗██║██║     ██║██║  ██║
   ╚═════╝ ╚══════╝╚═╝╚═╝     ╚═╝╚═╝  ╚═╝
   Studio créatif IA · CLENDAX

"@ -ForegroundColor DarkYellow

Titre "1/5 · Node.js"
$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
  $v = (node -v) -replace 'v',''
  if ([int]($v -split '\.')[0] -lt 20) { Souci "Node $v est trop ancien, il faut la version 20 ou plus." ; $node = $null }
  else { OK "Node $v" }
}
if (-not $node) {
  Info "Installation de Node.js…"
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
    $env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")
    OK "Node installé"
  } else {
    Souci "winget est absent. Installez Node 20+ depuis https://nodejs.org puis relancez ce script."
    Read-Host "Entrée pour quitter"; exit 1
  }
}

Titre "2/5 · FFmpeg (moteur de montage)"
if (Get-Command ffmpeg -ErrorAction SilentlyContinue) { OK "FFmpeg présent" }
else {
  Info "Installation de FFmpeg…"
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    winget install -e --id Gyan.FFmpeg --accept-source-agreements --accept-package-agreements
    $env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")
    OK "FFmpeg installé"
  } else { Souci "Installez FFmpeg depuis https://ffmpeg.org/download.html — sans lui, pas de montage vidéo." }
}

Titre "3/5 · Configuration"
$envFile = Join-Path $Racine ".env"
if (-not (Test-Path $envFile)) { Copy-Item (Join-Path $Racine ".env.example") $envFile; OK "Fichier .env créé" }
else { OK "Fichier .env déjà présent" }

Titre "4/5 · IA locale gratuite (facultatif)"
if (Get-Command ollama -ErrorAction SilentlyContinue) { OK "Ollama présent" }
else {
  $r = Read-Host "  Installer Ollama pour utiliser Clipia gratuitement, sans abonnement IA ? (o/N)"
  if ($r -match '^[oOyY]') {
    if (Get-Command winget -ErrorAction SilentlyContinue) {
      winget install -e --id Ollama.Ollama --accept-source-agreements --accept-package-agreements
      Info "Téléchargement d'un modèle (quelques minutes)…"
      Start-Process ollama -ArgumentList "pull llama3.2" -Wait -NoNewWindow
      OK "Ollama prêt"
    } else { Info "Téléchargez Ollama sur https://ollama.com/download" }
  }
}

Titre "5/5 · Raccourci"
$ws = New-Object -ComObject WScript.Shell
$lnk = $ws.CreateShortcut((Join-Path ([Environment]::GetFolderPath("Desktop")) "Clipia.lnk"))
$lnk.TargetPath = "cmd.exe"
$lnk.Arguments = "/c cd /d `"$Racine`" && node server\index.js"
$lnk.WorkingDirectory = $Racine
$lnk.IconLocation = "shell32.dll,138"
$lnk.Description = "Clipia — Studio créatif IA"
$lnk.Save()
OK "Raccourci « Clipia » créé sur le Bureau"

Titre "Démarrage"
Write-Host "  Clipia s'ouvre sur http://127.0.0.1:8787`n" -ForegroundColor Green
Start-Process "http://127.0.0.1:8787"
Set-Location $Racine
node server\index.js
