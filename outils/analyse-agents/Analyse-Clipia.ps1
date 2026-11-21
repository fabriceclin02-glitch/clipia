# Clipia — Analyse et nettoyage des programmes en arrière-plan (agents, tâches, démarrage)
# Rien n'est arrêté ni supprimé sans que tu coches la ligne et confirmes.
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
$ErrorActionPreference = 'SilentlyContinue'
$MOTS = 'clipia|openclaw|ollama|kodi|nova|claude|agent|node|python|electron|n8n|autogpt|crewai|langchain|bot|cron|tailscale|cloudflared|ngrok'
$date = Get-Date -Format 'yyyy-MM-dd_HH-mm'
$bureau = [Environment]::GetFolderPath('Desktop')
$rapport = Join-Path $bureau "Rapport-Analyse-Clipia_$date.html"
$sauvegarde = Join-Path $bureau "Sauvegarde-demarrage_$date.reg"

function Suspect($nom, $chemin, $editeur) {
  $r = @()
  if ("$nom $chemin" -match $MOTS) { $r += 'agent / IA possible' }
  if ($chemin -match '\\AppData\\Local\\Temp\\|\\Temp\\|\\Downloads\\|\\Téléchargements\\') { $r += 'lancé depuis un dossier temporaire' }
  if ($chemin -and -not $editeur) { $r += 'éditeur inconnu' }
  return ($r -join ' · ')
}

$lignes = New-Object System.Collections.ArrayList

# 1. Processus
$cim = Get-CimInstance Win32_Process
foreach ($p in Get-Process) {
  $c = $cim | Where-Object ProcessId -eq $p.Id | Select-Object -First 1
  $chemin = $p.Path; $ed = $p.Company
  if ($chemin -match '^C:\\Windows\\') { continue }
  [void]$lignes.Add([pscustomobject]@{ Type='Processus'; Nom=$p.ProcessName; Detail="PID $($p.Id) · $chemin"; Commande=$c.CommandLine; Editeur=$ed; Alerte=(Suspect $p.ProcessName "$chemin $($c.CommandLine)" $ed); Cle=$p.Id })
}
# 2. Connexions réseau par processus
$connexions = Get-NetTCPConnection -State Established,Listen | Where-Object { $_.RemoteAddress -notmatch '^(127\.|::1|0\.0\.0\.0|::)$' -or $_.State -eq 'Listen' }
foreach ($n in $connexions) {
  $pp = Get-Process -Id $n.OwningProcess
  if (-not $pp -or $pp.Path -match '^C:\\Windows\\') { continue }
  $sens = if ($n.State -eq 'Listen') { "ENTRANT : écoute le port $($n.LocalPort)" } else { "SORTANT : vers $($n.RemoteAddress):$($n.RemotePort)" }
  [void]$lignes.Add([pscustomobject]@{ Type='Réseau'; Nom=$pp.ProcessName; Detail=$sens; Commande=$pp.Path; Editeur=$pp.Company; Alerte=(Suspect $pp.ProcessName $pp.Path $pp.Company); Cle=$pp.Id })
}
# 3. Tâches planifiées (hors Microsoft)
foreach ($t in Get-ScheduledTask | Where-Object { $_.TaskPath -notmatch '^\\Microsoft\\' -and $_.State -ne 'Disabled' }) {
  $act = ($t.Actions | ForEach-Object { "$($_.Execute) $($_.Arguments)" }) -join ' ; '
  [void]$lignes.Add([pscustomobject]@{ Type='Tâche planifiée'; Nom=$t.TaskName; Detail="$($t.TaskPath) · état : $($t.State)"; Commande=$act; Editeur=$t.Author; Alerte=(Suspect $t.TaskName $act $t.Author); Cle="$($t.TaskPath)|$($t.TaskName)" })
}
# 4. Démarrage automatique
$cles = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run','HKLM:\Software\Microsoft\Windows\CurrentVersion\Run','HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Run'
foreach ($k in $cles) {
  $v = Get-ItemProperty $k
  if (-not $v) { continue }
  foreach ($prop in $v.PSObject.Properties | Where-Object { $_.Name -notmatch '^PS' }) {
    [void]$lignes.Add([pscustomobject]@{ Type='Démarrage'; Nom=$prop.Name; Detail=$k; Commande=$prop.Value; Editeur=''; Alerte=(Suspect $prop.Name $prop.Value 'x'); Cle="$k|$($prop.Name)" })
  }
}
foreach ($dos in @([Environment]::GetFolderPath('Startup'), "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\StartUp")) {
  foreach ($f in Get-ChildItem $dos -File) {
    [void]$lignes.Add([pscustomobject]@{ Type='Démarrage'; Nom=$f.Name; Detail="Dossier Démarrage"; Commande=$f.FullName; Editeur=''; Alerte=(Suspect $f.Name $f.FullName 'x'); Cle="FICHIER|$($f.FullName)" })
  }
}
# 5. Services tiers en cours
foreach ($s in Get-CimInstance Win32_Service | Where-Object { $_.State -eq 'Running' -and $_.PathName -notmatch 'C:\\Windows\\' }) {
  [void]$lignes.Add([pscustomobject]@{ Type='Service'; Nom=$s.Name; Detail=$s.DisplayName; Commande=$s.PathName; Editeur=''; Alerte=(Suspect $s.Name $s.PathName 'x'); Cle=$s.Name })
}

# Rapport HTML
function H($t) { [System.Net.WebUtility]::HtmlEncode("$t") }
$corps = ($lignes | Sort-Object @{e={ if ($_.Alerte) {0} else {1} }}, Type, Nom | ForEach-Object {
  "<tr class='$(if ($_.Alerte) {'a'})'><td>$(H $_.Type)</td><td><b>$(H $_.Nom)</b></td><td>$(H $_.Detail)</td><td>$(H $_.Commande)</td><td>$(H $_.Editeur)</td><td>$(H $_.Alerte)</td></tr>" }) -join "`n"
$nbA = ($lignes | Where-Object Alerte).Count
@"
<!doctype html><html lang=fr><meta charset=utf-8><title>Rapport d'analyse Clipia</title>
<style>body{font:14px system-ui;margin:20px;background:#0b0d22;color:#eef}table{border-collapse:collapse;width:100%}td,th{border:1px solid #334;padding:5px;vertical-align:top;word-break:break-all}th{background:#1a1f4d}tr.a{background:#4a1f2a}</style>
<h1>Rapport d'analyse — $(Get-Date -Format 'dd/MM/yyyy HH:mm') — $env:COMPUTERNAME</h1>
<p>$($lignes.Count) éléments en arrière-plan hors Windows, dont <b>$nbA à vérifier</b> (en rouge). Analyse antivirus : voir Sécurité Windows → Historique de protection.</p>
<table><tr><th>Type</th><th>Nom</th><th>Détail</th><th>Commande / chemin</th><th>Éditeur</th><th>Alerte</th></tr>$corps</table></html>
"@ | Out-File -Encoding utf8 $rapport

# Fenêtre de choix
$f = New-Object Windows.Forms.Form
$f.Text = "Clipia — Analyse des agents et programmes en arrière-plan"; $f.Width = 1200; $f.Height = 720; $f.StartPosition = 'CenterScreen'
$g = New-Object Windows.Forms.DataGridView
$g.Dock = 'Top'; $g.Height = 560; $g.AllowUserToAddRows = $false; $g.SelectionMode = 'FullRowSelect'; $g.AutoSizeColumnsMode = 'Fill'
$col = New-Object Windows.Forms.DataGridViewCheckBoxColumn; $col.HeaderText = 'Choisir'; $col.FillWeight = 15; [void]$g.Columns.Add($col)
foreach ($n in 'Type','Nom','Détail','Commande','Alerte') { [void]$g.Columns.Add($n, $n) }
foreach ($ColN in 1..5) { $g.Columns[$ColN].ReadOnly = $true }
$tri = $lignes | Sort-Object @{e={ if ($_.Alerte) {0} else {1} }}, Type, Nom
foreach ($l in $tri) {
  $i = $g.Rows.Add($false, $l.Type, $l.Nom, $l.Detail, $l.Commande, $l.Alerte)
  $g.Rows[$i].Tag = $l
  if ($l.Alerte) { $g.Rows[$i].DefaultCellStyle.BackColor = [Drawing.Color]::MistyRose }
}
$info = New-Object Windows.Forms.Label
$info.Top = 570; $info.Left = 10; $info.Width = 1160; $info.Height = 40
$info.Text = "Rapport enregistré sur le Bureau : $rapport`nCoche les lignes puis choisis une action. Processus : arrêtés. Tâches : supprimées. Démarrage : retiré (sauvegarde .reg sur le Bureau). Services : arrêtés et désactivés."
function Bouton($texte, $x, $action) { $b = New-Object Windows.Forms.Button; $b.Text = $texte; $b.Left = $x; $b.Top = 620; $b.Width = 260; $b.Height = 40; $b.Add_Click($action); $f.Controls.Add($b) }
Bouton '🛑 Arrêter / supprimer la sélection' 10 {
  $sel = @($g.Rows | Where-Object { $_.Cells[0].Value -eq $true })
  if (-not $sel.Count) { [Windows.Forms.MessageBox]::Show('Coche au moins une ligne.'); return }
  if ([Windows.Forms.MessageBox]::Show("Arrêter ou supprimer $($sel.Count) élément(s) ? Cette action est immédiate.", 'Confirmation', 'YesNo', 'Warning') -ne 'Yes') { return }
  $journal = @()
  foreach ($r in $sel) {
    $l = $r.Tag
    try {
      switch ($l.Type) {
        'Processus' { Stop-Process -Id $l.Cle -Force -ErrorAction Stop; $journal += "Arrêté : $($l.Nom)" }
        'Réseau'    { Stop-Process -Id $l.Cle -Force -ErrorAction Stop; $journal += "Arrêté (réseau) : $($l.Nom)" }
        'Tâche planifiée' { $p = $l.Cle.Split('|'); Unregister-ScheduledTask -TaskPath $p[0] -TaskName $p[1] -Confirm:$false -ErrorAction Stop; $journal += "Tâche supprimée : $($l.Nom)" }
        'Démarrage' {
          $p = $l.Cle.Split('|')
          if ($p[0] -eq 'FICHIER') { Move-Item $p[1] "$bureau\$(Split-Path $p[1] -Leaf).desactive" -ErrorAction Stop }
          else { $reg = $p[0] -replace '^HKCU:', 'HKEY_CURRENT_USER' -replace '^HKLM:', 'HKEY_LOCAL_MACHINE'; reg export $reg $sauvegarde /y | Out-Null; Remove-ItemProperty -Path $p[0] -Name $p[1] -ErrorAction Stop }
          $journal += "Retiré du démarrage : $($l.Nom)"
        }
        'Service' { Stop-Service -Name $l.Cle -Force -ErrorAction Stop; Set-Service -Name $l.Cle -StartupType Disabled -ErrorAction Stop; $journal += "Service arrêté et désactivé : $($l.Nom)" }
      }
      $r.DefaultCellStyle.BackColor = [Drawing.Color]::Honeydew; $r.Cells[0].Value = $false
    } catch { $journal += "ÉCHEC pour $($l.Nom) : $($_.Exception.Message)" }
  }
  $journal | Out-File -Append -Encoding utf8 (Join-Path $bureau "Journal-nettoyage_$date.txt")
  [Windows.Forms.MessageBox]::Show(($journal -join "`n"), 'Résultat')
}
Bouton '🛡 Analyse antivirus complète' 280 {
  Start-Process powershell -ArgumentList '-NoProfile -Command "Start-MpScan -ScanType FullScan; Write-Host Analyse terminée. Résultats : Sécurité Windows > Historique de protection; pause"'
  [Windows.Forms.MessageBox]::Show("L'analyse complète Windows Defender a démarré dans une autre fenêtre. Elle peut durer plus d'une heure.")
}
Bouton '📄 Ouvrir le rapport' 550 { Start-Process $rapport }
Bouton '☑ Cocher tous les agents IA' 820 { foreach ($r in $g.Rows) { if ($r.Tag.Alerte -match 'agent') { $r.Cells[0].Value = $true } } }
$f.Controls.Add($g); $f.Controls.Add($info)
[void]$f.ShowDialog()
