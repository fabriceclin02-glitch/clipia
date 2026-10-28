/** CLIPIA Desktop — Electron. Démarre le serveur local puis ouvre le studio. */
const { app, BrowserWindow, shell, dialog, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { fork } = require('node:child_process');
const net = require('node:net');

const DEV = !app.isPackaged;
const APP_DIR = DEV ? path.join(__dirname, '..') : path.join(process.resourcesPath, 'app');
let serveur = null, win = null, PORT = 8787;

// ── journal, pour diagnostiquer quand rien ne s'affiche ────────────────
const LOG = path.join(app.getPath('userData'), 'clipia-demarrage.log');
function noter(...parts) {
  const ligne = `[${new Date().toISOString()}] ${parts.join(' ')}\n`;
  try { fs.appendFileSync(LOG, ligne); } catch {}
  process.stdout.write(ligne);
}
try { fs.mkdirSync(path.dirname(LOG), { recursive: true }); fs.writeFileSync(LOG, ''); } catch {}
noter('démarrage · electron', process.versions.electron, '· node', process.versions.node);
noter('plateforme', process.platform, process.arch, '· empaqueté', app.isPackaged);
noter('dossier app', APP_DIR);

const libre = p => new Promise(res => {
  const s = net.createServer()
    .once('error', () => res(false))
    .once('listening', () => s.close(() => res(true)))
    .listen(p, '127.0.0.1');
});
async function trouverPort() { for (let p = 8787; p < 8820; p++) if (await libre(p)) return p; return 8787; }

function lancerServeur() {
  return new Promise((resolve, reject) => {
    const entree = path.join(APP_DIR, 'server', 'index.js');
    if (!fs.existsSync(entree)) return reject(new Error(`Fichier serveur introuvable :\n${entree}\n\nL'archive a-t-elle été extraite entièrement ?`));
    noter('fork', entree, 'port', PORT);

    serveur = fork(entree, [], {
      cwd: APP_DIR,
      silent: true,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',        // indispensable sous Windows empaqueté
        PORT: String(PORT), HOST: '127.0.0.1',
        PUBLIC_URL: `http://127.0.0.1:${PORT}`,
        CLIPIA_DATA_DIR: path.join(app.getPath('userData'), 'data')
      }
    });

    let sortie = '';
    serveur.stdout?.on('data', d => { sortie += d; process.stdout.write('[clipia] ' + d); });
    serveur.stderr?.on('data', d => { sortie += d; noter('STDERR', String(d).trim()); });
    serveur.on('error', e => { noter('ERREUR fork', e.message); reject(e); });
    serveur.on('exit', (code, sig) => {
      noter('serveur arrêté · code', code, '· signal', sig);
      if (code !== 0 && code !== null) reject(new Error(`Le serveur s'est arrêté (code ${code}).\n\n${sortie.slice(-1200)}`));
    });

    const t0 = Date.now();
    const essai = async () => {
      try {
        const r = await fetch(`http://127.0.0.1:${PORT}/api/etat`);
        if (!r.ok) throw new Error('statut ' + r.status);
        noter('serveur prêt en', Date.now() - t0, 'ms');
        resolve();
      } catch {
        if (Date.now() - t0 > 30000) reject(new Error(`Le serveur n'a pas répondu en 30 secondes.\n\n${sortie.slice(-1200)}`));
        else setTimeout(essai, 350);
      }
    };
    setTimeout(essai, 600);
  });
}

/** Page d'erreur lisible, plutôt qu'une fenêtre blanche. */
function afficherErreur(message) {
  const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#070b16;color:#e9eefb;
    font-family:system-ui,sans-serif;padding:46px;line-height:1.6">
    <h1 style="color:#e0b25c;font-size:22px;margin:0 0 6px">Clipia n'a pas pu démarrer</h1>
    <p style="color:#95a3c4;margin:0 0 20px">Voici ce qui s'est passé :</p>
    <pre style="background:#111a31;border:1px solid #1f2b4a;border-radius:10px;padding:16px;
      white-space:pre-wrap;font-size:12.5px;color:#ff9c9c;overflow:auto;max-height:46vh">${
      String(message).replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]))}</pre>
    <p style="color:#95a3c4;font-size:13.5px;margin-top:20px">
      Journal complet :<br><code style="color:#f4d490;font-size:12px">${LOG.replace(/\\/g,'\\')}</code></p>
    <p style="color:#64739a;font-size:12.5px">Causes les plus fréquentes : archive partiellement extraite,
    antivirus ayant mis un fichier en quarantaine, ou port déjà occupé.</p></body>`;
  const w = new BrowserWindow({ width: 820, height: 580, backgroundColor: '#070b16' });
  w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
}

/**
 * Permissions du moteur de rendu.
 * Electron refuse TOUTES les demandes par défaut : sans ce gestionnaire,
 * getUserMedia échoue en silence et la dictée vocale ne démarre jamais.
 */
function autoriserPeripheriques(session) {
  const ACCORDEES = new Set(['media', 'audioCapture', 'mediaKeySystem', 'clipboard-read', 'clipboard-sanitized-write']);

  session.setPermissionRequestHandler((contenu, permission, repondre, details) => {
    const origine = details?.requestingUrl || contenu?.getURL() || '';
    const local = origine.startsWith(`http://127.0.0.1:${PORT}`) || origine.startsWith('http://localhost:');
    const ok = local && ACCORDEES.has(permission);
    noter('permission', permission, local ? '(locale)' : '(externe)', ok ? 'ACCORDÉE' : 'refusée');
    repondre(ok);
  });

  // Certaines demandes passent par le chemin synchrone (dont le micro).
  session.setPermissionCheckHandler((contenu, permission, origine) => {
    const local = String(origine || '').startsWith('http://127.0.0.1') || String(origine || '').startsWith('http://localhost');
    return local && ACCORDEES.has(permission);
  });

  // Choix automatique du micro par défaut quand le système en propose plusieurs.
  session.setDevicePermissionHandler(({ deviceType, origin }) => {
    const local = String(origin || '').startsWith('http://127.0.0.1') || String(origin || '').startsWith('http://localhost');
    return local && (deviceType === 'audioinput' || deviceType === 'hid' ? deviceType === 'audioinput' : false);
  });
}

function creerFenetre() {
  win = new BrowserWindow({
    width: 1420, height: 920, minWidth: 980, minHeight: 640,
    backgroundColor: '#070b16', show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    icon: path.join(__dirname, 'resources', process.platform === 'win32' ? 'icone.ico' : 'icone.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  autoriserPeripheriques(win.webContents.session);

  // Aucun service worker en application de bureau : il figerait l'interface
  // sur une version périmée après chaque mise à jour.
  win.webContents.session.clearStorageData({ storages: ['serviceworkers', 'cachestorage'] })
    .catch(() => {})
    .finally(() => win.loadURL(`http://127.0.0.1:${PORT}`));
  win.once('ready-to-show', () => { win.show(); noter('fenêtre affichée'); });
  win.webContents.on('did-fail-load', (_e, code, desc) => noter('échec de chargement', code, desc));
  win.webContents.on('render-process-gone', (_e, d) => noter('processus de rendu perdu', JSON.stringify(d)));
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(`http://127.0.0.1:${PORT}`)) { shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'allow' };
  });
}

const menu = () => Menu.setApplicationMenu(Menu.buildFromTemplate([
  ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
  { label: 'Fichier', submenu: [
    { label: 'Klipia (accueil vocal)', accelerator: 'CmdOrCtrl+H', click: () => win?.loadURL(`http://127.0.0.1:${PORT}/#/klipia`) },
    { label: 'Nouveau clip', accelerator: 'CmdOrCtrl+N', click: () => win?.loadURL(`http://127.0.0.1:${PORT}/#/clip`) },
    { label: 'Médiathèque', click: () => win?.loadURL(`http://127.0.0.1:${PORT}/#/medias`) },
    { type: 'separator' },
    { label: 'Dossier de données', click: () => shell.openPath(path.join(app.getPath('userData'), 'data')) },
    { label: 'Journal de démarrage', click: () => shell.openPath(LOG) },
    { type: 'separator' }, { role: 'quit', label: 'Quitter' } ] },
  { role: 'editMenu', label: 'Édition' },
  { label: 'Affichage', submenu: [
    { role: 'reload', label: 'Recharger' },
    { role: 'forceReload', label: 'Recharger sans le cache' },
    { role: 'toggleDevTools', label: 'Outils de développement' },
    { type: 'separator' },
    { role: 'resetZoom', label: 'Taille réelle' }, { role: 'zoomIn', label: 'Agrandir' },
    { role: 'zoomOut', label: 'Réduire' }, { type: 'separator' },
    { role: 'togglefullscreen', label: 'Plein écran' } ] },
  { label: 'Aide', submenu: [
    { label: 'IA locales gratuites', click: () => shell.openExternal('https://ollama.com/download') },
    { label: 'À propos', click: () => dialog.showMessageBox({ title: 'Clipia',
        message: 'Clipia 1.0.0\nStudio créatif IA\n\nUne idée. Tout est possible.' }) } ] }
]));

app.whenReady().then(async () => {
  PORT = await trouverPort();
  noter('port retenu', PORT);
  try { await lancerServeur(); }
  catch (e) {
    noter('ÉCHEC', e.message);
    afficherErreur(e.message);
    return;
  }
  menu(); creerFenetre();

  // Premier lancement : on pose le raccourci de bureau, une seule fois.
  setTimeout(async () => {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/api/raccourci`);
      const e = await r.json();
      if (!e.existe) {
        const c = await fetch(`http://127.0.0.1:${PORT}/api/raccourci`, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            cible: process.execPath,
            dossier: path.dirname(process.execPath),
            icone: path.join(path.dirname(process.execPath), 'clipia.ico')
          })
        });
        const j = await c.json();
        noter('raccourci', j.ok ? 'créé : ' + j.chemin : 'échec : ' + (j.erreur || ''));
      } else noter('raccourci déjà présent :', e.chemin);
    } catch (e) { noter('raccourci', 'non créé :', e.message); }
  }, 3500);
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && creerFenetre());
});
app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit());
app.on('before-quit', () => serveur?.kill());
process.on('uncaughtException', e => { noter('EXCEPTION', e.stack || e.message); });
