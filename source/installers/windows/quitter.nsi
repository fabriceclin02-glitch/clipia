Unicode true
OutFile "${OUT}"
RequestExecutionLevel user
SilentInstall silent
Icon "${ICON}"
Section
  nsExec::Exec 'powershell -NoProfile -WindowStyle Hidden -Command "8787..8798 | ForEach-Object { try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 -Method POST -Headers @{\"x-clipia-accord\"=\"1\"} (\"http://127.0.0.1:\" + $_ + \"/api/systeme/quitter\") | Out-Null } catch {} }"'
SectionEnd
