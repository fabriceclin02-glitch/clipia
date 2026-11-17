// Clipia Nova — dépannage de l'ordinateur (diagnostic + réparations avec accord de l'utilisateur)
const os = require('os');
const fs = require('fs');
const path = require('path');
const { execFile, spawn } = require('child_process');

const WIN = process.platform === 'win32', MAC = process.platform === 'darwin';

// Commandes jamais exécutées, même si l'utilisateur clique : destruction de données, du système ou exécution de code téléchargé.
const BLOCKED = [
  /\bformat(\.com)?\s+[a-z]:/i, /\bdiskpart\b/i, /\bbcdedit\b/i, /\bcipher\s+\/w/i, /\bvssadmin\s+delete/i, /\bwbadmin\s+delete/i,
  /\breg(\.exe)?\s+delete\s+hk(lm|cr|ey_local_machine)/i, /remove-item[^\n]*(c:\\windows|system32|c:\\program files)/i,
  /\brd\s+\/s\s+\/q\s+[a-z]:\\?\s*$/i, /\bdel\s+(\/[sfq]\s+)+[a-z]:\\\*?/i, /\brm\s+-[a-z]*r[a-z]*f?\s+(--no-preserve-root\s+)?(\/|~|\/\*|\$home)\s*$/i,
  /\bmkfs/i, /\bdd\s+[^\n]*of=\/dev\//i, /:\(\)\s*\{/, /\b(shutdown|stop-computer|restart-computer|halt|poweroff)\b/i,
  /set-mppreference[^\n]*-disable/i, /\b(iwr|irm|invoke-webrequest|invoke-restmethod|curl|wget)\b[^\n]*\|\s*(iex|invoke-expression|sh|bash|zsh|python)/i,
  /\biex\s*\(/i, /invoke-expression/i, /\bnet\s+user\b[^\n]*\/(add|delete)/i, /\btakeown\b[^\n]*system32/i, /\bchmod\s+-R\s+777\s+\//i
];
function blocked(cmd) { return BLOCKED.some(r => r.test(cmd)); }

function run(file, args, { timeout = 120000 } = {}) {
  return new Promise(res => {
    execFile(file, args, { timeout, windowsHide: true, maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => {
      res({ code: err ? (err.code ?? 1) : 0, out: String(stdout || ''), err: String(stderr || '') + (err && err.killed ? '\n(délai dépassé)' : '') });
    });
  });
}
const ps = (cmd, o) => run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', '[Console]::OutputEncoding=[Text.Encoding]::UTF8;' + cmd], o);
const sh = (cmd, o) => run('/bin/sh', ['-c', cmd], o);
const clip = (s, n = 6000) => (s.length > n ? s.slice(0, n) + '\n… (tronqué)' : s);

/* ---------- Diagnostic (lecture seule) ---------- */
async function diagnose() {
  const t0 = os.cpus().map(c => c.times); await new Promise(r => setTimeout(r, 700)); const t1 = os.cpus().map(c => c.times);
  let idle = 0, total = 0;
  t1.forEach((t, i) => { const a = t0[i]; const d = k => t[k] - a[k]; const tt = d('user') + d('nice') + d('sys') + d('idle') + d('irq'); idle += d('idle'); total += tt; });
  const info = {
    systeme: `${os.type()} ${os.release()} (${os.arch()})`, machine: os.hostname(),
    processeur: `${os.cpus()[0]?.model || '?'} · ${os.cpus().length} cœurs`, cpuPct: total ? Math.round(100 - idle / total * 100) : 0,
    ramTotGo: +(os.totalmem() / 2 ** 30).toFixed(1), ramLibreGo: +(os.freemem() / 2 ** 30).toFixed(1),
    allumeDepuis: Math.round(os.uptime() / 3600) + ' h', disques: [], processus: [], reseau: {}, demarrage: [], plateforme: process.platform
  };
  info.ramPct = Math.round((1 - info.ramLibreGo / info.ramTotGo) * 100);
  try {
    if (WIN) {
      const d = await ps("Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' | Select DeviceID,Size,FreeSpace | ConvertTo-Json -Compress");
      [].concat(JSON.parse(d.out || '[]')).forEach(x => x && x.Size && info.disques.push({ nom: x.DeviceID, totGo: Math.round(x.Size / 2 ** 30), libreGo: Math.round(x.FreeSpace / 2 ** 30) }));
      const p = await ps("Get-Process | Sort-Object WorkingSet64 -Descending | Select -First 8 Name,@{n='MemMo';e={[int]($_.WorkingSet64/1MB)}},@{n='CPU';e={[int]$_.CPU}} | ConvertTo-Json -Compress");
      info.processus = [].concat(JSON.parse(p.out || '[]')).map(x => ({ nom: x.Name, memMo: x.MemMo, cpuS: x.CPU }));
      const s = await ps("Get-CimInstance Win32_StartupCommand | Select -First 15 Name | ConvertTo-Json -Compress");
      info.demarrage = [].concat(JSON.parse(s.out || '[]')).map(x => x && x.Name).filter(Boolean);
      const tmp = await ps("[int]((Get-ChildItem $env:TEMP -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum/1MB)");
      info.tempMo = parseInt(tmp.out) || 0;
      const up = await ps("(Get-HotFix | Sort-Object InstalledOn -Descending | Select -First 1).InstalledOn");
      info.derniereMaj = up.out.trim().split(/\s+/)[0] || '?';
    } else {
      const d = await sh("df -kP / /home 2>/dev/null | tail -n +2");
      const seen = new Set();
      d.out.trim().split('\n').forEach(l => { const c = l.split(/\s+/); if (c.length > 5 && !seen.has(c[0])) { seen.add(c[0]); info.disques.push({ nom: c[5], totGo: Math.round(c[1] / 2 ** 20), libreGo: Math.round(c[3] / 2 ** 20) }); } });
      const p = await sh(MAC ? "ps -Ao comm,rss,%cpu -m | head -9" : "ps -eo comm,rss,%cpu --sort=-rss | head -9");
      info.processus = p.out.trim().split('\n').slice(1).map(l => { const c = l.trim().split(/\s+/); const cpu = c.pop(), rss = c.pop(); return { nom: path.basename(c.join(' ')), memMo: Math.round(rss / 1024), cpuPct: +cpu }; });
      const tmp = await sh('du -sm "${TMPDIR:-/tmp}" 2>/dev/null | cut -f1'); info.tempMo = parseInt(tmp.out) || 0;
    }
  } catch (e) { info.erreur = String(e.message || e); }
  // réseau
  try {
    const dns = await new Promise(r => require('dns').lookup('www.google.com', e => r(!e)));
    const t = Date.now(); let web = false;
    try { const c = new AbortController(); setTimeout(() => c.abort(), 5000); const r = await fetch('https://www.google.com/generate_204', { signal: c.signal }); web = r.status === 204 || r.ok; } catch {}
    info.reseau = { dns, internet: web, latenceMs: web ? Date.now() - t : null };
  } catch { info.reseau = { dns: false, internet: false }; }
  return info;
}

/* ---------- Réparations rapides prêtes à l'emploi ---------- */
const QUICK = WIN ? [
  { id: 'temp', titre: 'Nettoyer les fichiers temporaires', pourquoi: 'Libère de la place et accélère Windows.', cmd: 'Remove-Item "$env:TEMP\\*" -Recurse -Force -ErrorAction SilentlyContinue; "Fichiers temporaires nettoyés."', risque: 'faible' },
  { id: 'corbeille', titre: 'Vider la corbeille', pourquoi: 'Récupère l\'espace occupé par les fichiers supprimés.', cmd: 'Clear-RecycleBin -Force -ErrorAction SilentlyContinue; "Corbeille vidée."', risque: 'moyen' },
  { id: 'dns', titre: 'Vider le cache DNS', pourquoi: 'Règle beaucoup de sites qui ne s\'ouvrent plus.', cmd: 'ipconfig /flushdns', risque: 'faible' },
  { id: 'explorer', titre: 'Redémarrer l\'Explorateur Windows', pourquoi: 'Débloque la barre des tâches ou le bureau figés.', cmd: 'Stop-Process -Name explorer -Force; Start-Sleep 1; Start-Process explorer; "Explorateur redémarré."', risque: 'faible' },
  { id: 'reseau', titre: 'Réinitialiser le réseau', pourquoi: 'Quand internet ne marche plus du tout (redémarrage conseillé ensuite).', cmd: 'netsh winsock reset; netsh int ip reset', risque: 'moyen', admin: true },
  { id: 'sfc', titre: 'Réparer les fichiers système', pourquoi: 'Vérifie et répare Windows (10 à 20 minutes).', cmd: 'sfc /scannow', risque: 'faible', admin: true, long: true },
  { id: 'dism', titre: 'Réparer l\'image de Windows', pourquoi: 'Si la réparation des fichiers système n\'a pas suffi.', cmd: 'DISM /Online /Cleanup-Image /RestoreHealth', risque: 'faible', admin: true, long: true },
  { id: 'maj', titre: 'Mettre à jour les logiciels', pourquoi: 'Installe les mises à jour des applications via winget.', cmd: 'winget upgrade --all --accept-source-agreements --accept-package-agreements --silent', risque: 'moyen', long: true }
] : MAC ? [
  { id: 'temp', titre: 'Nettoyer les fichiers temporaires', pourquoi: 'Libère de la place.', cmd: 'find "${TMPDIR:-/tmp}" -user "$(id -u)" -type f -mtime +1 -delete 2>/dev/null; echo "Fichiers temporaires nettoyés."', risque: 'faible' },
  { id: 'dns', titre: 'Vider le cache DNS', pourquoi: 'Règle les sites qui ne s\'ouvrent plus.', cmd: 'dscacheutil -flushcache; killall -HUP mDNSResponder', risque: 'faible', admin: true },
  { id: 'finder', titre: 'Relancer le Finder et le Dock', pourquoi: 'Débloque un bureau figé.', cmd: 'killall Finder; killall Dock; echo "Finder et Dock relancés."', risque: 'faible' },
  { id: 'maj', titre: 'Chercher les mises à jour macOS', pourquoi: 'Liste les mises à jour disponibles.', cmd: 'softwareupdate -l', risque: 'faible', long: true }
] : [
  { id: 'temp', titre: 'Nettoyer les fichiers temporaires', pourquoi: 'Libère de la place.', cmd: 'find /tmp -user "$(id -u)" -type f -mtime +1 -delete 2>/dev/null; echo "Fichiers temporaires nettoyés."', risque: 'faible' },
  { id: 'dns', titre: 'Vider le cache DNS', pourquoi: 'Règle les sites qui ne s\'ouvrent plus.', cmd: 'resolvectl flush-caches 2>/dev/null || systemd-resolve --flush-caches; echo "Cache DNS vidé."', risque: 'faible' },
  { id: 'maj', titre: 'Mettre à jour le système', pourquoi: 'Installe les mises à jour (Debian, Ubuntu, Mint).', cmd: 'apt-get update && apt-get -y upgrade', risque: 'moyen', admin: true, long: true }
];

/* ---------- Exécution (toujours après accord explicite dans l'interface) ---------- */
async function execute({ cmd, admin }, userData) {
  if (!cmd || typeof cmd !== 'string') return { code: 1, out: '', err: 'Commande vide' };
  if (blocked(cmd)) return { code: 1, blocked: true, out: '', err: 'Commande bloquée par le bouclier de Clipia Nova : elle pourrait détruire des données ou le système.' };
  const logf = path.join(userData, 'depannage.log');
  fs.appendFileSync(logf, `\n[${new Date().toISOString()}] ${admin ? '(admin) ' : ''}${cmd}\n`);
  const timeout = 30 * 60000;
  let r;
  if (WIN) {
    if (!admin) r = await ps(cmd, { timeout });
    else {
      const id = Date.now(), dir = os.tmpdir();
      const script = path.join(dir, `clipia-${id}.ps1`), out = path.join(dir, `clipia-${id}.txt`);
      fs.writeFileSync(script, '\ufeff' + `& { ${cmd} } *> "${out}"`, 'utf8');
      r = await ps(`Start-Process powershell.exe -Verb RunAs -Wait -WindowStyle Hidden -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','"${script}"'`, { timeout });
      let txt = ''; try { txt = fs.readFileSync(out, 'utf16le'); if (!/[a-z]/i.test(txt)) txt = fs.readFileSync(out, 'utf8'); } catch {}
      try { fs.unlinkSync(script); fs.unlinkSync(out); } catch {}
      if (r.code && /annul|cancel/i.test(r.err)) r.err = 'Autorisation administrateur refusée.';
      r.out = txt || r.out;
    }
  } else if (MAC && admin) {
    r = await run('osascript', ['-e', `do shell script ${JSON.stringify(cmd)} with administrator privileges`], { timeout });
  } else if (admin) {
    r = await run('pkexec', ['/bin/sh', '-c', cmd], { timeout });
  } else r = await sh(cmd, { timeout });
  fs.appendFileSync(logf, `→ code ${r.code}\n${clip(r.out, 2000)}\n${clip(r.err, 1000)}\n`);
  return { code: r.code, out: clip(r.out), err: clip(r.err, 3000) };
}

module.exports = { diagnose, execute, QUICK, blocked, shellName: WIN ? 'PowerShell' : MAC ? 'Terminal macOS (zsh)' : 'Terminal Linux (sh)' };
