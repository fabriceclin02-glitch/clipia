; Clipia.exe (portable) : lance le superviseur (serveur relancé s'il tombe, journal, port libre) sans fenêtre noire.
Unicode true
OutFile "${OUT}"
RequestExecutionLevel user
SilentInstall silent
Icon "${ICON}"
Section
  IfFileExists "$EXEDIR\runtime\node.exe" +3 0
    MessageBox MB_ICONSTOP "Dossier incomplet : Clipia.exe doit rester à côté des dossiers « runtime » et « app ».$\r$\n$\r$\nSi tu as ouvert le zip avec WinRAR, ferme-le : fais un clic droit sur le zip puis « Extraire tout » (ou « Extraire ici »), et lance Clipia.exe depuis le dossier extrait."
    Quit
  IfFileExists "$EXEDIR\app\server\superviseur.js" +3 0
    MessageBox MB_ICONSTOP "Le dossier « app » est incomplet ou ancien. Extrais de nouveau tout le zip Clipia V5 dans un dossier vide."
    Quit
  System::Call 'kernel32::SetEnvironmentVariable(t "CLIPIA_DATA_DIR", t "$EXEDIR\donnees")i'
  CreateDirectory "$EXEDIR\donnees"
  SetOutPath "$EXEDIR\app"
  ExecShell "open" '"$EXEDIR\runtime\node.exe"' '"$EXEDIR\app\server\superviseur.js"' SW_HIDE
SectionEnd
