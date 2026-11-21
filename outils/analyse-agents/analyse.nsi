; Clipia — Analyse des agents.exe : lance l'outil d'analyse PowerShell (droits administrateur demandés).
Unicode true
Name "Clipia — Analyse des agents"
OutFile "${OUT}"
RequestExecutionLevel admin
SilentInstall silent
Icon "${ICON}"
Section
  InitPluginsDir
  SetOutPath "$PLUGINSDIR"
  File "Analyse-Clipia.ps1"
  ExecWait 'powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -WindowStyle Hidden -File "$PLUGINSDIR\Analyse-Clipia.ps1"'
SectionEnd
