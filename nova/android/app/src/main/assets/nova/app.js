/* Clipia Nova — interface Android */
const D = window.NOVA_DATA;
const A = window.NovaAndroid || null;   // pont natif (absent dans un navigateur de test)
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- Stockage (espace privé de l'application) ---------- */
const store = {
  get(k, d) { try { const v = A ? A.get(k) : localStorage.getItem('nova.' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { const s = JSON.stringify(v); A ? A.set(k, s) : localStorage.setItem('nova.' + k, s); }
};
const DEF = { onboarded: false, name: '', provider: 'gemini', models: {}, mode: 'ami', customPrompt: '', engine: 'google', mails: [], installed: ['communaute', 'clipia', 'gmail', 'youtube', 'claude', 'whatsapp', 'maps', 'meteo'], voice: true, memory: [], trackers: true, https: true };
let cfg = { ...DEF, ...store.get('cfg', {}) };
let KEYS = store.get('keys', {});
const save = () => store.set('cfg', cfg);
const saveKeys = () => store.set('keys', KEYS);
const modelOf = p => cfg.models[p] || D.providers[p].model;
function toast(t) { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove('on'), 2400); }
function open(url) { if (/\.onion(\/|$)/.test(url.replace(/^https?:\/\//, '').split('/')[0] + '/') && A) return A.tor(/^https?:/.test(url) ? url : 'http://' + url); A ? A.open(url) : (location.href = url); }

/* ---------- Sphère 3D ---------- */
function sphere(cv, n = 700, sp = 1) {
  const ctx = cv.getContext('2d'), pts = [], g = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) { const y = 1 - i / (n - 1) * 2, r = Math.sqrt(1 - y * y); pts.push([Math.cos(g * i) * r, y, Math.sin(g * i) * r]); }
  let a = 0; const t0 = performance.now();
  (function f(now) {
    if (!cv.isConnected) return;
    const dpr = devicePixelRatio || 1, W = cv.clientWidth * dpr, H = cv.clientHeight * dpr;
    if (cv.width !== W) { cv.width = W; cv.height = H; }
    ctx.clearRect(0, 0, W, H);
    const t = (now - t0) / 1000; a += .008 * sp; const b = Math.sin(t * .4) * .35, R = Math.min(W, H) * .4 * (1 + Math.sin(t * 1.6) * .025);
    const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
    for (const [x0, y0, z0] of pts) {
      let x = x0 * ca - z0 * sa, z = x0 * sa + z0 * ca, y = y0 * cb - z * sb; z = y0 * sb + z * cb;
      const d = (z + 1.6) / 2.6;
      ctx.fillStyle = `hsla(${215 + (y0 + 1) * 45},90%,${55 + d * 20}%,${.15 + d * .85})`;
      ctx.beginPath(); ctx.arc(W / 2 + x * R, H / 2 + y * R, (.6 + d * 1.8) * dpr, 0, 7); ctx.fill();
    }
    requestAnimationFrame(f);
  })(performance.now());
}

/* ---------- Démarrage ---------- */
const firstHash = location.hash.replace('#', '');
sphere($('#sp'), 1100, 1.4);
setTimeout(() => {
  $('#splash').classList.add('out'); setTimeout(() => $('#splash').remove(), 800);
  cfg.onboarded ? startApp(firstHash || 'home') : startWizard();
}, firstHash ? 300 : 2500);

/* ---------- Assistant ---------- */
let step = 0, wzProv = cfg.provider;
const STEPS = ['welcome', 'shield', 'ai', 'mail', 'style', 'done'];
function startWizard() {
  $('#wizard').classList.remove('hidden');
  $('#wzBack').onclick = () => { if (step) { step--; wz(); } };
  $('#wzNext').onclick = () => {
    if (STEPS[step] === 'welcome') { cfg.name = $('#wName').value.trim(); }
    if (STEPS[step] === 'ai') { cfg.provider = wzProv; }
    if (STEPS[step] === 'style') { const t = $('#persoIn'); if (t) cfg.customPrompt = t.value.trim(); }
    save();
    if (step < STEPS.length - 1) { step++; wz(); } else { cfg.onboarded = true; save(); $('#wizard').classList.add('hidden'); startApp('home'); }
  };
  wz();
}
function wz() {
  $('#wzDots').innerHTML = STEPS.map((_, i) => `<i class="${i <= step ? 'on' : ''}"></i>`).join('');
  $('#wzBack').style.visibility = step ? 'visible' : 'hidden';
  $('#wzNext').textContent = step === STEPS.length - 1 ? 'Ouvrir Clipia Nova ✦' : 'Continuer →';
  const B = $('#wzBody'), s = STEPS[step];
  if (s === 'welcome') B.innerHTML = `<div class="page-title">Bienvenue dans <span class="grad">Clipia Nova</span></div>
    <div class="say">✦ Bonjour ! Je suis Clipia. En 2 minutes, on configure votre sécurité, votre IA et vos messageries. Tout reste modifiable dans ⚙ Réglages.</div>
    <div class="field"><label>Comment voulez-vous que je vous appelle ?</label><input id="wName" value="${esc(cfg.name)}" placeholder="Votre prénom"></div>`;
  if (s === 'shield') B.innerHTML = `<div class="page-title">🛡 Votre bouclier</div>
    ${[['🚫', 'Traqueurs bloqués', 'Les mouchards publicitaires sont stoppés.'], ['🍪', 'Cookies tiers refusés', 'Les sites ne peuvent pas vous suivre de l\'un à l\'autre.'], ['🔒', 'HTTPS automatique', 'Connexion chiffrée dès que possible.'], ['🔑', 'Clés IA protégées', 'Rangées dans l\'espace privé de l\'application, jamais lisibles par un site web.'], ['🎥', 'Caméra, micro, position', 'Toujours sur votre autorisation.'], ['🙈', 'Zéro collecte', 'Clipia Nova n\'envoie votre navigation, vos mails ou vos mots de passe à personne.']].map(x => `<div class="card" style="display:flex;gap:.8rem"><span>${x[0]}</span><div><b>${x[1]}</b><br><small style="color:var(--muted)">${x[2]}</small></div></div>`).join('')}`;
  if (s === 'ai') { B.innerHTML = `<div class="page-title">✦ Votre intelligence</div>
    <div class="say">Un abonnement grand public (ChatGPT Plus, Claude Pro…) ne donne pas de clé : créez une <b>clé API</b> sur la console du fournisseur. Les moteurs « Gratuit » ont une offre sans frais.</div>
    <div class="grid2">${provButtons(wzProv)}</div><div id="pBox"></div>`;
    B.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { wzProv = b.dataset.p; wz(); });
    provForm($('#pBox'), wzProv, true); }
  if (s === 'mail') { B.innerHTML = `<div class="page-title">✉ Vos messageries</div>
    <div class="say">Elles s'ouvrent sur leur site officiel : Clipia Nova ne voit jamais votre mot de passe et ne copie pas vos e-mails.</div>
    <div class="grid2">${D.mails.map(m => `<button class="opt ${cfg.mails.includes(m.id) ? 'on' : ''}" data-m="${m.id}"><b>${m.ic} ${m.name}</b>${cfg.mails.includes(m.id) ? '<small class="ok">✓ ajoutée</small>' : ''}</button>`).join('')}</div>`;
    B.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { toggleMail(b.dataset.m); wz(); }); }
  if (s === 'style') { B.innerHTML = `<div class="page-title">Comment veux-tu que nous discutions ?</div>
    <div class="grid2">${Object.entries(D.modes).map(([id, m]) => `<button class="opt ${cfg.mode === id ? 'on' : ''}" data-mode="${id}"><b>${m.label}</b></button>`).join('')}</div>
    ${cfg.mode === 'perso' ? `<div class="field"><label>Décrivez votre style</label><textarea id="persoIn" rows="3">${esc(cfg.customPrompt)}</textarea></div>` : ''}`;
    B.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { cfg.mode = b.dataset.mode; save(); wz(); }); }
  if (s === 'done') { const p = D.providers[cfg.provider]; B.innerHTML = `<div class="page-title">Tout est prêt${cfg.name ? ', ' + esc(cfg.name) : ''} ✦</div>
    <div class="card">🛡 Bouclier actif</div><div class="card">✦ IA : ${p.name} — ${KEYS[cfg.provider] || p.noKey ? 'configurée' : 'clé à ajouter dans ⚙'}</div>
    <div class="card">✉ ${cfg.mails.length ? cfg.mails.map(id => D.mails.find(m => m.id === id).name).join(', ') : 'Aucune messagerie'}</div><div class="card">🎭 ${D.modes[cfg.mode].label}</div>`; }
}
function toggleMail(id) { cfg.mails = cfg.mails.includes(id) ? cfg.mails.filter(x => x !== id) : [...cfg.mails, id]; save(); }
function provButtons(sel) { return Object.entries(D.providers).map(([id, p]) => `<button class="opt ${id === sel ? 'on' : ''}" data-p="${id}"><b>${p.name}</b><small>${p.by}${p.free ? ' · Gratuit' : ''}</small>${KEYS[id] || (p.noKey && id === sel) ? '<small class="ok">● prêt</small>' : ''}</button>`).join(''); }

function provForm(box, id, guide) {
  const p = D.providers[id];
  box.innerHTML = `${guide ? `<div class="say" style="margin-top:1rem">${p.noKey ? 'Ollama fonctionne sur un ordinateur. Sur téléphone, indiquez l\'adresse de votre PC dans le champ Adresse (ex. http://192.168.1.20:11434), avec Ollama lancé.' : `1) Touchez « Obtenir ma clé ». 2) Créez une clé et copiez-la. 3) Collez-la ici. 4) Touchez « Tester ».`}</div>` : ''}
    <div class="row" style="margin-top:.8rem"><button class="btn2" id="gk">🔗 ${p.noKey ? 'Télécharger Ollama' : 'Obtenir ma clé ' + p.name}</button></div>
    ${p.noKey ? `<div class="field"><label>Adresse d'Ollama</label><input id="hIn" value="${esc(cfg.ollamaHost || 'http://192.168.1.20:11434')}"></div>` : `<div class="field"><label>Clé API ${p.name}</label><input id="kIn" type="password" value="${esc(KEYS[id] || '')}" placeholder="Collez votre clé"></div>`}
    <div class="field"><label>Modèle</label><input id="mIn" list="mL" value="${esc(modelOf(id))}"><datalist id="mL"></datalist></div>
    <div class="row" style="margin-top:.8rem"><button class="btn2" id="lm">⟳ Mes modèles</button><button class="btn2" id="tp" style="border-color:var(--violet)">Tester</button></div>
    <div id="st" style="margin-top:.7rem;font-size:.9rem"></div>`;
  $('#gk', box).onclick = () => A ? A.openOutside(p.keyUrl) : window.open(p.keyUrl);
  const persist = () => { const k = $('#kIn', box); if (k) { KEYS[id] = k.value.trim(); saveKeys(); } const h = $('#hIn', box); if (h) cfg.ollamaHost = h.value.trim(); cfg.models[id] = $('#mIn', box).value.trim() || p.model; save(); };
  $('#lm', box).onclick = async () => { persist(); const st = $('#st', box); st.className = ''; st.textContent = 'Recherche…';
    const r = await aiModels(id); if (r.error) { st.className = 'bad'; st.textContent = '✕ ' + r.error; return; }
    $('#mL', box).innerHTML = r.models.map(m => `<option value="${esc(m)}">`).join(''); st.className = 'ok'; st.textContent = `✓ ${r.models.length} modèles disponibles. Touchez le champ Modèle.`; };
  $('#tp', box).onclick = async () => { persist(); const st = $('#st', box); st.className = ''; st.textContent = 'Test en cours…';
    const r = await aiChat(id, 'Réponds en une phrase courte, en français.', [{ role: 'user', content: 'Dis bonjour et présente-toi.' }]);
    if (r.error) { st.className = 'bad'; st.textContent = '✕ ' + r.error; return; } st.className = 'ok'; st.textContent = '✓ ' + p.name + ' répond : « ' + r.text.trim().slice(0, 140) + ' »'; };
}

/* ---------- Appels IA (via le pont natif : pas de blocage CORS) ---------- */
const BASES = { anthropic: 'https://api.anthropic.com/v1', openai: 'https://api.openai.com/v1', gemini: 'https://generativelanguage.googleapis.com/v1beta/openai', mistral: 'https://api.mistral.ai/v1', deepseek: 'https://api.deepseek.com', groq: 'https://api.groq.com/openai/v1', xai: 'https://api.x.ai/v1', zai: 'https://api.z.ai/api/paas/v4', openrouter: 'https://openrouter.ai/api/v1' };
const pending = {};
window.novaAI = (id, json) => { const r = JSON.parse(json); (pending[id] || (() => {}))(r); delete pending[id]; };
function http(method, url, headers, body) {
  if (!A) return fetch(url, { method, headers, body: body || undefined }).then(async r => ({ status: r.status, body: await r.text() })).catch(e => ({ status: 0, error: e.message }));
  return new Promise(res => { const id = 'r' + Date.now() + Math.random(); pending[id] = res; A.request(id, method, url, JSON.stringify(headers), body || ''); });
}
function base(p) { return p === 'ollama' ? (cfg.ollamaHost || 'http://192.168.1.20:11434').replace(/\/$/, '') + '/v1' : BASES[p]; }
function headers(p) {
  if (p === 'anthropic') return { 'Content-Type': 'application/json', 'x-api-key': KEYS[p] || '', 'anthropic-version': '2023-06-01' };
  const h = { 'Content-Type': 'application/json' }; if (KEYS[p]) h.Authorization = 'Bearer ' + KEYS[p];
  if (p === 'openrouter') { h['HTTP-Referer'] = 'https://fabriceclin02-glitch.github.io/clipia/'; h['X-Title'] = 'Clipia Nova'; }
  return h;
}
function err(r) { if (r.status === 0) return 'Connexion impossible' + (r.error ? ' : ' + r.error : ''); try { const d = JSON.parse(r.body); const m = d.error && (d.error.message || d.error); if (typeof m === 'string') return m; } catch {} return 'Erreur ' + r.status + (r.status === 401 ? ' : clé API refusée' : ''); }
async function aiChat(p, system, messages) {
  const anth = p === 'anthropic';
  const body = anth ? { model: modelOf(p), max_tokens: 2048, system, messages } : { model: modelOf(p), messages: system ? [{ role: 'system', content: system }, ...messages] : messages };
  const r = await http('POST', base(p) + (anth ? '/messages' : '/chat/completions'), headers(p), JSON.stringify(body));
  if (r.status < 200 || r.status >= 300) return { error: err(r) };
  try { const d = JSON.parse(r.body); return { text: anth ? d.content.filter(b => b.type === 'text').map(b => b.text).join('\n') : d.choices[0].message.content }; } catch { return { error: 'Réponse illisible' }; }
}
async function aiModels(p) {
  const h = headers(p); delete h['Content-Type'];
  const r = await http('GET', base(p) + '/models', h, '');
  if (r.status < 200 || r.status >= 300) return { error: err(r) };
  try { const d = JSON.parse(r.body); return { models: [...new Set((d.data || d.models || []).map(m => (m.id || m.name || '').replace(/^models\//, '')).filter(Boolean))].sort() }; } catch { return { error: 'Réponse illisible' }; }
}

/* ---------- Application ---------- */
let view = 'home';
window.novaShow = v => show(v);
function startApp(v) {
  $('#tabsBar').classList.remove('hidden');
  $('#tabsBar').querySelectorAll('button').forEach(b => b.onclick = () => show(b.dataset.v));
  initAI(); show(v);
}
function show(v) {
  view = v;
  document.querySelectorAll('.view').forEach(s => s.classList.add('hidden'));
  $('#v-' + v).classList.remove('hidden');
  $('#askBar').classList.toggle('hidden', v !== 'ai');
  $('#tabsBar').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  ({ home: renderHome, store: renderStore, ai: enterAI, settings: renderSettings })[v]();
  scrollTo(0, 0);
}

function renderHome() {
  const apps = cfg.installed.map(id => D.store.find(a => a.id === id)).filter(Boolean);
  let hist = []; try { hist = JSON.parse(A ? A.history() : '[]'); } catch {}
  const h = new Date().getHours();
  $('#v-home').innerHTML = `<div class="hero"><canvas id="hs"></canvas><div class="brand" style="font-size:1.5rem">CLIPIA <span>NOVA</span></div>
    <p style="color:var(--muted);margin-top:.4rem">${h < 18 ? 'Bonjour' : 'Bonsoir'}${cfg.name ? ', ' + esc(cfg.name) : ''} — que cherchons-nous ?</p>
    <form class="search" id="sf"><input placeholder="Rechercher sur le web…"><button>🔍</button></form>
    <button id="askAi" style="color:#c4b5fd;margin-top:.8rem;font-size:.9rem">✦ ou demander à Clipia</button><br>
    <span class="badge">🛡 Bouclier actif · ${A ? A.blocked() : 0} traqueur(s) bloqué(s)</span></div>
    <h3 class="sec">Réseaux</h3><div class="soc">${D.socials.map(x => `<button data-url="${x.url}" title="${x.name}"><span style="background:${x.color}">${x.ic}</span><small>${x.name.replace('Clipia ', '')}</small></button>`).join('')}</div>
    ${cfg.mails.length ? `<h3 class="sec">Mes mails</h3><div class="tiles">${cfg.mails.map(id => D.mails.find(m => m.id === id)).map(m => `<div class="tile" data-url="${m.url}"><div class="ic">${m.ic}</div><small>${m.name}</small></div>`).join('')}</div>` : ''}
    <h3 class="sec">Mes applications</h3><div class="tiles">${apps.map(a => `<div class="tile" data-url="${esc(a.url)}"><div class="ic">${a.ic}</div><small>${esc(a.name)}</small></div>`).join('')}<div class="tile" id="addApp"><div class="ic">＋</div><small>Ajouter</small></div></div>
    ${hist.length ? `<h3 class="sec">Récemment visité</h3><div class="hist">${hist.slice(0, 6).map(x => `<button data-url="${esc(x.url)}">🕘 ${esc(x.title)}</button>`).join('')}</div>` : ''}`;
  sphere($('#hs'), 550);
  $('#sf').onsubmit = e => { e.preventDefault(); const q = $('#sf input').value.trim(); if (!q) return; open(/^[\w-]+(\.[\w-]+)+\S*$/.test(q) && !q.includes(' ') ? 'https://' + q.replace(/^https?:\/\//, '') : D.engines[cfg.engine].url + encodeURIComponent(q)); };
  $('#askAi').onclick = () => { const q = $('#sf input').value.trim(); show('ai'); if (q) send(q); };
  $('#addApp').onclick = () => show('store');
  document.querySelectorAll('#v-home [data-url]').forEach(t => t.onclick = () => open(t.dataset.url));
}

let cat = 'Tout';
function renderStore() {
  const cats = ['Tout', ...new Set(D.store.map(a => a.cat))];
  const list = D.store.filter(a => cat === 'Tout' || a.cat === cat);
  $('#v-store').innerHTML = `<div class="page-title">Clipia <span class="grad">Store</span></div>
    <div class="cats">${cats.map(c => `<button class="${c === cat ? 'on' : ''}" data-c="${c}">${c}</button>`).join('')}</div>
    ${list.map(a => { const on = cfg.installed.includes(a.id); return `<div class="app"><div class="ic" data-url="${esc(a.url)}">${a.ic}</div><div class="t" data-url="${esc(a.url)}"><b>${esc(a.name)}</b><small>${esc(a.desc)}</small></div><button class="in ${on ? 'done' : ''}" data-i="${a.id}">${on ? '✓' : 'Installer'}</button></div>`; }).join('')}`;
  document.querySelectorAll('#v-store [data-c]').forEach(b => b.onclick = () => { cat = b.dataset.c; renderStore(); });
  document.querySelectorAll('#v-store [data-i]').forEach(b => b.onclick = () => { const id = b.dataset.i, on = cfg.installed.includes(id); cfg.installed = on ? cfg.installed.filter(x => x !== id) : [...cfg.installed, id]; save(); toast(on ? 'Retirée' : '✓ Ajoutée à l\'accueil'); renderStore(); });
  document.querySelectorAll('#v-store [data-url]').forEach(b => b.onclick = () => open(b.dataset.url));
}

function renderSettings() {
  const S = $('#v-settings');
  S.innerHTML = `<div class="page-title">⚙ Réglages</div>
    <div class="card"><b>✦ Intelligence artificielle</b><div class="grid2" style="margin-top:.8rem">${provButtons(cfg.provider)}</div><div id="sp2"></div></div>
    <div class="card"><b>✉ Messageries</b><div class="grid2" style="margin-top:.8rem">${D.mails.map(m => `<button class="opt ${cfg.mails.includes(m.id) ? 'on' : ''}" data-m="${m.id}"><b>${m.ic} ${m.name}</b></button>`).join('')}</div></div>
    <div class="card"><b>🔍 Moteur de recherche</b><div class="field"><select id="eng">${Object.entries(D.engines).map(([id, e]) => `<option value="${id}" ${id === cfg.engine ? 'selected' : ''}>${e.name}</option>`).join('')}</select></div></div>
    <div class="card"><b>🛡 Bouclier & vie privée</b>
      <label class="sw"><input type="checkbox" id="shT" ${cfg.trackers ? 'checked' : ''}> Bloquer les traqueurs</label>
      <label class="sw"><input type="checkbox" id="shH" ${cfg.https ? 'checked' : ''}> HTTPS automatique</label>
      <div class="row" style="margin-top:1rem"><button class="btn2" id="clr">🧹 Effacer historique et cookies</button><button class="btn2" id="wipe">🔑 Supprimer mes clés</button></div></div>
    <div class="card"><b>À propos</b><p style="color:var(--muted);font-size:.9rem;margin-top:.4rem">Clipia Nova 1.0 · CLENDAX · conçu par Clin Fabrice (Flize, Ardennes)</p><button class="btn2" id="rew" style="margin-top:.7rem">Relancer l'assistant</button></div>`;
  provForm($('#sp2'), cfg.provider, false);
  S.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { cfg.provider = b.dataset.p; save(); renderSettings(); updEngine(); });
  S.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { toggleMail(b.dataset.m); renderSettings(); });
  $('#eng').onchange = e => { cfg.engine = e.target.value; save(); if (A) A.engine(D.engines[cfg.engine].url); };
  $('#shT').onchange = e => { cfg.trackers = e.target.checked; save(); if (A) A.shield('trackers', cfg.trackers); };
  $('#shH').onchange = e => { cfg.https = e.target.checked; save(); if (A) A.shield('https', cfg.https); };
  $('#clr').onclick = () => { if (A) A.clearHistory(); toast('✓ Données effacées'); };
  $('#wipe').onclick = () => { KEYS = {}; saveKeys(); toast('✓ Clés supprimées'); renderSettings(); };
  $('#rew').onclick = () => { $('#tabsBar').classList.add('hidden'); document.querySelectorAll('.view').forEach(s => s.classList.add('hidden')); step = 0; startWizard(); };
}

/* ---------- Clipia IA ---------- */
let convo = [], aiReady = false, aiOrb = null, hands = false, lastTalk = 0;
function orbState(st, txt) { if (window.Orb) Orb.setAll(st); const e = $('#aiState'); if (e && txt) e.textContent = txt; const m = $('#micBtn'); if (m) m.classList.toggle('on', st === 'listening'); }
function listen() { if (!A) return toast('La voix fonctionne dans l\'application Android'); if (window.speechSynthesis) speechSynthesis.cancel(); A.stopSpeak(); A.listen(); }
window.novaVoice = (type, v) => {
  if (type === 'listening') orbState('listening', 'Je vous écoute…');
  else if (type === 'listening-voice') orbState('listening', 'Je vous entends…');
  else if (type === 'level') Orb.setAll(undefined, parseFloat(v));
  else if (type === 'partial') { const e = $('#aiState'); if (e) e.textContent = '« ' + v + ' »'; }
  else if (type === 'thinking') orbState('thinking', 'Je comprends…');
  else if (type === 'heard') {
    if (!v) { orbState('idle', 'Je n\'ai rien entendu'); if (hands) setTimeout(listen, 400); return; }
    const wake = /\b(clipia|clipya|klipia|cli pia)\b[,!.\s]*/i;
    if (!hands || wake.test(v) || Date.now() - lastTalk < 30000) { lastTalk = Date.now(); const cmd = v.replace(wake, '').trim(); send(cmd || 'Bonjour', null, true); }
    else setTimeout(listen, 300);
  }
  else if (type === 'nothing') { orbState('idle', hands ? 'Mains libres : dites « Clipia… »' : 'Touchez la sphère ou 🎤 pour parler'); if (hands) setTimeout(listen, 500); }
  else if (type === 'speak-start') orbState('speaking', 'Clipia parle…');
  else if (type === 'speak-end') { lastTalk = Date.now(); Orb.setAll(undefined, 0); orbState('idle', hands ? 'Mains libres : dites « Clipia… »' : 'Touchez la sphère ou 🎤 pour parler'); if (hands) setTimeout(listen, 250); }
  else if (type === 'error') { orbState('idle', v); toast(v); }
};
function say(text) {
  const clean = String(text).replace(/```[\s\S]*?```/g, ' ').replace(/[*#_`>|]/g, '').slice(0, 2500);
  if (A && A.speak(clean, 1.0)) return;
  orbState('speaking'); const iv = setInterval(() => Orb.setAll(undefined, .4 + Math.random() * .6), 110);
  setTimeout(() => { clearInterval(iv); window.novaVoice('speak-end', ''); }, Math.min(9000, 900 + clean.length * 55));
}
function updEngine() { const p = D.providers[cfg.provider]; $('#aiEngine').textContent = p.name + ' · ' + modelOf(cfg.provider); }
function initAI() {
  if (aiReady) return; aiReady = true;
  aiOrb = new Orb($('#aiOrb'), { points: 700, interactive: true, scale: 0.42 }); aiOrb.onClick = listen;
  $('#micBtn').onclick = listen;
  $('#handsBtn').onclick = () => { hands = !hands; $('#handsBtn').classList.toggle('on', hands); $('#handsBtn').textContent = hands ? '🖐 Mains libres : activé' : '🖐 Mains libres'; if (hands) { orbState('listening', 'Mains libres : dites « Clipia… »'); listen(); } else { A && A.stopListen(); orbState('idle', 'Touchez la sphère ou 🎤 pour parler'); } };
  $('#aiMode').innerHTML = Object.entries(D.modes).map(([id, m]) => `<option value="${id}">${m.label}</option>`).join('');
  $('#aiMode').value = cfg.mode; $('#aiMode').onchange = e => { cfg.mode = e.target.value; save(); };
  $('#aiVoice').textContent = cfg.voice ? '🔊' : '🔈';
  $('#aiVoice').onclick = () => { cfg.voice = !cfg.voice; save(); $('#aiVoice').textContent = cfg.voice ? '🔊' : '🔈'; };
  $('#aiClear').onclick = () => { convo = []; $('#chat').innerHTML = ''; hello(); };
  $('#askGo').onclick = () => { const v = $('#askIn').value.trim(); if (v) { $('#askIn').value = ''; send(v); } };
  document.querySelectorAll('#v-ai [data-q]').forEach(b => b.onclick = () => send({
    ig: "Écris une légende Instagram percutante avec emojis et 15 hashtags. Demande-moi d'abord le sujet.",
    tt: "Écris un script TikTok de 30 secondes (accroche, 4 plans, texte à l'écran, son, hashtags). Demande-moi d'abord le sujet.",
    fb: "Rédige un post Facebook engageant avec un appel à l'action. Demande-moi d'abord le sujet.",
    clip: "Propose-moi 3 idées de clip musical originales pour CLENDAX, avec l'ambiance, 5 plans clés et une accroche TikTok pour chacune.",
    post: "Aide-moi à rédiger un post réseaux sociaux accrocheur. Pose-moi d'abord 2 questions sur le sujet.",
    plan: "Aide-moi à construire un plan d'action concret pour mon objectif. Demande-moi d'abord mon objectif.",
    idee: "Aide-moi à transformer une idée en projet réel. Demande-moi d'abord mon idée."
  }[b.dataset.q]));
  hello();
}
function hello() { bubble('a', `Bonjour${cfg.name ? ' ' + cfg.name : ''} ! Je suis Clipia. Sur une page web, touchez ✦ en haut pour que je la résume, la traduise ou l'explique.`); }
function bubble(c, t) { const d = document.createElement('div'); d.className = 'msg ' + c; d.textContent = t; $('#chat').appendChild(d); scrollTo(0, document.body.scrollHeight); return d; }
function enterAI() {
  updEngine();
  let ctx = ''; try { ctx = A ? A.pageContext() : ''; } catch {}
  if (!ctx) return;
  let pg; try { pg = JSON.parse(ctx); } catch { return; }
  const box = document.createElement('div'); box.className = 'msg t';
  box.innerHTML = `Page ouverte : <b>${esc(pg.title)}</b><div class="quick" style="margin-top:.5rem"><button data-a="sum">📝 Résumer</button><button data-a="tr">🌍 Traduire</button><button data-a="exp">💡 Expliquer</button></div>`;
  $('#chat').appendChild(box);
  box.querySelectorAll('[data-a]').forEach(b => b.onclick = () => {
    const ask = { sum: 'Résume cette page en 5 points clairs, en français.', tr: 'Traduis le contenu principal de cette page en français.', exp: 'Explique simplement le contenu de cette page.' }[b.dataset.a];
    send(`${ask}\n\nTitre : ${pg.title}\nAdresse : ${pg.url}\nContenu :\n${pg.text}`, b.textContent + ' : ' + pg.title);
  });
}
async function send(text, shown, fromVoice) {
  if (view !== 'ai') show('ai');
  const p = D.providers[cfg.provider];
  bubble('u', shown || text);
  if (!p.noKey && !KEYS[cfg.provider]) { bubble('e', `Aucune clé ${p.name} configurée : ⚙ Réglages → Intelligence artificielle.`); return; }
  convo.push({ role: 'user', content: text });
  const low = text.toLowerCase().trim(); let mm;
  if ((mm = low.match(/^(?:souviens-toi|souviens toi|retiens)(?: que)?\s+(.+)/))) { cfg.memory = [...(cfg.memory || []), mm[1]]; save(); const r = 'C\'est noté, je m\'en souviendrai. Tout reste sur ce téléphone.'; bubble('a', r); if (cfg.voice || fromVoice) say(r); return; }
  if ((mm = low.match(/^(?:ouvre|va sur|lance)\s+(.+)/))) { const q = mm[1].trim(); const app = D.store.find(a => a.name.toLowerCase().startsWith(q)); if (app) { bubble('a', 'J\'ouvre ' + app.name + '.'); return open(app.url); } }
  if ((mm = low.match(/^(?:cherche|recherche)\s+(.+)/))) { bubble('a', 'Je cherche : ' + mm[1]); return open(D.engines[cfg.engine].url + encodeURIComponent(mm[1])); }
  const w = bubble('t', 'Clipia réfléchit…'); orbState('thinking', 'Je réfléchis…');
  const sys = (cfg.mode === 'perso' && cfg.customPrompt ? 'Tu es Clipia. ' + cfg.customPrompt : D.modes[cfg.mode].prompt) + (cfg.name ? ` L'utilisateur s'appelle ${cfg.name}.` : '') + ((cfg.memory || []).length ? ' Ce que tu sais de l\'utilisateur : ' + cfg.memory.join(' ; ') + '.' : '') + ' Tu es intégrée au navigateur Clipia Nova (CLENDAX) sur téléphone : réponds de façon concise.';
  const r = await aiChat(cfg.provider, sys, convo.slice(-16));
  w.remove();
  if (r.error) { convo.pop(); bubble('e', '✕ ' + r.error); orbState('idle', 'Un souci est survenu'); return; }
  convo.push({ role: 'assistant', content: r.text }); bubble('a', r.text);
  if (cfg.voice || fromVoice) say(r.text); else orbState('idle', 'Touchez la sphère ou 🎤 pour parler');
}
