; Clipia — installeur Windows (sans droits administrateur, installé pour l'utilisateur courant)
Unicode true
Name "Clipia X8 ${VERSION}"
OutFile "${OUT}"
InstallDir "$LOCALAPPDATA\Programs\Clipia"
RequestExecutionLevel user
SetCompressor /SOLID lzma
!include "MUI2.nsh"
!include "LogicLib.nsh"
!define MUI_ICON "${ICON}"
!define MUI_UNICON "${ICON}"
!define MUI_WELCOMEPAGE_TEXT "Clipia X8 est un studio créatif IA : image, vidéo, musique, texte, projets et agents.$\r$\n$\r$\nCette installation embarque tout ce qu'il faut (pas besoin d'installer Node.js). Aucun droit administrateur n'est demandé.$\r$\n$\r$\nPour les modèles IA gratuits et hors ligne, installe aussi Ollama (une case à cocher à la fin te mène au téléchargement). Clipia téléchargera ensuite les modèles adaptés à ta machine, avec ton accord."
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

Section "Clipia X8 (obligatoire)"
  SectionIn RO
  SetOutPath "$INSTDIR"
  File "${LAUNCHER}"
  File "${QUITTER}"
  File "/oname=Diagnostic-Clipia.bat" "${DIAG}"
  SetOutPath "$INSTDIR\runtime"
  File "${NODE}"
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
  RMDir /r "$INSTDIR\app"
  RMDir /r "$INSTDIR\runtime"
  RMDir /r "$INSTDIR\outils"
  Delete "$INSTDIR\*.exe"
  Delete "$INSTDIR\Diagnostic-Clipia.bat"
  Delete "$INSTDIR\LISEZ-MOI.txt"
  RMDir "$INSTDIR"
  Delete "$DESKTOP\Clipia.lnk"
  RMDir /r "$SMPROGRAMS\Clipia"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Clipia"
  MessageBox MB_OK "Clipia est désinstallé.$\r$\nTes projets et réglages sont conservés dans $APPDATA\Clipia (supprime ce dossier pour tout effacer)."
SectionEnd
