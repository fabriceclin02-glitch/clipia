/* =========================================================
   Clipia Nova — interface du navigateur
   ========================================================= */
const D = window.NOVA_DATA;
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- Configuration (les clés API sont à part, chiffrées) ---------- */
const DEF = { onboarded: false, name: '', provider: 'gemini', models: {}, mode: 'ami', customPrompt: '', engine: 'google',
  mails: [], installed: ['clipia', 'gmail', 'youtube', 'claude', 'whatsapp', 'maps'], history: [], devApps: [], voice: false,
  shield: { trackers: true, https: true } };
let cfg = load();
let KEYS = {};
function load() { try { return { ...DEF, ...JSON.parse(localStorage.getItem('nova.cfg') || '{}') }; } catch { return { ...DEF }; } }
function save() { try { localStorage.setItem('nova.cfg', JSON.stringify(cfg)); } catch {} }
const modelOf = (p) => cfg.models[p] || D.providers[p].model;

function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 2600); }

/* ---------- Sphère 3D (logo animé Clipia) ---------- */
function sphere(canvas, { points = 900, speed = 1, full = false } = {}) {
  const ctx = canvas.getContext('2d');
  const pts = [];
  const N = points, gold = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = gold * i;
    pts.push([Math.cos(th) * r, y, Math.sin(th) * r]);
  }
  let a = 0, b = 0, alive = true, t0 = performance.now();
  function frame(now) {
    if (!alive || !canvas.isConnected) return;
    const dpr = window.devicePixelRatio || 1;
    const W = (full ? innerWidth : canvas.clientWidth || canvas.width) * dpr;
    const H = (full ? innerHeight : canvas.clientHeight || canvas.height) * dpr;
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    ctx.clearRect(0, 0, W, H);
    const t = (now - t0) / 1000;
    a += 0.006 * speed; b = Math.sin(t * 0.4) * 0.35;
    const R = Math.min(W, H) * (full ? 0.26 : 0.4) * (1 + Math.sin(t * 1.6) * 0.025);
    const cx = W / 2, cy = full ? H * 0.38 : H / 2;
    const g = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R * 1.6);
    g.addColorStop(0, 'rgba(139,92,246,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.6, 0, 7); ctx.fill();
    const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
    for (const [x0, y0, z0] of pts) {
      const wave = 1 + Math.sin(t * 2 + y0 * 6) * 0.03;
      let x = x0 * ca - z0 * sa, z = x0 * sa + z0 * ca, y = y0 * cb - z * sb; z = y0 * sb + z * cb;
      x *= wave; y *= wave;
      const d = (z + 1.6) / 2.6;
      const hue = 215 + (y0 + 1) * 45;
      ctx.fillStyle = `hsla(${hue},90%,${55 + d * 20}%,${0.15 + d * 0.85})`;
      const s = (0.6 + d * 1.8) * dpr;
      ctx.beginPath(); ctx.arc(cx + x * R, cy + y * R, s, 0, 7); ctx.fill();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return () => { alive = false; };
}

/* =========================================================
   1. DÉMARRAGE
   ========================================================= */
(async function boot() {
  const stop = sphere($('#sphere'), { points: 1400, speed: 1.4, full: true });
  try { KEYS = await window.nova.getKeys(); } catch { KEYS = {}; }
  try { await window.nova.setShield(cfg.shield); } catch {}
  setTimeout(() => {
    $('#splash').classList.add('out');
    setTimeout(() => { stop(); $('#splash').remove(); }, 900);
    cfg.onboarded ? startBrowser() : startWizard();
  }, 2900);
})();

/* =========================================================
   2. ASSISTANT DE CONFIGURATION
   ========================================================= */
let step = 0;
const STEPS = [stepWelcome, stepShield, stepAI, stepMail, stepStyle, stepDone];

function startWizard() {
  $('#wizard').classList.remove('hidden');
  sphere($('#wzSphere'), { points: 500 });
  $('#wzDots').innerHTML = STEPS.map(() => '<i></i>').join('');
  $('#wzBack').onclick = () => { if (step > 0) { step--; renderStep(); } };
  $('#wzNext').onclick = async () => {
    const ok = await (STEPS[step].leave || (() => true))();
    if (!ok) return;
    if (step < STEPS.length - 1) { step++; renderStep(); }
    else { cfg.onboarded = true; save(); $('#wizard').classList.add('hidden'); startBrowser(); }
  };
  renderStep();
}
function renderStep() {
  [...$('#wzDots').children].forEach((d, i) => d.classList.toggle('on', i <= step));
  $('#wzBack').style.visibility = step ? 'visible' : 'hidden';
  $('#wzNext').textContent = step === STEPS.length - 1 ? 'Ouvrir Clipia Nova ✦' : 'Continuer →';
  STEPS[step]();
}

function stepWelcome() {
  $('#wzBody').innerHTML = `
    <h2>Bienvenue dans Clipia Nova</h2>
    <p class="lead">Le navigateur qui pense avec vous… et qui protège votre vie privée.</p>
    <div class="say">Bonjour ! Je suis <b>Clipia</b>. Je vais vous guider pendant 2 minutes pour tout configurer : votre sécurité, votre IA et vos messageries. Vous pourrez tout modifier plus tard dans les Réglages ⚙.</div>
    <div class="field"><label>Comment voulez-vous que je vous appelle ?</label><input id="wName" placeholder="Votre prénom" value="${esc(cfg.name)}"></div>`;
  $('#wName').focus();
  stepWelcome.leave = () => { cfg.name = $('#wName').value.trim(); save(); return true; };
}

function stepShield() {
  $('#wzBody').innerHTML = `
    <h2>🛡 Votre bouclier est actif</h2>
    <p class="lead">${cfg.name ? esc(cfg.name) + ', v' : 'V'}oici ce que Clipia Nova fait pour vous, en permanence.</p>
    <div class="shield-list">
      <div>🚫<p><b>Traqueurs publicitaires bloqués</b><span>Les mouchards qui suivent votre navigation de site en site sont stoppés.</span></p></div>
      <div>🔒<p><b>HTTPS automatique</b><span>Les sites sont ouverts en version chiffrée dès que possible.</span></p></div>
      <div>🔑<p><b>Clés IA chiffrées sur votre ordinateur</b><span>Elles sont protégées par le coffre-fort de votre système et ne partent que vers l'IA que vous choisissez.</span></p></div>
      <div>🎥<p><b>Caméra, micro, position : toujours sur autorisation</b><span>Aucun site n'y accède sans votre accord explicite.</span></p></div>
      <div>🙈<p><b>Aucune collecte de vos données</b><span>Clipia Nova n'envoie ni votre historique, ni vos e-mails, ni vos mots de passe à CLENDAX ou à qui que ce soit.</span></p></div>
    </div>`;
  stepShield.leave = () => true;
}

let wzProv = null;
function stepAI() {
  wzProv = wzProv || cfg.provider;
  const P = D.providers;
  $('#wzBody').innerHTML = `
    <h2>✦ Choisissez votre intelligence</h2>
    <div class="say">Clipia peut utiliser l'IA de votre choix. <b>Important :</b> un abonnement grand public (ChatGPT Plus, Claude Pro, Gemini Advanced…) ne fournit pas de clé : il faut créer une <b>clé API</b> sur la console développeur du fournisseur. C'est gratuit à créer ; l'usage est facturé au fil de l'eau, souvent quelques centimes. Les moteurs marqués <b>Gratuit</b> ont une offre sans frais.</div>
    <div class="grid-prov">${Object.entries(P).map(([id, p]) => `
      <button class="prov ${id === wzProv ? 'on' : ''}" data-p="${id}"><b>${p.name}</b><small>${p.by}</small>
      ${p.free ? '<br><small style="color:#a5b4fc">Gratuit possible</small>' : ''}${KEYS[id] || p.noKey ? '<br><span class="ok">● prêt</span>' : ''}</button>`).join('')}</div>
    <div id="provBox"></div>`;
  $('#wzBody').querySelectorAll('.prov').forEach(b => b.onclick = () => { wzProv = b.dataset.p; stepAI(); });
  providerForm($('#provBox'), wzProv, true);
  stepAI.leave = () => {
    cfg.provider = wzProv; save();
    if (!KEYS[wzProv] && !P[wzProv].noKey) { toast('Vous pourrez ajouter votre clé plus tard dans ⚙ Réglages'); }
    return true;
  };
}

// Formulaire de configuration d'un moteur (assistant + réglages)
function providerForm(box, id, guide) {
  const p = D.providers[id];
  box.innerHTML = `
    ${guide ? `<div class="say" style="margin-top:1.2rem">${p.noKey
      ? `Ollama fait tourner l'IA <b>directement sur votre ordinateur</b>, sans clé et sans internet. 1) Installez Ollama. 2) Ouvrez un terminal et tapez <code>ollama pull ${p.model}</code>. 3) Cliquez sur « Tester ».`
      : `1) Cliquez sur « Obtenir ma clé ${p.name} ». 2) Connectez-vous et créez une clé. 3) Copiez-la et collez-la ci-dessous. 4) Cliquez sur « Tester ».`}</div>` : ''}
    <div class="row" style="margin-top:.8rem"><button class="btn2" id="getKey">🔗 ${p.noKey ? 'Télécharger Ollama' : 'Obtenir ma clé ' + p.name}</button></div>
    ${p.noKey ? '' : `<div class="field"><label>Clé API ${p.name}</label><input id="kIn" type="password" placeholder="Collez votre clé ici" value="${esc(KEYS[id] || '')}" autocomplete="off"></div>`}
    <div class="field"><label>Modèle</label><div class="row"><input id="mIn" list="mList" value="${esc(modelOf(id))}" style="flex:1"><datalist id="mList"></datalist><button class="btn2" id="loadM">⟳ Mes modèles</button></div></div>
    <div class="row" style="margin-top:1rem"><button class="primary" id="testP">Tester ${p.name}</button></div>
    <div class="status" id="pStatus"></div>`;
  $('#getKey', box).onclick = () => window.nova.openExternal(p.keyUrl);
  const persist = async () => {
    const k = $('#kIn', box); if (k) KEYS[id] = k.value.trim();
    cfg.models[id] = $('#mIn', box).value.trim() || p.model; save();
    const r = await window.nova.setKeys(KEYS);
    return r;
  };
  $('#loadM', box).onclick = async () => {
    await persist(); const st = $('#pStatus', box); st.className = 'status'; st.textContent = 'Recherche des modèles disponibles…';
    const r = await window.nova.aiModels({ provider: id, apiKey: KEYS[id] });
    if (r.error) { st.className = 'status bad'; st.textContent = '✕ ' + r.error; return; }
    $('#mList', box).innerHTML = r.models.map(m => `<option value="${esc(m)}">`).join('');
    st.className = 'status good'; st.textContent = `✓ ${r.models.length} modèles disponibles avec votre compte. Cliquez dans le champ Modèle pour choisir.`;
  };
  $('#testP', box).onclick = async () => {
    const r0 = await persist(); const st = $('#pStatus', box); st.className = 'status'; st.textContent = 'Test en cours…';
    const r = await window.nova.aiChat({ provider: id, apiKey: KEYS[id], model: modelOf(id), system: 'Réponds en une phrase courte, en français.', messages: [{ role: 'user', content: 'Dis bonjour et présente-toi.' }] });
    if (r.error) { st.className = 'status bad'; st.textContent = '✕ ' + r.error; return; }
    st.className = 'status good';
    st.textContent = '✓ ' + p.name + ' répond : « ' + r.text.trim().slice(0, 160) + ' »' + (r0 && r0.encrypted === false ? '\n⚠ Le coffre-fort système est indisponible sur cet ordinateur : la clé est stockée localement sans chiffrement.' : '');
    if (box.closest('#wizard')) stepAIrefreshBadge(id);
  };
}
function stepAIrefreshBadge(id) { const b = document.querySelector(`.prov[data-p="${id}"]`); if (b && !b.querySelector('.ok')) b.insertAdjacentHTML('beforeend', '<br><span class="ok">● prêt</span>'); }

function stepMail() {
  $('#wzBody').innerHTML = `
    <h2>✉ Vos messageries</h2>
    <div class="say">Sélectionnez vos boîtes mail : elles s'ouvriront dans Clipia Nova et vous resterez connecté. Vous vous connectez <b>directement sur le site officiel</b> de votre messagerie : Clipia Nova ne voit jamais votre mot de passe et ne copie pas vos e-mails.</div>
    <div class="mails">${D.mails.map(m => `<button data-m="${m.id}" class="${cfg.mails.includes(m.id) ? 'on' : ''}">${m.ic} ${m.name}${cfg.mails.includes(m.id) ? '<br><small style="color:var(--ok)">✓ ajoutée</small>' : ''}</button>`).join('')}</div>
    <p class="note">Astuce : vous pourrez ouvrir toutes vos boîtes d'un clic avec le bouton ✉ Mails.</p>`;
  $('#wzBody').querySelectorAll('[data-m]').forEach(b => b.onclick = () => {
    const id = b.dataset.m; cfg.mails = cfg.mails.includes(id) ? cfg.mails.filter(x => x !== id) : [...cfg.mails, id]; save(); stepMail();
  });
  stepMail.leave = () => true;
}

function stepStyle() {
  $('#wzBody').innerHTML = `
    <h2>Comment veux-tu que nous discutions ?</h2>
    <p class="lead">Choisissez la personnalité de Clipia. Vous pourrez en changer à tout moment.</p>
    <div class="modes">${Object.entries(D.modes).map(([id, m]) => `<button class="prov ${cfg.mode === id ? 'on' : ''}" data-mode="${id}"><b>${m.label}</b></button>`).join('')}</div>
    <div class="field ${cfg.mode === 'perso' ? '' : 'hidden'}" id="persoBox"><label>Décrivez votre style (ex. : « Parle-moi comme un coach sportif, avec humour »)</label><textarea id="persoIn" rows="3">${esc(cfg.customPrompt)}</textarea></div>`;
  $('#wzBody').querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { cfg.mode = b.dataset.mode; save(); stepStyle(); });
  stepStyle.leave = () => { const t = $('#persoIn'); if (t) cfg.customPrompt = t.value.trim(); save(); return true; };
}

function stepDone() {
  const p = D.providers[cfg.provider];
  $('#wzBody').innerHTML = `
    <h2>Tout est prêt${cfg.name ? ', ' + esc(cfg.name) : ''} ✦</h2>
    <p class="lead">Voici votre Clipia Nova.</p>
    <div class="shield-list">
      <div>🛡<p><b>Bouclier</b><span>Traqueurs bloqués, HTTPS automatique, autorisations sous contrôle.</span></p></div>
      <div>✦<p><b>IA : ${p.name}</b><span>${KEYS[cfg.provider] || p.noKey ? 'Configurée' : 'Clé à ajouter dans ⚙ Réglages'} · modèle ${esc(modelOf(cfg.provider))}</span></p></div>
      <div>✉<p><b>Messageries</b><span>${cfg.mails.length ? cfg.mails.map(id => D.mails.find(m => m.id === id).name).join(', ') : 'Aucune pour le moment'}</span></p></div>
      <div>🎭<p><b>Style</b><span>${D.modes[cfg.mode].label}</span></p></div>
    </div>
    <p class="note">Raccourcis : Ctrl+T nouvel onglet · Ctrl+W fermer · Ctrl+L barre d'adresse · Ctrl+J Clipia IA</p>`;
  stepDone.leave = () => true;
}

/* =========================================================
   3. NAVIGATEUR
   ========================================================= */
let tabs = [], active = null, uid = 0, blocked = 0;

let started = false;
function startBrowser() {
  $('#browser').classList.remove('hidden');
  if (started) { updEngine(); $('#aiMode').value = cfg.mode; tabs.filter(t => t.kind !== 'web').forEach(renderInternal); return; }
  started = true;
  newTab('home');
  $('#newTab').onclick = () => newTab('home');
  $('#back').onclick = () => { const t = cur(); if (t?.wv?.canGoBack()) t.wv.goBack(); };
  $('#fwd').onclick = () => { const t = cur(); if (t?.wv?.canGoForward()) t.wv.goForward(); };
  $('#reload').onclick = () => { const t = cur(); if (t?.wv) t.wv.reload(); else renderInternal(t); };
  $('#home').onclick = () => navigate('nova://accueil');
  $('#btnStore').onclick = () => openInternal('store');
  $('#btnMail').onclick = openMails;
  $('#btnSettings').onclick = () => openInternal('settings');
  $('#btnAI').onclick = () => $('#ai').classList.toggle('closed');
  $('#aiClose').onclick = () => $('#ai').classList.add('closed');
  $('#url').addEventListener('keydown', e => { if (e.key === 'Enter') { navigate($('#url').value); $('#url').blur(); } });
  $('#url').addEventListener('focus', () => $('#url').select());
  window.nova.onOpenTab(url => newTab('web', url));
  window.nova.onBlocked(n => { blocked = n; $('#lock').title = n + ' traqueur(s) bloqué(s)'; const b = $('#blockedN'); if (b) b.textContent = n; });
  document.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === 't') { e.preventDefault(); newTab('home'); }
    if (k === 'w') { e.preventDefault(); closeTab(active); }
    if (k === 'l') { e.preventDefault(); $('#url').focus(); }
    if (k === 'j') { e.preventDefault(); $('#ai').classList.toggle('closed'); }
  });
  initAI();
}
const cur = () => tabs.find(t => t.id === active);

function newTab(kind, url) {
  const t = { id: ++uid, kind, url: url || '', title: 'Nouvel onglet' };
  tabs.push(t);
  if (kind === 'web') makeWebview(t, url); else { t.el = document.createElement('div'); t.el.className = 'view'; $('#views').appendChild(t.el); renderInternal(t); }
  activate(t.id);
  return t;
}
function makeWebview(t, url) {
  if (t.el) t.el.remove();
  const wv = document.createElement('webview');
  wv.className = 'view';
  wv.setAttribute('partition', 'persist:nova');
  wv.setAttribute('allowpopups', '');
  wv.src = url;
  t.wv = wv; t.el = wv; t.kind = 'web'; t.url = url;
  wv.addEventListener('page-title-updated', e => { t.title = e.title; drawTabs(); });
  const upd = e => { t.url = e.url; if (t.id === active) $('#url').value = e.url; addHistory(t.url, t.title); };
  wv.addEventListener('did-navigate', upd);
  wv.addEventListener('did-navigate-in-page', e => { if (e.isMainFrame) upd(e); });
  wv.addEventListener('did-fail-load', e => { if (e.errorCode !== -3 && e.isMainFrame) toast('Impossible de charger la page (' + e.errorDescription + ')'); });
  $('#views').appendChild(wv);
}
function activate(id) {
  active = id;
  tabs.forEach(t => t.el.classList.toggle('on', t.id === id));
  const t = cur();
  $('#url').value = t.kind === 'web' ? t.url : 'nova://' + ({ home: 'accueil', store: 'store', settings: 'reglages' }[t.kind]);
  $('#lock').textContent = t.kind === 'web' ? (t.url.startsWith('https') ? '🔒' : '⚠') : '✦';
  drawTabs();
}
function closeTab(id) {
  const i = tabs.findIndex(t => t.id === id); if (i < 0) return;
  tabs[i].el.remove(); tabs.splice(i, 1);
  if (!tabs.length) return newTab('home');
  if (active === id) activate(tabs[Math.max(0, i - 1)].id); else drawTabs();
}
function drawTabs() {
  $('#tabs').innerHTML = tabs.map(t => `<div class="tab ${t.id === active ? 'on' : ''}" data-id="${t.id}"><span>${esc(t.kind === 'store' ? '🛍 Store' : t.kind === 'settings' ? '⚙ Réglages' : t.title)}</span><b class="x" data-x="${t.id}">✕</b></div>`).join('');
  $('#tabs').querySelectorAll('.tab').forEach(el => el.onclick = e => { if (e.target.dataset.x) closeTab(+e.target.dataset.x); else activate(+el.dataset.id); });
}
function navigate(input) {
  let s = (input || '').trim(); if (!s) return;
  const t = cur();
  if (/^nova:\/\/(accueil|home)?/.test(s)) return toInternal(t, s.includes('store') ? 'store' : s.includes('reglages') ? 'settings' : 'home');
  let url;
  if (/^https?:\/\//i.test(s)) url = s;
  else if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?$/.test(s) && !s.includes(' ')) url = 'https://' + s;
  else url = D.engines[cfg.engine].url + encodeURIComponent(s);
  if (t.kind === 'web') t.wv.loadURL(url);
  else { makeWebview(t, url); activate(t.id); }
}
function toInternal(t, kind) {
  if (t.wv) { t.wv.remove(); t.wv = null; t.el = document.createElement('div'); t.el.className = 'view'; $('#views').appendChild(t.el); }
  t.kind = kind; t.title = 'Nouvel onglet'; renderInternal(t); activate(t.id);
}
function openInternal(kind) { const ex = tabs.find(t => t.kind === kind); ex ? activate(ex.id) : newTab(kind); }
function openMails() {
  const list = cfg.mails.length ? cfg.mails : [];
  if (!list.length) { openInternal('settings'); toast('Choisissez vos messageries dans la section ✉'); return; }
  list.forEach(id => newTab('web', D.mails.find(m => m.id === id).url));
}
function addHistory(url, title) {
  if (!url || url.startsWith('about:')) return;
  cfg.history = [{ url, title: title || url, at: Date.now() }, ...cfg.history.filter(h => h.url !== url)].slice(0, 30); save();
}

/* ---------- Pages internes ---------- */
function renderInternal(t) {
  if (t.kind === 'home') pageHome(t.el);
  if (t.kind === 'store') pageStore(t.el);
  if (t.kind === 'settings') pageSettings(t.el);
}

function pageHome(el) {
  const apps = cfg.installed.map(id => D.store.find(a => a.id === id) || cfg.devApps.find(a => a.id === id)).filter(Boolean);
  const h = new Date().getHours();
  const hello = (h < 6 ? 'Bonne nuit' : h < 18 ? 'Bonjour' : 'Bonsoir') + (cfg.name ? ', ' + esc(cfg.name) : '');
  el.innerHTML = `<div class="page">
    <div class="home-hero"><canvas class="hs"></canvas><h1>CLIPIA <span>NOVA</span></h1><p>${hello} — que cherchons-nous aujourd'hui ?</p>
      <form class="search"><input placeholder="Rechercher sur le web…" autofocus><select>${Object.entries(D.engines).map(([id, e]) => `<option value="${id}" ${id === cfg.engine ? 'selected' : ''}>${e.name}</option>`).join('')}</select><button class="primary">Rechercher</button></form>
      <button class="ask-ai">✦ ou demander directement à Clipia</button>
      <div class="safe-badge">🛡 Bouclier actif · <b id="blockedN">${blocked}</b> traqueur(s) bloqué(s) depuis l'ouverture</div>
    </div>
    <h3 class="sec">Mes applications</h3>
    <div class="tiles">${apps.map(a => `<div class="tile" data-url="${esc(a.url)}"><span class="rm" data-rm="${a.id}">✕</span><div class="ic">${a.ic}</div><small>${esc(a.name)}</small></div>`).join('')}
      <div class="tile" data-store="1"><div class="ic">＋</div><small>Ajouter</small></div></div>
    ${cfg.history.length ? `<h3 class="sec">Récemment visité</h3><div class="hist">${cfg.history.slice(0, 6).map(x => `<button data-url="${esc(x.url)}">🕘 ${esc(x.title)}</button>`).join('')}</div>` : ''}
  </div>`;
  sphere($('.hs', el), { points: 600 });
  const f = $('.search', el);
  $('select', f).onchange = e => { cfg.engine = e.target.value; save(); };
  f.onsubmit = e => { e.preventDefault(); navigate($('input', f).value); };
  $('.ask-ai', el).onclick = () => { const q = $('input', f).value.trim(); $('#ai').classList.remove('closed'); if (q) send(q); else $('#askIn').focus(); };
  el.querySelectorAll('[data-url]').forEach(x => x.onclick = e => { if (e.target.dataset.rm) return; navigate(x.dataset.url); });
  el.querySelectorAll('[data-rm]').forEach(x => x.onclick = () => { cfg.installed = cfg.installed.filter(i => i !== x.dataset.rm); save(); pageHome(el); });
  $('[data-store]', el).onclick = () => openInternal('store');
}

let storeCat = 'Tout';
function pageStore(el) {
  const all = [...D.store, ...cfg.devApps];
  const cats = ['Tout', ...new Set(all.map(a => a.cat))];
  const list = all.filter(a => storeCat === 'Tout' || a.cat === storeCat);
  el.innerHTML = `<div class="page">
    <div class="store-head"><div><h1>Clipia <span>Store</span></h1><p style="color:var(--muted)">Installez vos applications préférées en un clic. Elles apparaissent sur votre page d'accueil.</p></div>
    <input id="sq" placeholder="🔍 Rechercher une application" style="background:#0e0c2c;border:1px solid var(--line);border-radius:999px;padding:.7rem 1.2rem;min-width:260px"></div>
    <div class="cats">${cats.map(c => `<button class="${c === storeCat ? 'on' : ''}" data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div>
    <div class="apps">${list.map(a => appCard(a)).join('')}</div>
    <div class="dev"><h2>👩‍💻 Publiez votre application — gratuit</h2>
      <p style="color:var(--muted);margin:.4rem 0 1rem">Développeurs : proposez votre application web au Clipia Store.</p>
      <div class="row"><input id="dName" placeholder="Nom" style="flex:1"><input id="dUrl" placeholder="https://…" style="flex:2"><input id="dIc" placeholder="Emoji" style="width:90px"></div>
      <div class="field"><input id="dDesc" placeholder="Description courte"></div>
      <button class="primary" id="dSend" style="margin-top:1rem">Soumettre</button>
      <p class="note">Version 1.0 : l'application est ajoutée à votre Store local, marquée « en attente de validation ». La publication pour tous passera par le serveur du Store (voir guide d'hébergement).</p>
    </div></div>`;
  el.querySelectorAll('.cats button').forEach(b => b.onclick = () => { storeCat = b.dataset.c; pageStore(el); });
  $('#sq', el).oninput = e => { const q = e.target.value.toLowerCase(); el.querySelectorAll('.app').forEach(c => c.style.display = c.textContent.toLowerCase().includes(q) ? '' : 'none'); };
  el.querySelectorAll('[data-inst]').forEach(b => b.onclick = () => {
    const id = b.dataset.inst; const on = cfg.installed.includes(id);
    cfg.installed = on ? cfg.installed.filter(i => i !== id) : [...cfg.installed, id]; save();
    toast(on ? 'Application retirée' : '✓ Ajoutée à votre accueil'); pageStore(el);
    tabs.filter(t => t.kind === 'home').forEach(renderInternal);
  });
  el.querySelectorAll('[data-open]').forEach(b => b.onclick = () => newTab('web', b.dataset.open));
  $('#dSend', el).onclick = () => {
    const name = $('#dName', el).value.trim(), url = $('#dUrl', el).value.trim();
    if (!name || !/^https:\/\//.test(url)) return toast('Nom et adresse https:// obligatoires');
    cfg.devApps.push({ id: 'dev-' + Date.now(), cat: 'Développeurs', ic: $('#dIc', el).value.trim() || '🧩', name, by: 'En attente de validation', desc: $('#dDesc', el).value.trim(), url, pending: true });
    save(); toast('✓ Application soumise'); storeCat = 'Développeurs'; pageStore(el);
  };
}
function appCard(a) {
  const on = cfg.installed.includes(a.id);
  return `<div class="app"><div class="top"><div class="ic">${a.ic}</div><div><b>${esc(a.name)}${a.star ? '<span class="tag">CLENDAX</span>' : ''}</b><small>${esc(a.by)}</small></div></div>
    <p>${esc(a.desc)}</p><div class="act"><button data-open="${esc(a.url)}">Ouvrir</button><button class="inst ${on ? 'done' : ''}" data-inst="${a.id}">${on ? '✓ Installée' : 'Installer'}</button></div></div>`;
}

function pageSettings(el) {
  el.innerHTML = `<div class="page"><div class="settings">
    <h1>⚙ Réglages</h1>
    <div class="card"><h2>✦ Intelligence artificielle</h2><p class="note">Moteur principal utilisé par Clipia. Configurez autant de moteurs que vous voulez.</p>
      <div class="grid-prov" style="margin-top:1rem">${Object.entries(D.providers).map(([id, p]) => `<button class="prov ${id === cfg.provider ? 'on' : ''}" data-p="${id}"><b>${p.name}</b><small>${p.by}</small>${KEYS[id] || p.noKey ? '<br><span class="ok">● prêt</span>' : ''}</button>`).join('')}</div>
      <div id="sProv"></div></div>
    <div class="card"><h2>✉ Messageries</h2><p class="note">Ouvertes d'un clic avec le bouton ✉ Mails. Connexion directe sur le site officiel de chaque messagerie.</p>
      <div class="mails" style="margin-top:1rem">${D.mails.map(m => `<button data-m="${m.id}" class="${cfg.mails.includes(m.id) ? 'on' : ''}">${m.ic} ${m.name}${cfg.mails.includes(m.id) ? ' ✓' : ''}</button>`).join('')}</div></div>
    <div class="card"><h2>🛡 Bouclier & vie privée</h2>
      <label class="row" style="margin-top:.8rem"><input type="checkbox" id="shT" ${cfg.shield.trackers ? 'checked' : ''}> Bloquer les traqueurs publicitaires</label>
      <label class="row" style="margin-top:.5rem"><input type="checkbox" id="shH" ${cfg.shield.https ? 'checked' : ''}> Ouvrir les sites en HTTPS automatiquement</label>
      <div class="row" style="margin-top:1rem"><button class="btn2" id="clr">🧹 Effacer cookies, cache et historique</button><button class="btn2" id="wipe">🔑 Supprimer toutes mes clés IA</button></div></div>
    <div class="card"><h2>🎭 Style de Clipia</h2><div class="row" style="margin-top:.6rem"><select id="sMode" style="background:#0b0926;border:1px solid var(--line);border-radius:10px;padding:.6rem">${Object.entries(D.modes).map(([id, m]) => `<option value="${id}" ${id === cfg.mode ? 'selected' : ''}>${m.label}</option>`).join('')}</select></div>
      <div class="field"><label>Mon style personnalisé</label><textarea id="sPerso" rows="2">${esc(cfg.customPrompt)}</textarea></div></div>
    <div class="card"><h2>À propos</h2><p class="note">Clipia Nova 1.0 — moteur Chromium · conçu par Clin Fabrice, CLENDAX (Flize, Ardennes).</p>
      <button class="btn2" id="rewz" style="margin-top:.8rem">Relancer l'assistant de configuration</button></div>
  </div></div>`;
  let sel = cfg.provider;
  const drawProv = () => providerForm($('#sProv', el), sel, false);
  el.querySelectorAll('.prov').forEach(b => b.onclick = () => { sel = cfg.provider = b.dataset.p; save(); el.querySelectorAll('.prov').forEach(x => x.classList.toggle('on', x === b)); drawProv(); updEngine(); });
  drawProv();
  el.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { const id = b.dataset.m; cfg.mails = cfg.mails.includes(id) ? cfg.mails.filter(x => x !== id) : [...cfg.mails, id]; save(); pageSettings(el); });
  const sh = async () => { cfg.shield = { trackers: $('#shT', el).checked, https: $('#shH', el).checked }; save(); await window.nova.setShield(cfg.shield); toast('Bouclier mis à jour'); };
  $('#shT', el).onchange = sh; $('#shH', el).onchange = sh;
  $('#clr', el).onclick = async () => { await window.nova.clearPrivacy(); cfg.history = []; save(); toast('✓ Données de navigation effacées'); };
  $('#wipe', el).onclick = async () => { await window.nova.wipeKeys(); KEYS = {}; toast('✓ Clés supprimées'); pageSettings(el); };
  $('#sMode', el).onchange = e => { cfg.mode = e.target.value; save(); $('#aiMode').value = cfg.mode; };
  $('#sPerso', el).onchange = e => { cfg.customPrompt = e.target.value.trim(); save(); };
  $('#rewz', el).onclick = () => { step = 0; startWizard(); };
}

/* =========================================================
   4. CLIPIA IA (panneau latéral)
   ========================================================= */
let convo = [];
function updEngine() { const p = D.providers[cfg.provider]; $('#aiEngine').textContent = p.name + ' · ' + modelOf(cfg.provider); }
function initAI() {
  $('#aiMode').innerHTML = Object.entries(D.modes).map(([id, m]) => `<option value="${id}">${m.label}</option>`).join('');
  $('#aiMode').value = cfg.mode;
  $('#aiMode').onchange = e => { cfg.mode = e.target.value; save(); };
  $('#aiVoice').textContent = cfg.voice ? '🔊' : '🔈';
  $('#aiVoice').onclick = () => { cfg.voice = !cfg.voice; save(); $('#aiVoice').textContent = cfg.voice ? '🔊' : '🔈'; if (!cfg.voice) speechSynthesis.cancel(); };
  $('#aiClear').onclick = () => { convo = []; $('#chat').innerHTML = ''; hello(); };
  $('#ask').onsubmit = e => { e.preventDefault(); const v = $('#askIn').value.trim(); if (v) { $('#askIn').value = ''; send(v); } };
  $('#askIn').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#ask').requestSubmit(); } });
  document.querySelectorAll('.quick button').forEach(b => b.onclick = () => quick(b.dataset.q));
  updEngine(); hello();
}
function hello() { bubble('a', `Bonjour${cfg.name ? ' ' + cfg.name : ''} ! Je suis Clipia. Posez-moi une question, ou utilisez les boutons ci-dessus pour que je travaille sur la page ouverte.`); }
function bubble(cls, text) { const d = document.createElement('div'); d.className = 'msg ' + cls; d.textContent = text; $('#chat').appendChild(d); $('#chat').scrollTop = 1e9; return d; }

async function pageText() {
  const t = cur();
  if (!t || !t.wv) return null;
  try { return { title: t.title, url: t.url, text: (await t.wv.executeJavaScript('document.body.innerText')).slice(0, 14000) }; } catch { return null; }
}
async function quick(q) {
  $('#ai').classList.remove('closed');
  if (q === 'clip') return send("Propose-moi 3 idées de clip musical originales pour CLENDAX, avec pour chacune : l'ambiance, 5 plans clés et une accroche TikTok.");
  if (q === 'post') {
    const pg = await pageText();
    return send(pg ? `Rédige un post réseaux sociaux accrocheur à partir de cette page.\n\nTitre : ${pg.title}\nContenu :\n${pg.text}` : 'Aide-moi à rédiger un post réseaux sociaux accrocheur. Pose-moi d\'abord 2 questions sur le sujet.');
  }
  const pg = await pageText();
  if (!pg) return bubble('t', 'Ouvrez d\'abord une page web dans l\'onglet actif.');
  const ask = { sum: 'Résume cette page en 5 points clairs, en français.', tr: 'Traduis le contenu principal de cette page en français.', exp: 'Explique simplement le contenu de cette page, comme à quelqu\'un qui découvre le sujet.' }[q];
  send(`${ask}\n\nTitre : ${pg.title}\nAdresse : ${pg.url}\nContenu :\n${pg.text}`, `${{ sum: '📝 Résumer', tr: '🌍 Traduire', exp: '💡 Expliquer' }[q]} : ${pg.title}`);
}
async function send(text, shown) {
  const p = D.providers[cfg.provider];
  bubble('u', shown || text);
  if (!p.noKey && !KEYS[cfg.provider]) {
    bubble('e', `Aucune clé ${p.name} n'est configurée. Ouvrez ⚙ Réglages → Intelligence artificielle pour l'ajouter (2 minutes).`);
    return;
  }
  convo.push({ role: 'user', content: text });
  const wait = bubble('t', 'Clipia réfléchit…');
  const mode = D.modes[cfg.mode];
  const system = (cfg.mode === 'perso' && cfg.customPrompt ? 'Tu es Clipia. ' + cfg.customPrompt : mode.prompt) + (cfg.name ? ` L'utilisateur s'appelle ${cfg.name}.` : '') + " Tu es intégrée au navigateur Clipia Nova (CLENDAX).";
  const r = await window.nova.aiChat({ provider: cfg.provider, apiKey: KEYS[cfg.provider], model: modelOf(cfg.provider), system, messages: convo.slice(-16) });
  wait.remove();
  if (r.error) { convo.pop(); bubble('e', '✕ ' + r.error); return; }
  convo.push({ role: 'assistant', content: r.text });
  bubble('a', r.text);
  if (cfg.voice) { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(r.text.replace(/[*#_`]/g, '').slice(0, 1500)); u.lang = 'fr-FR'; speechSynthesis.speak(u); }
}
