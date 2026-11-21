// Clipia Nova 2 — processus principal (Electron / Chromium)
const { app, BrowserWindow, ipcMain, shell, session, safeStorage, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');
const { spawn } = require('child_process');
const sys = require('./system.js');

let win;
const DEMO = process.env.NOVA_DEMO === '1';   // mode démonstration (vidéo de présentation)

app.setName('Clipia Nova');
// Clés d'accès (passkeys / Windows Hello) : Windows les refuse aux applications non signées
// (« application non vérifiée »). On les désactive pour que Google, TikTok… proposent le mot de passe.
if (process.env.NOVA_PASSKEYS !== '1') app.commandLine.appendSwitch('disable-blink-features', 'WebAuth');
if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 900, minHeight: 600,
    backgroundColor: '#07061a', title: 'Clipia Nova', autoHideMenuBar: true,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, webviewTag: true }
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'), DEMO ? { query: { demo: '1' } } : undefined);
  win.on('enter-full-screen', () => win.webContents.send('nova:fullscreen', true));
  win.on('leave-full-screen', () => win.webContents.send('nova:fullscreen', false));
  win.on('closed', () => { win = null; });
}

/* ---------- Onglets : nouvelles fenêtres, raccourcis, WebRTC ---------- */
app.on('web-contents-created', (_e, contents) => {
  if (contents.getType() !== 'webview') return;
  const tor = contents.session === torSession;
  if (tor) contents.setWebRTCIPHandlingPolicy('disable_non_proxied_udp');   // pas de fuite d'IP via WebRTC
  contents.setWindowOpenHandler(({ url, disposition }) => {
    // Fenêtre de connexion (Google, Apple, Facebook, Microsoft, TikTok…) : vraie fenêtre liée à la page,
    // sinon la page d'origine ne reçoit jamais la réponse (page blanche « gsi/transform »).
    const login = /(accounts\.google\.|appleid\.apple\.com|facebook\.com\/(v[\d.]+\/)?dialog|login\.(live|microsoftonline)\.com|api\.twitter\.com\/oauth|x\.com\/i\/oauth|tiktok\.com\/.*(passport|login|auth)|discord\.com\/oauth2|github\.com\/login|paypal\.com\/.*(signin|checkoutnow|webapps))/i.test(url);
    if (disposition === 'new-window' || login) {
      return { action: 'allow', overrideBrowserWindowOptions: { width: 520, height: 720, parent: win || undefined, autoHideMenuBar: true, backgroundColor: '#ffffff', title: 'Connexion — Clipia Nova', icon: path.join(__dirname, 'build', 'icon.png') } };
    }
    if (win) win.webContents.send('nova:open-tab', { url, tor });
    return { action: 'deny' };
  });
  // Les raccourcis clavier marchent aussi quand une page web a le focus
  contents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || !win) return;
    const mod = input.control || input.meta;
    const k = (input.key || '').toLowerCase();
    const global = (mod && ['t', 'w', 'l', 'j', 'd', 'h', 'f', 'r', 'p', 'tab', ',', '/', ' ', '=', '+', '-', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'n', 'm', 's', 'k', 'b', 'e', 'x'].includes(k))
      || ['f1', 'f5', 'f11', 'escape', 'browserback', 'browserforward'].includes(k)
      || (input.alt && ['arrowleft', 'arrowright', 'home', 'r'].includes(k));
    if (global) {
      event.preventDefault();
      win.webContents.send('nova:key', { key: input.key, code: input.code, ctrl: mod, shift: input.shift, alt: input.alt });
    }
  });
});

/* ---------- Moteurs IA ---------- */
const PROVIDERS = {
  anthropic:  { base: 'https://api.anthropic.com/v1', native: true },
  openai:     { base: 'https://api.openai.com/v1' },
  gemini:     { base: 'https://generativelanguage.googleapis.com/v1beta/openai' },
  mistral:    { base: 'https://api.mistral.ai/v1' },
  deepseek:   { base: 'https://api.deepseek.com' },
  groq:       { base: 'https://api.groq.com/openai/v1' },
  xai:        { base: 'https://api.x.ai/v1' },
  zai:        { base: 'https://api.z.ai/api/paas/v4' },
  moonshot:   { base: 'https://api.moonshot.ai/v1' },
  openrouter: { base: 'https://openrouter.ai/api/v1' },
  ollama:     { base: 'http://localhost:11434/v1', local: true }
};
function headersFor(id, key, json = true) {
  if (id === 'anthropic') return { 'Content-Type': 'application/json', 'x-api-key': key || '', 'anthropic-version': '2023-06-01' };
  const h = json ? { 'Content-Type': 'application/json' } : {};
  if (key) h.Authorization = 'Bearer ' + key;
  if (id === 'openrouter') { h['HTTP-Referer'] = 'https://fabriceclin02-glitch.github.io/clipia/'; h['X-Title'] = 'Clipia Nova'; }
  return h;
}
function errMsg(data, status) {
  const m = data && data.error && (data.error.message || data.error);
  return (typeof m === 'string' ? m : '') || ('Erreur ' + status + (status === 401 ? ' : clé API refusée' : status === 429 ? ' : quota dépassé' : ''));
}
const baseOf = (id, host) => (id === 'ollama' && host ? host.replace(/\/$/, '') + '/v1' : PROVIDERS[id].base);

const DEMO_ANSWERS = [
  "Bonjour ! Je suis Clipia, ton compagnon. Je t'écoute et je te réponds à voix haute, sur toutes tes machines.",
  "Voici le résumé : trois points clés, une action à faire aujourd'hui, et je garde le reste en mémoire pour toi.",
  "C'est noté, je m'en souviendrai. Et rassure-toi : tout reste sur ton ordinateur."
];
let demoIdx = 0;

ipcMain.handle('ai:chat', async (_e, { provider, apiKey, model, system, messages, host }) => {
  if (DEMO) {
    await new Promise(r => setTimeout(r, 900));
    const q = (JSON.stringify(messages) + (system || '')).toLowerCase();
    if (q.includes('technicienne')) return { text: "Votre ordinateur rame surtout à cause de la mémoire presque pleine (91 %) et de 6,4 Go de fichiers temporaires. Le navigateur d'une autre marque ouvert en arrière-plan consomme à lui seul 2,1 Go. Internet fonctionne, mais le cache DNS semble encombré. Je vous propose trois réparations sans risque : rien ne sera fait sans votre accord.\n\n```actions\n[{\"titre\":\"Nettoyer les fichiers temporaires\",\"pourquoi\":\"Libère 6,4 Go et accélère le système.\",\"cmd\":\"Remove-Item \\\"$env:TEMP\\\\*\\\" -Recurse -Force -ErrorAction SilentlyContinue\",\"admin\":false,\"risque\":\"faible\"},{\"titre\":\"Vider le cache DNS\",\"pourquoi\":\"Les sites s'ouvriront de nouveau rapidement.\",\"cmd\":\"ipconfig /flushdns\",\"admin\":false,\"risque\":\"faible\"},{\"titre\":\"Réparer les fichiers système\",\"pourquoi\":\"Vérifie que Windows n'est pas abîmé.\",\"cmd\":\"sfc /scannow\",\"admin\":true,\"risque\":\"faible\"}]\n```" };
    if (q.includes('instagram')) return { text: "Nouveau son, nouvelle énergie 🎧🔥\nLe clip arrive très vite… Restez connectés ! ✨\n\n#clendax #nouveauclip #musique #ardennes #rapfrancais #clip #studio #creation #artiste #son #beat #music #france #instamusic #clipia" };
    if (q.includes('tiktok')) return { text: "🎬 Accroche (0-2 s) : « Ce son va tourner en boucle… »\n1. Gros plan casque, lumière violette\n2. Le beat tombe : cut sur la scène\n3. Texte à l'écran : « Nouveau clip vendredi »\n4. Regard caméra + logo CLENDAX\n🎵 Son : extrait du refrain\n#clendax #nouveauclip #fyp #musique" };
    return { text: DEMO_ANSWERS[demoIdx++ % DEMO_ANSWERS.length] };
  }
  const p = PROVIDERS[provider];
  if (!p) return { error: 'Moteur inconnu' };
  try {
    if (p.native) {
      const res = await fetch(p.base + '/messages', { method: 'POST', headers: headersFor(provider, apiKey), body: JSON.stringify({ model, max_tokens: 2048, system, messages }) });
      const data = await res.json();
      if (!res.ok) return { error: errMsg(data, res.status) };
      return { text: (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n') };
    }
    const msgs = system ? [{ role: 'system', content: system }, ...messages] : messages;
    const res = await fetch(baseOf(provider, host) + '/chat/completions', { method: 'POST', headers: headersFor(provider, apiKey), body: JSON.stringify({ model, messages: msgs }) });
    const data = await res.json();
    if (!res.ok) return { error: errMsg(data, res.status) };
    return { text: data.choices?.[0]?.message?.content ?? '' };
  } catch (err) {
    return { error: p.local ? 'Ollama ne répond pas : lancez Ollama sur ce PC puis réessayez.' : 'Connexion impossible : ' + err.message };
  }
});

ipcMain.handle('ai:models', async (_e, { provider, apiKey, host }) => {
  const p = PROVIDERS[provider];
  if (!p) return { error: 'Moteur inconnu' };
  try {
    const res = await fetch(baseOf(provider, host) + '/models', { headers: headersFor(provider, apiKey) });
    const data = await res.json();
    if (!res.ok) return { error: errMsg(data, res.status) };
    const list = (data.data || data.models || []).map(m => (m.id || m.name || '').replace(/^models\//, '')).filter(Boolean);
    return { models: [...new Set(list)].sort() };
  } catch (err) { return { error: p.local ? 'Ollama ne répond pas sur ce PC.' : 'Connexion impossible : ' + err.message }; }
});

/* ---------- Voix : transcription (Whisper via Groq ou OpenAI) ---------- */
const STT = {
  groq:   { url: 'https://api.groq.com/openai/v1/audio/transcriptions', model: 'whisper-large-v3-turbo' },
  openai: { url: 'https://api.openai.com/v1/audio/transcriptions', model: 'whisper-1' }
};
ipcMain.handle('voice:transcribe', async (_e, { engine, apiKey, audio, mime }) => {
  if (DEMO) return { text: '' };
  const s = STT[engine];
  if (!s) return { error: 'Moteur de voix inconnu' };
  if (!apiKey) return { error: 'Clé ' + (engine === 'groq' ? 'Groq' : 'OpenAI') + ' manquante pour la voix' };
  try {
    const fd = new FormData();
    fd.append('file', new Blob([Buffer.from(audio)], { type: mime || 'audio/webm' }), 'voix.webm');
    fd.append('model', s.model);
    fd.append('language', 'fr');
    fd.append('response_format', 'json');
    const res = await fetch(s.url, { method: 'POST', headers: { Authorization: 'Bearer ' + apiKey }, body: fd });
    const data = await res.json();
    if (!res.ok) return { error: errMsg(data, res.status) };
    return { text: (data.text || '').trim() };
  } catch (err) { return { error: 'Transcription impossible : ' + err.message }; }
});

ipcMain.handle('nova:open-external', (_e, url) => { if (/^https?:\/\//.test(url)) shell.openExternal(url); });
ipcMain.handle('nova:fullscreen', () => { if (win) win.setFullScreen(!win.isFullScreen()); });
ipcMain.handle('nova:demo', () => DEMO);

/* ---------- Coffre-fort des clés (chiffrement du système) ---------- */
const keyFile = () => path.join(app.getPath('userData'), 'nova-keys.json');
function readVault() {
  try {
    const raw = JSON.parse(fs.readFileSync(keyFile(), 'utf8')), out = {};
    for (const [k, v] of Object.entries(raw)) out[k] = v.enc ? safeStorage.decryptString(Buffer.from(v.data, 'base64')) : Buffer.from(v.data, 'base64').toString('utf8');
    return out;
  } catch { return {}; }
}
function writeVault(keys) {
  const enc = safeStorage.isEncryptionAvailable(), raw = {};
  for (const [k, v] of Object.entries(keys)) { if (v) raw[k] = enc ? { enc: true, data: safeStorage.encryptString(v).toString('base64') } : { enc: false, data: Buffer.from(v).toString('base64') }; }
  fs.writeFileSync(keyFile(), JSON.stringify(raw), { mode: 0o600 });
  return enc;
}
ipcMain.handle('keys:get', () => (DEMO ? {} : readVault()));
ipcMain.handle('keys:set', (_e, keys) => (DEMO ? { encrypted: true } : { encrypted: writeVault(keys) }));
ipcMain.handle('keys:wipe', () => { try { fs.unlinkSync(keyFile()); } catch {} return true; });

/* ---------- Bouclier ---------- */
const TRACKERS = [
  'doubleclick.net', 'google-analytics.com', 'googletagmanager.com', 'googlesyndication.com', 'googleadservices.com',
  'adservice.google.com', 'scorecardresearch.com', 'quantserve.com', 'criteo.com', 'criteo.net', 'taboola.com',
  'outbrain.com', 'adnxs.com', 'amazon-adsystem.com', 'hotjar.com', 'hotjar.io', 'mixpanel.com', 'segment.io',
  'segment.com', 'moatads.com', 'rubiconproject.com', 'pubmatic.com', 'openx.net', 'casalemedia.com', 'smartadserver.com',
  'adsrvr.org', 'bidswitch.net', 'yieldmo.com', 'teads.tv', 'chartbeat.com', 'newrelic.com', 'nr-data.net',
  'clarity.ms', 'bat.bing.com', 'ads-twitter.com', 'analytics.tiktok.com', 'connect.facebook.net/en_US/fbevents.js'
];
const shield = { trackers: true, https: true, blocked: 0 };
const hostOf = (u) => { try { return new URL(u).hostname; } catch { return ''; } };
const isTracker = (u) => { const h = hostOf(u); return TRACKERS.some(t => t.includes('/') ? u.includes(t) : (h === t || h.endsWith('.' + t))); };
const isLocal = (u) => /^http:\/\/(localhost|127\.|192\.168\.|10\.)/.test(u);
const isOnion = (u) => hostOf(u).endsWith('.onion');

function protect(ses, { tor = false } = {}) {
  ses.setUserAgent(tor
    ? 'Mozilla/5.0 (Windows NT 10.0; rv:128.0) Gecko/20100101 Firefox/128.0'
    : ses.getUserAgent().replace(/Electron\/\S+\s?/, '').replace(/clipia-nova\/\S+\s?/i, ''));
  ses.webRequest.onBeforeRequest((details, cb) => {
    const u = details.url;
    if (!tor && isOnion(u)) return cb({ cancel: true });                 // un .onion ne sort jamais hors de Tor
    if ((shield.trackers || tor) && details.resourceType !== 'mainFrame' && isTracker(u)) {
      shield.blocked++; if (win) win.webContents.send('nova:blocked', shield.blocked);
      return cb({ cancel: true });
    }
    if ((shield.https || tor) && u.startsWith('http://') && !isLocal(u) && !isOnion(u) && details.resourceType === 'mainFrame') {
      return cb({ redirectURL: 'https://' + u.slice(7) });
    }
    cb({});
  });
  ses.setPermissionRequestHandler(async (wc, permission, callback, details) => {
    // L'interface de Clipia Nova (micro pour la voix) est autorisée ; les sites demandent toujours.
    if (win && wc === win.webContents) return callback(['media', 'fullscreen', 'clipboard-sanitized-write'].includes(permission));
    if (tor && ['media', 'geolocation', 'notifications'].includes(permission)) return callback(false);
    const sensibles = { media: 'la caméra / le micro', geolocation: 'votre position', notifications: 'les notifications', 'clipboard-read': 'votre presse-papiers' };
    if (!sensibles[permission]) return callback(permission === 'fullscreen' || permission === 'pointerLock');
    const site = hostOf(details.requestingUrl || wc.getURL());
    const r = await dialog.showMessageBox(win, { type: 'question', buttons: ['Refuser', 'Autoriser'], defaultId: 0, cancelId: 0, title: 'Clipia Nova — Bouclier', message: `${site} veut accéder à ${sensibles[permission]}.`, detail: 'Clipia Nova ne donne jamais cet accès sans votre accord.' });
    callback(r.response === 1);
  });
  ses.on('will-download', (_e, item) => {
    item.once('done', (_e2, state) => { if (win) win.webContents.send('nova:download', { name: item.getFilename(), state, path: item.getSavePath() }); });
  });
}
// Réseau : DNS chiffré (DoH) + proxy / VPN au choix, pour les onglets normaux (jamais pour Tor).

// Moteur Clipia Search : interroge des index indépendants (jamais Google / Bing / Yahoo), directement depuis votre machine.
const SRCH = { marginalia: process.env.NOVA_SEARCH_MARGINALIA || 'https://api.marginalia.nu/public/search/', wiki: process.env.NOVA_SEARCH_WIKI || 'https://fr.wikipedia.org/w/api.php', brave: process.env.NOVA_SEARCH_BRAVE || 'https://api.search.brave.com/res/v1/web/search' };
async function getJson(url, headers) {
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 8000);
  try { const r = await require('electron').net.fetch(url, { headers: { 'User-Agent': 'Clipia-Nova', Accept: 'application/json', ...headers }, signal: ctl.signal }); if (!r.ok) throw new Error('code ' + r.status); return await r.json(); }
  finally { clearTimeout(to); }
}
const clean = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#039;/g, "'").replace(/\s+/g, ' ').trim();
ipcMain.handle('search:run', async (_e, q) => {
  q = String(q || '').trim().slice(0, 200); if (!q) return { results: [], sources: {}, errors: {} };
  const keys = DEMO ? {} : (readVault() || {});
  const jobs = {
    wikipedia: async () => (await getJson(SRCH.wiki + '?action=query&list=search&format=json&srlimit=4&srsearch=' + encodeURIComponent(q))).query.search
      .map(x => ({ title: x.title, url: 'https://fr.wikipedia.org/wiki/' + encodeURIComponent(x.title.replace(/ /g, '_')), desc: clean(x.snippet) })),
    marginalia: async () => ((await getJson(SRCH.marginalia + encodeURIComponent(q) + '?count=12')).results || []).map(x => ({ title: clean(x.title) || x.url, url: x.url, desc: clean(x.description) })),
  };
  if (keys.brave) jobs.brave = async () => ((await getJson(SRCH.brave + '?count=15&country=fr&search_lang=fr&q=' + encodeURIComponent(q), { 'X-Subscription-Token': keys.brave })).web?.results || []).map(x => ({ title: clean(x.title), url: x.url, desc: clean(x.description) }));
  const out = {}, errors = {};
  await Promise.all(Object.entries(jobs).map(async ([k, f]) => { try { out[k] = await f(); } catch (e) { errors[k] = e.message; out[k] = []; } }));
  const seen = new Set(), results = [];
  for (const k of ['wikipedia', 'brave', 'marginalia']) for (const r of (out[k] || [])) {
    if (!/^https?:\/\//i.test(r.url || '')) continue;
    const id = r.url.replace(/^https?:\/\/(www\.)?/, '').replace(/[#?].*$/, '').replace(/\/$/, '');
    if (seen.has(id)) continue; seen.add(id); results.push({ ...r, src: k });
  }
  return { results, sources: Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length])), errors };
});
ipcMain.handle('net:set', async (_e, n) => {
  try {
    const dns = { cloudflare: 'https://cloudflare-dns.com/dns-query', quad9: 'https://dns.quad9.net/dns-query', google: 'https://dns.google/dns-query' }[n.doh];
    app.configureHostResolver(dns ? { secureDnsMode: 'secure', secureDnsServers: [dns] } : { secureDnsMode: 'automatic' });
    const ses = session.fromPartition('persist:nova');
    const p = (n.proxy || '').trim();
    const okP = p && /^(socks5|socks4|http|https):\/\/[\w.\-]+:\d{2,5}$/i.test(p);
    if (okP) await ses.setProxy({ proxyRules: p, proxyBypassRules: '<local>' });
    else await ses.setProxy({ mode: 'system' });
    if (p && !okP) return { ok: false, error: 'Adresse invalide (ex. socks5://127.0.0.1:1080)' };
    return { ok: true, proxy: !!okP, doh: n.doh || 'auto' };
  } catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle('shield:set', (_e, s) => { Object.assign(shield, s); return shield; });
ipcMain.handle('privacy:clear', async () => {
  for (const ses of [session.fromPartition('persist:nova'), torSession]) { if (ses) { await ses.clearStorageData(); await ses.clearCache(); } }
  return true;
});
ipcMain.handle('sys:diag', () => sys.diagnose());
ipcMain.handle('sys:quick', () => ({ list: sys.QUICK, shell: sys.shellName, platform: process.platform }));
ipcMain.handle('sys:blocked', (_e, cmd) => sys.blocked(cmd));
ipcMain.handle('sys:run', (e, a) => {
  if (!win || e.sender !== win.webContents) return { code: 1, err: 'Refusé' };   // seule l'interface de Nova peut demander une réparation
  return sys.execute(a, app.getPath('userData'));
});
ipcMain.handle('nova:show-file', (_e, p) => shell.showItemInFolder(p));
ipcMain.handle('nova:save-png', (_e, { data, name }) => {
  const dir = app.getPath('downloads');
  const f = path.join(dir, `Clipia-Nova-${(name || 'capture').trim().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`);
  fs.writeFileSync(f, Buffer.from(String(data).split(',')[1] || '', 'base64'));
  return { path: f };
});

/* ---------- Mode Tor (.onion) ----------
   Nova lance son propre Tor (Tor Expert Bundle fourni avec l'application) ou utilise un Tor déjà présent
   (Tor Browser : port 9150, service Tor : 9050). Les onglets Tor sont isolés, sans disque, sans WebRTC. */
let torSession = null, torProc = null;
const tor = { state: 'off', progress: 0, port: 0, source: '', error: '' };
const sendTor = () => { if (win) win.webContents.send('tor:status', tor); };

function portOpen(port) {
  return new Promise(res => { const s = net.connect(port, '127.0.0.1'); s.once('connect', () => { s.destroy(); res(true); }); s.once('error', () => res(false)); setTimeout(() => { s.destroy(); res(false); }, 800); });
}
function torBundle() {
  const map = { 'win32-x64': 'windows-x86_64', 'win32-arm64': 'windows-x86_64', 'darwin-x64': 'macos-x86_64', 'darwin-arm64': 'macos-aarch64', 'linux-x64': 'linux-x86_64' };
  const dir = map[`${process.platform}-${process.arch}`];
  if (!dir) return null;
  const roots = [path.join(process.resourcesPath || '', 'tor', dir), path.join(__dirname, 'tor', dir)];
  for (const r of roots) {
    const exe = path.join(r, 'tor', process.platform === 'win32' ? 'tor.exe' : 'tor');
    if (fs.existsSync(exe)) return { root: r, exe };
  }
  return null;
}
async function startTor() {
  if (tor.state === 'ready' || tor.state === 'starting') return tor;
  tor.state = 'starting'; tor.progress = 0; tor.error = ''; sendTor();
  const b = torBundle();
  if (b) {
    const port = 19150;
    const dataDir = path.join(app.getPath('userData'), 'tor-data');
    fs.mkdirSync(dataDir, { recursive: true });
    const args = ['--SocksPort', `127.0.0.1:${port}`, '--DataDirectory', dataDir, '--ClientOnly', '1', '--AvoidDiskWrites', '1', '--Log', 'notice stdout'];
    const geo = path.join(b.root, 'data', 'geoip'), geo6 = path.join(b.root, 'data', 'geoip6');
    if (fs.existsSync(geo)) args.push('--GeoIPFile', geo);
    if (fs.existsSync(geo6)) args.push('--GeoIPv6File', geo6);
    const env = { ...process.env };
    const lib = path.dirname(b.exe);
    if (process.platform === 'linux') env.LD_LIBRARY_PATH = lib + (env.LD_LIBRARY_PATH ? ':' + env.LD_LIBRARY_PATH : '');
    if (process.platform === 'darwin') env.DYLD_LIBRARY_PATH = lib;
    try { if (process.platform !== 'win32') fs.chmodSync(b.exe, 0o755); } catch {}
    try {
      torProc = spawn(b.exe, args, { env, windowsHide: true });
    } catch (e) { tor.state = 'error'; tor.error = 'Tor n\'a pas pu démarrer : ' + e.message; sendTor(); return tor; }
    tor.source = 'Tor intégré à Clipia Nova';
    return new Promise(resolve => {
      const onLine = (buf) => {
        const m = String(buf).match(/Bootstrapped (\d+)%/g);
        if (m) { tor.progress = parseInt(m[m.length - 1].match(/\d+/)[0], 10); sendTor(); }
        if (tor.progress >= 100 && tor.state !== 'ready') { finishTor(port).then(resolve); }
      };
      torProc.stdout.on('data', onLine);
      torProc.stderr.on('data', onLine);
      torProc.on('exit', (code) => { if (tor.state !== 'ready') { tor.state = 'error'; tor.error = 'Tor s\'est arrêté (code ' + code + ').'; sendTor(); resolve(tor); } else { tor.state = 'off'; sendTor(); } torProc = null; });
      setTimeout(() => { if (tor.state === 'starting') { tor.state = 'error'; tor.error = 'Connexion au réseau Tor trop longue. Vérifiez internet ou un pare-feu.'; sendTor(); resolve(tor); } }, 120000);
    });
  }
  // Pas de Tor intégré : on cherche un Tor déjà lancé
  for (const [port, src] of [[9150, 'Tor Browser'], [9050, 'service Tor du système']]) {
    if (await portOpen(port)) { tor.source = src; tor.progress = 100; return finishTor(port); }
  }
  tor.state = 'error';
  tor.error = 'Tor n\'est pas disponible sur ce système. Ouvrez Tor Browser (ou installez le paquet « tor ») puis réessayez.';
  sendTor(); return tor;
}
async function finishTor(port) {
  await torSession.setProxy({ proxyRules: `socks5://127.0.0.1:${port}`, proxyBypassRules: '<-loopback>' });
  tor.port = port; tor.state = 'ready'; tor.progress = 100; sendTor();
  return tor;
}
function stopTor() {
  if (torProc) { try { torProc.kill(); } catch {} torProc = null; }
  tor.state = 'off'; tor.progress = 0; sendTor();
  if (torSession) torSession.clearStorageData().catch(() => {});
}
ipcMain.handle('tor:start', () => startTor());
ipcMain.handle('tor:stop', () => { stopTor(); return tor; });
ipcMain.handle('tor:status', () => tor);

// Vitrine de la page d'accueil (produits du moment + vidéos qui cartonnent) : un simple fichier JSON public,
// mis à jour sur GitHub sans nouvelle version du navigateur. Gardé en cache pour fonctionner hors connexion.
const VITRINE_URL = process.env.NOVA_VITRINE_URL || 'https://raw.githubusercontent.com/fabriceclin02-glitch/clipia/main/vitrine.json';
let vitrine = { t: 0, data: null };
const okUrl = (u) => typeof u === 'string' && /^https:\/\/[^\s"'<>]+$/.test(u);
function cleanVitrine(d) {
  const it = (x) => x && okUrl(x.url) && (!x.image || okUrl(x.image)) && x.titre;
  const pick = (x) => ({ titre: String(x.titre).slice(0, 140), prix: String(x.prix || '').slice(0, 30), badge: String(x.badge || '').slice(0, 20), image: x.image || '', url: x.url, plateforme: String(x.plateforme || ''), auteur: String(x.auteur || '').slice(0, 60), vues: Number(x.vues) || 0 });
  return { maj: String(d.maj || ''), produits: (d.produits || []).filter(it).slice(0, 24).map(pick), videos: [...(d.videos || []), ...(d.videos_auto || [])].filter(it).slice(0, 30).map(pick) };
}
ipcMain.handle('vitrine:get', async (_e, force) => {
  const cache = path.join(app.getPath('userData'), 'vitrine.json');
  if (!force && vitrine.data && Date.now() - vitrine.t < 20 * 60 * 1000) return vitrine.data;
  try { vitrine = { t: Date.now(), data: cleanVitrine(await getJson(VITRINE_URL + '?t=' + Math.floor(Date.now() / 600000))) }; fs.writeFileSync(cache, JSON.stringify(vitrine.data)); }
  catch { if (!vitrine.data) { try { vitrine.data = JSON.parse(fs.readFileSync(cache, 'utf8')); } catch { vitrine.data = { produits: [], videos: [] }; } } }
  return vitrine.data;
});

require('./updater').init(ipcMain, (ch, v) => { if (win && !win.isDestroyed()) win.webContents.send(ch, v); });
app.whenReady().then(() => {
  torSession = session.fromPartition('tor-nova');           // en mémoire uniquement : rien n'est écrit sur le disque
  torSession.setProxy({ proxyRules: 'socks5://127.0.0.1:1', proxyBypassRules: '<-loopback>' }); // bloqué tant que Tor n'est pas prêt
  protect(session.defaultSession);
  protect(session.fromPartition('persist:nova'));
  protect(torSession, { tor: true });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('before-quit', stopTor);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
