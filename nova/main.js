// Clipia Nova — processus principal (Electron / Chromium)
const { app, BrowserWindow, ipcMain, shell, session, safeStorage, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1400, height: 900, minWidth: 900, minHeight: 600,
    backgroundColor: '#07061a', title: 'Clipia Nova', autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, webviewTag: true
    }
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

// Liens "nouvelle fenêtre" des sites -> nouvel onglet Nova
app.on('web-contents-created', (_e, contents) => {
  if (contents.getType() === 'webview') {
    contents.setWindowOpenHandler(({ url }) => {
      if (win) win.webContents.send('nova:open-tab', url);
      return { action: 'deny' };
    });
  }
});

/* ---------- Moteurs IA ----------
   Tous en format compatible OpenAI, sauf Anthropic (Claude) qui a son API native.
   Les clés restent sur l'ordinateur de l'utilisateur et ne partent que vers le fournisseur choisi. */
const PROVIDERS = {
  anthropic:  { base: 'https://api.anthropic.com/v1', native: true },
  openai:     { base: 'https://api.openai.com/v1' },
  gemini:     { base: 'https://generativelanguage.googleapis.com/v1beta/openai' },
  mistral:    { base: 'https://api.mistral.ai/v1' },
  deepseek:   { base: 'https://api.deepseek.com' },
  groq:       { base: 'https://api.groq.com/openai/v1' },
  xai:        { base: 'https://api.x.ai/v1' },
  zai:        { base: 'https://api.z.ai/api/paas/v4' },
  openrouter: { base: 'https://openrouter.ai/api/v1' },
  ollama:     { base: 'http://localhost:11434/v1', local: true }
};

function headersFor(id, key) {
  if (id === 'anthropic') return { 'Content-Type': 'application/json', 'x-api-key': key || '', 'anthropic-version': '2023-06-01' };
  const h = { 'Content-Type': 'application/json' };
  if (key) h.Authorization = 'Bearer ' + key;
  if (id === 'openrouter') { h['HTTP-Referer'] = 'https://fabriceclin02-glitch.github.io/clipia/'; h['X-Title'] = 'Clipia Nova'; }
  return h;
}

function errMsg(id, data, status) {
  const m = data && data.error && (data.error.message || data.error);
  return (typeof m === 'string' ? m : '') || ('Erreur ' + status + (status === 401 ? ' : clé API refusée' : ''));
}

ipcMain.handle('ai:chat', async (_e, { provider, apiKey, model, system, messages }) => {
  const p = PROVIDERS[provider];
  if (!p) return { error: 'Moteur inconnu' };
  try {
    if (p.native) {
      const res = await fetch(p.base + '/messages', {
        method: 'POST', headers: headersFor(provider, apiKey),
        body: JSON.stringify({ model, max_tokens: 2048, system, messages })
      });
      const data = await res.json();
      if (!res.ok) return { error: errMsg(provider, data, res.status) };
      return { text: (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n') };
    }
    const msgs = system ? [{ role: 'system', content: system }, ...messages] : messages;
    const res = await fetch(p.base + '/chat/completions', {
      method: 'POST', headers: headersFor(provider, apiKey),
      body: JSON.stringify({ model, messages: msgs })
    });
    const data = await res.json();
    if (!res.ok) return { error: errMsg(provider, data, res.status) };
    return { text: data.choices?.[0]?.message?.content ?? '' };
  } catch (err) {
    return { error: p.local ? 'Ollama ne répond pas : lancez Ollama sur ce PC puis réessayez.' : 'Connexion impossible : ' + err.message };
  }
});

// Liste des modèles réellement disponibles avec la clé de l'utilisateur
ipcMain.handle('ai:models', async (_e, { provider, apiKey }) => {
  const p = PROVIDERS[provider];
  if (!p) return { error: 'Moteur inconnu' };
  try {
    const res = await fetch(p.base + '/models', { headers: headersFor(provider, apiKey) });
    const data = await res.json();
    if (!res.ok) return { error: errMsg(provider, data, res.status) };
    const list = (data.data || data.models || []).map(m => (m.id || m.name || '').replace(/^models\//, '')).filter(Boolean);
    return { models: [...new Set(list)].sort() };
  } catch (err) {
    return { error: p.local ? 'Ollama ne répond pas sur ce PC.' : 'Connexion impossible : ' + err.message };
  }
});

ipcMain.handle('nova:open-external', (_e, url) => shell.openExternal(url));

/* ---------- Coffre-fort des clés API ----------
   Chiffrement par le système (Windows DPAPI, trousseau macOS, libsecret Linux). */
const keyFile = () => path.join(app.getPath('userData'), 'nova-keys.json');
function readVault() {
  try {
    const raw = JSON.parse(fs.readFileSync(keyFile(), 'utf8'));
    const out = {};
    for (const [k, v] of Object.entries(raw)) {
      out[k] = v.enc ? safeStorage.decryptString(Buffer.from(v.data, 'base64')) : Buffer.from(v.data, 'base64').toString('utf8');
    }
    return out;
  } catch { return {}; }
}
function writeVault(keys) {
  const enc = safeStorage.isEncryptionAvailable();
  const raw = {};
  for (const [k, v] of Object.entries(keys)) {
    if (!v) continue;
    raw[k] = enc ? { enc: true, data: safeStorage.encryptString(v).toString('base64') } : { enc: false, data: Buffer.from(v).toString('base64') };
  }
  fs.writeFileSync(keyFile(), JSON.stringify(raw), { mode: 0o600 });
  return enc;
}
ipcMain.handle('keys:get', () => readVault());
ipcMain.handle('keys:set', (_e, keys) => ({ encrypted: writeVault(keys) }));
ipcMain.handle('keys:wipe', () => { try { fs.unlinkSync(keyFile()); } catch {} return true; });

/* ---------- Bouclier : traqueurs, HTTPS, autorisations ---------- */
const TRACKERS = [
  'doubleclick.net', 'google-analytics.com', 'googletagmanager.com', 'googlesyndication.com', 'googleadservices.com',
  'adservice.google.com', 'scorecardresearch.com', 'quantserve.com', 'criteo.com', 'criteo.net', 'taboola.com',
  'outbrain.com', 'adnxs.com', 'amazon-adsystem.com', 'hotjar.com', 'hotjar.io', 'mixpanel.com', 'segment.io',
  'segment.com', 'moatads.com', 'rubiconproject.com', 'pubmatic.com', 'openx.net', 'casalemedia.com', 'smartadserver.com',
  'adsrvr.org', 'bidswitch.net', 'yieldmo.com', 'teads.tv', 'chartbeat.com', 'newrelic.com', 'nr-data.net',
  'clarity.ms', 'bat.bing.com', 'ads-twitter.com', 'analytics.tiktok.com', 'connect.facebook.net/en_US/fbevents.js'
];
const shield = { trackers: true, https: true, blocked: 0 };
const isTracker = (u) => { try { const x = new URL(u); const h = x.hostname; return TRACKERS.some(t => t.includes('/') ? u.includes(t) : (h === t || h.endsWith('.' + t))); } catch { return false; } };
const isLocal = (u) => /^http:\/\/(localhost|127\.|192\.168\.|10\.)/.test(u);

function protect(ses) {
  ses.setUserAgent(ses.getUserAgent().replace(/Electron\/\S+\s?/, '').replace(/clipia-nova\/\S+\s?/i, ''));
  ses.webRequest.onBeforeRequest((details, cb) => {
    const u = details.url;
    if (shield.trackers && details.resourceType !== 'mainFrame' && isTracker(u)) {
      shield.blocked++;
      if (win) win.webContents.send('nova:blocked', shield.blocked);
      return cb({ cancel: true });
    }
    if (shield.https && u.startsWith('http://') && !isLocal(u) && details.resourceType === 'mainFrame') {
      return cb({ redirectURL: 'https://' + u.slice(7) });
    }
    cb({});
  });
  // Caméra, micro, position, notifications : on demande toujours à l'utilisateur
  ses.setPermissionRequestHandler(async (wc, permission, callback, details) => {
    const sensibles = { media: 'la caméra / le micro', geolocation: 'votre position', notifications: 'les notifications', 'clipboard-read': 'votre presse-papiers' };
    if (!sensibles[permission]) return callback(permission === 'fullscreen' || permission === 'pointerLock');
    let site = '';
    try { site = new URL(details.requestingUrl || wc.getURL()).hostname; } catch {}
    const r = await dialog.showMessageBox(win, {
      type: 'question', buttons: ['Refuser', 'Autoriser'], defaultId: 0, cancelId: 0,
      title: 'Clipia Nova — Bouclier', message: `${site} veut accéder à ${sensibles[permission]}.`,
      detail: 'Clipia Nova ne donne jamais cet accès sans votre accord.'
    });
    callback(r.response === 1);
  });
}
ipcMain.handle('shield:set', (_e, s) => { Object.assign(shield, s); return shield; });
ipcMain.handle('shield:get', () => shield);
ipcMain.handle('privacy:clear', async () => {
  const ses = session.fromPartition('persist:nova');
  await ses.clearStorageData(); await ses.clearCache();
  return true;
});

app.whenReady().then(() => {
  protect(session.defaultSession);
  protect(session.fromPartition('persist:nova'));
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
