; Clipia.exe (installé) : lance le superviseur (serveur relancé s'il tombe, journal, port libre) sans fenêtre noire.
Unicode true
OutFile "${OUT}"
RequestExecutionLevel user
SilentInstall silent
Icon "${ICON}"
Section
  IfFileExists "$EXEDIR\runtime\node.exe" +3 0
    MessageBox MB_ICONSTOP "Installation incomplète (runtime introuvable). Relance l'installateur de Clipia."
    Quit
  IfFileExists "$EXEDIR\app\server\superviseur.js" +3 0
    MessageBox MB_ICONSTOP "Installation incomplète ou ancienne. Relance l'installateur de Clipia V5."
    Quit
  System::Call 'kernel32::SetEnvironmentVariable(t "CLIPIA_DATA_DIR", t "$APPDATA\Clipia")i'
  CreateDirectory "$APPDATA\Clipia"
  SetOutPath "$EXEDIR\app"
  ExecShell "open" '"$EXEDIR\runtime\node.exe"' '"$EXEDIR\app\server\superviseur.js"' SW_HIDE
SectionEnd
