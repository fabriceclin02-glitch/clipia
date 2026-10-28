/**
 * CLIPIA V5 — Superviseur : lance le serveur, le relance s'il s'arrête, journalise tout,
 * choisit un port libre, n'ouvre le navigateur QUE quand le serveur répond, et dit clairement
 * ce qui ne va pas (au lieu d'une page « Failed to fetch »).
 */
import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const DATA = process.env.CLIPIA_DATA_DIR || path.join(ICI, '..', 'data');
fs.mkdirSync(DATA, { recursive: true });
const LOG = path.join(DATA, 'clipia.log');
const PORT0 = Number(process.env.PORT || 8787);

function log(t) {
  const l = `${new Date().toISOString()}  ${t}\n`;
  try {
    if (fs.existsSync(LOG) && fs.statSync(LOG).size > 2_000_000) fs.renameSync(LOG, LOG + '.ancien');
    fs.appendFileSync(LOG, l);
  } catch {}
}
const attendre = ms => new Promise(r => setTimeout(r, ms));
const sante = (port) => new Promise(ok => {
  const q = http.get({ host: '127.0.0.1', port, path: '/api/etat', timeout: 2500 }, r => { r.resume(); ok(r.statusCode === 200); });
  q.on('error', () => ok(false)); q.on('timeout', () => { q.destroy(); ok(false); });
});
const libre = (port) => new Promise(ok => {
  const s = net.createServer(); s.once('error', () => ok(false));
  s.once('listening', () => s.close(() => ok(true))); s.listen(port, '127.0.0.1');
});
function ouvrir(url) {
  if (process.env.CLIPIA_NO_BROWSER) return;
  try {
    if (process.platform === 'win32') spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    else if (process.platform === 'darwin') spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    else spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
  } catch (e) { log('ouverture du navigateur impossible : ' + e.message); }
}
function boite(titre, texte) {
  log('MESSAGE : ' + texte.replace(/\n/g, ' | '));
  const f = path.join(DATA, 'ERREUR-CLIPIA.txt');
  try { fs.writeFileSync(f, '\ufeff' + texte); } catch {}
  if (process.platform !== 'win32') { console.error(texte); return; }
  try {
    const ps = "Add-Type -AssemblyName System.Windows.Forms; $t = Get-Content -Raw -Encoding UTF8 -LiteralPath '" + f.replace(/'/g, "''") + "'; [System.Windows.Forms.MessageBox]::Show($t, '" + titre + "', 'OK', 'Warning') | Out-Null";
    spawnSync('powershell', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', ps], { windowsHide: true });
  } catch {}
}

log(`=== démarrage du superviseur (node ${process.version}, ${process.platform}) ===`);

// 1. Clipia est déjà ouvert ? On ouvre simplement la page.
for (let p = PORT0; p < PORT0 + 12; p++) {
  if (await sante(p)) { log(`Clipia répond déjà sur ${p}`); ouvrir(`http://127.0.0.1:${p}`); process.exit(0); }
}
// 2. Premier port libre
let port = 0;
for (let p = PORT0; p < PORT0 + 12; p++) { if (await libre(p)) { port = p; break; } }
if (!port) { boite('Clipia', `Aucun port libre entre ${PORT0} et ${PORT0 + 11}.\nFerme les autres programmes ou redémarre l'ordinateur.`); process.exit(2); }
try { fs.writeFileSync(path.join(DATA, 'port.txt'), String(port)); } catch {}

// 3. Boucle de supervision
let ouvert = false, rapides = 0, derniers = [];
const debut = [];
while (true) {
  const t0 = Date.now();
  log(`lancement du serveur sur le port ${port}`);
  const enfant = spawn(process.execPath, [path.join(ICI, 'index.js')], {
    env: { ...process.env, PORT: String(port), CLIPIA_DATA_DIR: DATA }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
  });
  const garder = d => { const t = String(d); derniers.push(t); derniers = derniers.slice(-40); try { fs.appendFileSync(LOG, t); } catch {} };
  enfant.stdout.on('data', garder); enfant.stderr.on('data', garder);
  const fin = new Promise(r => { enfant.on('exit', (code, sig) => r({ code, sig })); enfant.on('error', e => r({ code: -1, erreur: e.message })); });
  // attente de santé (20 s)
  if (!ouvert) {
    (async () => {
      for (let i = 0; i < 40; i++) { if (await sante(port)) { ouvert = true; log('serveur prêt'); ouvrir(`http://127.0.0.1:${port}`); return; } await attendre(500); }
    })();
  }
  const { code, sig, erreur } = await fin;
  log(`le serveur s'est arrêté (code ${code}, signal ${sig || '-'}${erreur ? ', ' + erreur : ''}) après ${Math.round((Date.now() - t0) / 1000)} s`);
  if (code === 0) { log('arrêt demandé : fin.'); process.exit(0); }
  if (Date.now() - t0 < 15000) rapides++; else rapides = 0;
  if (rapides >= 4) {
    const fin40 = derniers.join('').split('\n').filter(Boolean).slice(-8).join('\n');
    boite('Clipia ne démarre pas', `Clipia s'arrête dès son lancement.\n\nDernières lignes :\n${fin40}\n\nJournal complet : ${LOG}`);
    process.exit(1);
  }
  await attendre(Math.min(8000, 1000 * (rapides + 1)));
}
