// Mise à jour de Clipia Nova : vérifie la dernière version publiée sur GitHub, la télécharge,
// contrôle son empreinte SHA-256 puis l'installe (Windows : silencieux + relance ; Linux AppImage : remplacement ;
// Mac / .deb / version portable : le fichier est téléchargé et ouvert). Rien n'est installé sans le clic de l'utilisateur.
const { app, shell, net, Notification, BrowserWindow } = require('electron');
const fs = require('fs'), path = require('path'), crypto = require('crypto'), { spawn } = require('child_process');

const REPO = 'fabriceclin02-glitch/clipia';
const API = process.env.NOVA_UPDATE_API || `https://api.github.com/repos/${REPO}/releases?per_page=20`;
const TRUST = process.env.NOVA_UPDATE_API ? '' : `https://github.com/${REPO}/releases/download/`;
const ver = (s) => String(s).replace(/^nova-v|^v/, '').split('.').map(n => parseInt(n, 10) || 0);
const newer = (a, b) => { const x = ver(a), y = ver(b); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };

function wantedAsset() {
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  if (process.platform === 'win32') return process.env.PORTABLE_EXECUTABLE_FILE ? 'Clipia-Nova-Windows-Portable.exe' : 'Clipia-Nova-Windows-Installation.exe';
  if (process.platform === 'darwin') return `Clipia-Nova-Mac-${arch}.dmg`;
  if (process.env.APPIMAGE) return `Clipia-Nova-Linux-${process.arch === 'arm64' ? 'arm64' : 'x86_64'}.AppImage`;
  return `Clipia-Nova-Linux-${process.arch === 'arm64' ? 'arm64' : 'amd64'}.deb`;
}

async function check() {
  const cur = app.getVersion();
  try {
    const r = await net.fetch(API, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Clipia-Nova' } });
    if (!r.ok) return { ok: false, current: cur, error: 'Serveur injoignable (code ' + r.status + ')' };
    const rel = (await r.json()).filter(x => /^nova-v\d/.test(x.tag_name) && !x.draft && !x.prerelease)
      .sort((a, b) => newer(a.tag_name, b.tag_name) ? -1 : 1)[0];
    if (!rel) return { ok: true, current: cur, available: false };
    const v = rel.tag_name.replace('nova-v', '');
    if (!newer(v, cur)) return { ok: true, current: cur, latest: v, available: false };
    const name = wantedAsset(), asset = rel.assets.find(a => a.name === name), sums = rel.assets.find(a => /^SHA256SUMS/.test(a.name));
    if (!asset) return { ok: false, current: cur, latest: v, error: 'Aucun fichier « ' + name + ' » dans la version ' + v };
    return { ok: true, current: cur, latest: v, available: true, name, size: asset.size, url: asset.browser_download_url, sumsUrl: sums && sums.browser_download_url, notes: (rel.body || '').slice(0, 600) };
  } catch (e) { return { ok: false, current: cur, error: 'Pas de connexion (' + e.message + ')' }; }
}

async function download(info, send) {
  if (TRUST && !(info.url || '').startsWith(TRUST)) return { ok: false, error: 'Adresse de téléchargement refusée (hors du dépôt officiel).' };
  if (!info.sumsUrl) return { ok: false, error: 'Fichier d\'empreintes SHA-256 absent : installation refusée par sécurité.' };
  const dir = process.env.APPIMAGE ? path.dirname(process.env.APPIMAGE) : path.join(app.getPath('userData'), 'updates');
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, process.env.APPIMAGE ? '.Clipia-Nova-update.tmp' : info.name);
  try {
    const sumsTxt = await (await net.fetch(info.sumsUrl, { headers: { 'User-Agent': 'Clipia-Nova' } })).text();
    const line = sumsTxt.split('\n').find(l => l.trim().endsWith(info.name));
    const expected = line && line.trim().split(/\s+/)[0].toLowerCase();
    if (!expected || expected.length !== 64) return { ok: false, error: 'Empreinte introuvable pour ' + info.name };
    const r = await net.fetch(info.url, { headers: { 'User-Agent': 'Clipia-Nova' } });
    if (!r.ok || !r.body) return { ok: false, error: 'Téléchargement refusé (code ' + r.status + ')' };
    const total = Number(r.headers.get('content-length')) || info.size || 0, h = crypto.createHash('sha256'), out = fs.createWriteStream(dest);
    let got = 0, last = 0; const rd = r.body.getReader();
    for (;;) {
      const { done, value } = await rd.read(); if (done) break;
      h.update(value); got += value.length;
      if (!out.write(value)) await new Promise(ok => out.once('drain', ok));
      if (Date.now() - last > 150) { last = Date.now(); send('update:progress', { got, total }); }
    }
    await new Promise((ok, ko) => { out.end(); out.on('finish', ok); out.on('error', ko); });
    send('update:progress', { got, total: total || got });
    if (h.digest('hex') !== expected) { fs.rmSync(dest, { force: true }); return { ok: false, error: 'Le fichier téléchargé est corrompu ou modifié (empreinte SHA-256 différente) : installation annulée.' }; }
    return { ok: true, file: dest };
  } catch (e) { fs.rmSync(dest, { force: true }); return { ok: false, error: 'Téléchargement interrompu : ' + e.message }; }
}

function apply(file, info) {
  if (process.platform === 'win32' && !process.env.PORTABLE_EXECUTABLE_FILE) {
    spawn(file, ['--updated', '/S'], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    setTimeout(() => app.quit(), 600); return { ok: true, mode: 'auto', msg: 'Installation en cours : Clipia Nova va se fermer puis se rouvrir.' };
  }
  if (process.env.APPIMAGE) {
    try { fs.chmodSync(file, 0o755); fs.renameSync(file, process.env.APPIMAGE); app.relaunch({ execPath: process.env.APPIMAGE }); setTimeout(() => app.exit(0), 400); return { ok: true, mode: 'auto', msg: 'Mise à jour installée : redémarrage…' }; }
    catch (e) { return { ok: false, error: 'Remplacement impossible : ' + e.message }; }
  }
  if (process.platform === 'darwin') { shell.openPath(file); return { ok: true, mode: 'manual', msg: 'Image disque ouverte : glissez Clipia Nova dans Applications, puis relancez.' }; }
  shell.showItemInFolder(file);
  return { ok: true, mode: 'manual', msg: 'Fichier téléchargé et vérifié : ouvrez-le pour terminer l\'installation.' };
}

// Notification système (Windows, Mac, Linux) : une seule fois par nouvelle version, même si la fenêtre est réduite.
let notified = '';
function notify(r, send) {
  if (!r.available || notified === r.latest || !Notification.isSupported()) return;
  notified = r.latest;
  const n = new Notification({ title: 'Clipia Nova ' + r.latest + ' est disponible', body: 'Cliquez pour mettre à jour votre navigateur (vous avez la version ' + r.current + ').' });
  n.on('click', () => { const w = BrowserWindow.getAllWindows()[0]; if (w) { if (w.isMinimized()) w.restore(); w.show(); w.focus(); } send('update:open', r.latest); });
  n.show();
}

function init(ipcMain, send) {
  let info = null;
  if (process.platform === 'win32') app.setAppUserModelId('com.clendax.clipianova');
  ipcMain.handle('update:check', async () => { const r = await check(); info = r.available ? r : null; notify(r, send); return r; });
  ipcMain.handle('update:install', async () => {
    if (!info) return { ok: false, error: 'Aucune mise à jour à installer.' };
    const d = await download(info, send); if (!d.ok) return d;
    return apply(d.file, info);
  });
  ipcMain.handle('update:version', () => app.getVersion());
}
module.exports = { init, newer, check };
