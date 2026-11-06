; Clipia — installeur Windows (sans droits administrateur, installé pour l'utilisateur courant)
Unicode true
Name "Clipia X10 ${VERSION}"
OutFile "${OUT}"
InstallDir "$LOCALAPPDATA\Programs\Clipia"
RequestExecutionLevel user
SetCompressor /SOLID lzma
!include "MUI2.nsh"
!include "LogicLib.nsh"
!define MUI_ICON "${ICON}"
!define MUI_UNICON "${ICON}"
!define MUI_WELCOMEFINISHPAGE_BITMAP "${BMPDIR}\bienvenue.bmp"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "${BMPDIR}\bienvenue.bmp"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_BITMAP "${BMPDIR}\entete.bmp"
!define MUI_HEADERIMAGE_RIGHT
!define MUI_WELCOMEPAGE_TEXT "Clipia X10 est gratuite : ton studio créatif IA qui écoute, réfléchit, puis crée. Dis « Clipia » et elle t'écoute.$\r$\n$\r$\nCette installation embarque tout ce qu'il faut (pas besoin d'installer Node.js) et ne demande aucun droit administrateur. Au premier lancement, un assistant plein écran te guide pas à pas."
!define MUI_FINISHPAGE_RUN "$INSTDIR\Clipia.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Lancer Clipia maintenant"
!define MUI_FINISHPAGE_SHOWREADME "https://ollama.com/download/windows"
!define MUI_FINISHPAGE_SHOWREADME_TEXT "Ouvrir la page de téléchargement d'Ollama (modèles IA gratuits hors ligne)"
!define MUI_FINISHPAGE_SHOWREADME_NOTCHECKED
!insertmacro MUI_PAGE_WELCOME

Section "Kodi + pack Clipia (centre multimédia, recommandé)"
  DetailPrint "Installation de Kodi (winget, version officielle)…"
  nsExec::ExecToLog 'winget install -e --id XBMCFoundation.Kodi --silent --accept-package-agreements --accept-source-agreements'
  Pop $0
  ${If} $0 != 0
    DetailPrint "winget n'a pas pu installer Kodi (code $0). Installe-le depuis https://kodi.tv/download/windows : le pack Clipia est déjà prêt."
  ${EndIf}
  DetailPrint "Ajout du pack Clipia dans Kodi…"
  SetOutPath "$APPDATA\Kodi\addons\plugin.video.clipia.home"
  File /r "${KODIPACK}\plugin.video.clipia.home\*.*"
  SetOutPath "$APPDATA\Kodi\addons\repository.clipia"
  File /r "${KODIPACK}\repository.clipia\*.*"
  SetOutPath "$APPDATA\Kodi\userdata"
  IfFileExists "$APPDATA\Kodi\userdata\autoexec.py" +2 0
    File "${KODIPACK}\autoexec.py"
  SetOutPath "$INSTDIR"
SectionEnd

Section /o "GLM-5.2 de Z.ai pour coder (facultatif, payant à l'usage)"
  DetailPrint "Ouverture de la page Z.ai pour créer ta clé API…"
  ExecShell "open" "https://z.ai/manage-apikey/apikey-list"
  DetailPrint "Colle ta clé dans Clipia : étape « GLM-5.2 de Z.ai » de l'assistant de démarrage, ou Réglages."
SectionEnd

!ifdef LOGICIELS
!define MUI_COMPONENTSPAGE_TEXT_TOP "Clipia est toujours installé. Coche en plus les logiciels libres que tu veux (téléchargés par Windows via winget : Internet requis, aucune clé). Tu pourras en ajouter plus tard dans Clipia > Logithèque."
!insertmacro MUI_PAGE_COMPONENTS
!endif
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "French"

Section "Clipia X10 (obligatoire)"
  SectionIn RO
  ; Ferme Clipia s'il tourne (sinon node.exe est verrouillé : « Erreur lors de l'ouverture du fichier en écriture »)
  DetailPrint "Fermeture de Clipia s'il est ouvert…"
  nsExec::Exec 'powershell -NoProfile -WindowStyle Hidden -Command "8787..8798 | ForEach-Object { try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 -Method POST -Headers @{\"x-clipia-accord\"=\"1\"} (\"http://127.0.0.1:\" + $_ + \"/api/systeme/quitter\") | Out-Null } catch {} }"'
  Sleep 1200
  nsExec::Exec 'powershell -NoProfile -WindowStyle Hidden -Command "$d=\"$INSTDIR\"; for($i=0;$i -lt 6;$i++){ $p=Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.StartsWith($d,[StringComparison]::OrdinalIgnoreCase) }; if(-not $p){break}; $p | Stop-Process -Force -ErrorAction SilentlyContinue; Start-Sleep -Milliseconds 700 }"'
  ; Filet de sécurité : un exécutable encore verrouillé peut être renommé, puis remplacé
  IfFileExists "$INSTDIR\runtime\node.exe" 0 +3
    Delete "$INSTDIR\runtime\node.old"
    Rename "$INSTDIR\runtime\node.exe" "$INSTDIR\runtime\node.old"
  IfFileExists "$INSTDIR\outils\ffmpeg.exe" 0 +3
    Delete "$INSTDIR\outils\ffmpeg.old"
    Rename "$INSTDIR\outils\ffmpeg.exe" "$INSTDIR\outils\ffmpeg.old"
  SetOutPath "$INSTDIR"
  File "${LAUNCHER}"
  File "${QUITTER}"
  File "/oname=Diagnostic-Clipia.bat" "${DIAG}"
  File "/oname=Audit-Clipia.bat" "${AUDITBAT}"
  SetOutPath "$INSTDIR\runtime"
  File "${NODE}"
  Delete /REBOOTOK "$INSTDIR\runtime\node.old"
!ifdef FFDIR
  SetOutPath "$INSTDIR\outils"
  File "${FFDIR}\ffmpeg.exe"
  File "/oname=FFMPEG-LICENCE.txt" "${FFDIR}\SOURCE.txt"
!endif
  SetOutPath "$INSTDIR\app"
  File /r "${APPDIR}\*.*"
  SetOutPath "$INSTDIR"
  File "/oname=LISEZ-MOI.txt" "${LISEZMOI}"
  WriteUninstaller "$INSTDIR\Desinstaller.exe"
  CreateDirectory "$SMPROGRAMS\Clipia"
  CreateShortcut "$SMPROGRAMS\Clipia\Clipia.lnk" "$INSTDIR\Clipia.exe"
  CreateShortcut "$SMPROGRAMS\Clipia\Quitter Clipia.lnk" "$INSTDIR\Quitter-Clipia.exe"
  CreateShortcut "$SMPROGRAMS\Clipia\Diagnostic Clipia.lnk" "$INSTDIR\Diagnostic-Clipia.bat"
  CreateShortcut "$SMPROGRAMS\Clipia\Audit complet Clipia.lnk" "$INSTDIR\Audit-Clipia.bat"
  CreateShortcut "$SMPROGRAMS\Clipia\Désinstaller Clipia.lnk" "$INSTDIR\Desinstaller.exe"
  CreateShortcut "$DESKTOP\Clipia.lnk" "$INSTDIR\Clipia.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Clipia" "DisplayName" "Clipia"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Clipia" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Clipia" "Publisher" "CLENDAX"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Clipia" "UninstallString" '"$INSTDIR\Desinstaller.exe"'
SectionEnd

!ifdef LOGICIELS
!include "${LOGICIELS}"
!endif

Section "Uninstall"
  ExecWait 'powershell -NoProfile -WindowStyle Hidden -Command "try{Invoke-WebRequest -UseBasicParsing -Method POST -Headers @{\"x-clipia-accord\"=\"1\"} http://127.0.0.1:8787/api/systeme/quitter | Out-Null}catch{}"'
  Sleep 800
  nsExec::Exec 'powershell -NoProfile -WindowStyle Hidden -Command "$d=\"$INSTDIR\"; Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.StartsWith($d,[StringComparison]::OrdinalIgnoreCase) -and $_.Id -ne $PID } | Stop-Process -Force -ErrorAction SilentlyContinue"'
  Sleep 600
  RMDir /r "$INSTDIR\app"
  RMDir /r "$INSTDIR\runtime"
  RMDir /r "$INSTDIR\outils"
  Delete "$INSTDIR\*.exe"
  Delete "$INSTDIR\Diagnostic-Clipia.bat"
  Delete "$INSTDIR\Audit-Clipia.bat"
  Delete "$INSTDIR\LISEZ-MOI.txt"
  RMDir "$INSTDIR"
  Delete "$DESKTOP\Clipia.lnk"
  RMDir /r "$SMPROGRAMS\Clipia"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Clipia"
  MessageBox MB_OK "Clipia est désinstallé.$\r$\nTes projets et réglages sont conservés dans $APPDATA\Clipia (supprime ce dossier pour tout effacer)."
SectionEnd
