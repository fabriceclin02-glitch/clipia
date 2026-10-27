# Publie une nouvelle version de Clipia : crée la Release GitHub (gros fichiers) et met à jour liens.json (le site).
# Usage (PowerShell, dans le dossier du dépôt du site) :
#   .\outils\publier-version.ps1 -Version 7.0.1 -Dossier "C:\chemin\vers\Clipia-V7.0.1"
# Prérequis (une seule fois) : installer GitHub CLI (winget install GitHub.cli) puis `gh auth login`.
param([Parameter(Mandatory)][string]$Version, [Parameter(Mandatory)][string]$Dossier, [switch]$SansPousser)
$ErrorActionPreference = 'Stop'
$repo = 'fabriceclin02-glitch/clipia'
$fichiers = Get-ChildItem $Dossier -File | Where-Object { $_.Name -match "^(Clipia-Setup|Clipia-Portable|clipia_|Clipia-.*-macos\.zip|Clipia-V.*iso\.zip\.part)" -and $_.Extension -notin '.dmg','.iso' }
if (-not $fichiers) { throw "Aucun fichier à publier dans $Dossier" }
$tag = "v$Version"
gh release create $tag @($fichiers.FullName) --repo $repo --title "Clipia X$($Version.Split('.')[0]) $Version" --notes "Clipia $Version. Vérifie l'empreinte SHA-256 indiquée sur le site." 
$liens = Get-Content liens.json -Raw -Encoding UTF8 | ConvertFrom-Json
$liens.version = $Version
function Lien($nom) { "https://github.com/$repo/releases/download/$tag/$nom" }
function Sha($f) { (Get-FileHash $f.FullName -Algorithm SHA256).Hash.ToLower() }
foreach ($f in $fichiers) {
  $mo = "{0} Mo" -f [math]::Round($f.Length / 1MB)
  switch -Regex ($f.Name) {
    '^Clipia-Setup'    { $liens.fichiers.windows  = [pscustomobject]@{ nom=$f.Name; url=(Lien $f.Name); taille=$mo; sha256=(Sha $f) } }
    '^Clipia-Portable' { $liens.fichiers.portable = [pscustomobject]@{ nom=$f.Name; url=(Lien $f.Name); taille=$mo; sha256=(Sha $f) } }
    '^clipia_'         { $liens.fichiers.linux    = [pscustomobject]@{ nom=$f.Name; url=(Lien $f.Name); taille=$mo; sha256=(Sha $f) } }
    'macos\.zip$'      { $liens.fichiers.macos    = [pscustomobject]@{ nom=$f.Name; url=(Lien $f.Name); taille=$mo; sha256=(Sha $f) } }
  }
}
$parts = $fichiers | Where-Object { $_.Name -match 'iso\.zip\.part' } | Sort-Object Name
if ($parts) {
  $liens.fichiers.iso = [pscustomobject]@{ nom="Clipia-V$Version-windows.iso.zip ($($parts.Count) parties)"; parties=@($parts | ForEach-Object { @{ url = (Lien $_.Name) } }); taille="$($parts.Count) parties" }
}
$liens | ConvertTo-Json -Depth 8 | Set-Content liens.json -Encoding UTF8
# Vidéos : copie-les à la racine du dépôt si elles ont changé, puis :
if (-not $SansPousser) { git add liens.json; git commit -m "Clipia $Version : liens de téléchargement"; git push }
Write-Host "Version $Version publiée. Le site se met à jour en 1 à 2 minutes."
