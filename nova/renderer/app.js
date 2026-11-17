/* =========================================================
   Clipia Nova 2 — le navigateur compagnon
   ========================================================= */
const D = window.NOVA_DATA;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- Configuration (clés à part, chiffrées par le système) ---------- */
const DEF = { onboarded: false, name: '', provider: 'gemini', models: {}, mode: 'ami', customPrompt: '', engine: 'google',
  mails: [], installed: ['communaute', 'clipia', 'gmail', 'youtube', 'claude', 'whatsapp', 'maps'], history: [], favorites: [], devApps: [],
  voice: true, voiceName: '', voiceRate: 1.02, sttEngine: 'groq', memory: [], ollamaHost: '',
  tabSleep: true, sleepMin: 10,
  shield: { trackers: true, https: true } };
let cfg = load();
let KEYS = {};
let DEMO = false;
function load() { try { return { ...DEF, ...JSON.parse(localStorage.getItem('nova.cfg') || '{}') }; } catch { return { ...DEF }; } }
function save() { try { localStorage.setItem('nova.cfg', JSON.stringify(cfg)); } catch {} }
const modelOf = (p) => cfg.models[p] || D.providers[p].model;
const hasKey = (p) => DEMO || !!KEYS[p] || !!D.providers[p].noKey;
function toast(t, action) {
  const el = $('#toast'); el.innerHTML = esc(t) + (action ? ` <button class="toast-act">${esc(action.label)}</button>` : '');
  if (action) $('.toast-act', el).onclick = action.run;
  el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), action ? 6000 : 2600);
}

/* ---------- Voix ---------- */
Voice.getCfg = () => cfg;
Voice.getKeys = () => KEYS;
Voice.onError = (m) => { toast(m); cpState(m); setOrb('idle'); };
Voice.onHeard = (t) => cpLine('hors', t);
Voice.onCommand = (t) => ask(t, { speak: true, fromVoice: true });
Voice.onState = (s) => {
  const map = { listening: ['listening', cfg.name ? `Je vous écoute, ${cfg.name}…` : 'Je vous écoute…'], 'listening-voice': ['listening', 'Je vous entends…'], transcribing: ['thinking', 'Je comprends…'], speaking: ['speaking', 'Clipia parle… (Échap pour couper)'], idle: ['idle', 'Touchez 🎤 ou dites « Clipia » en mains libres'] };
  const [o, txt] = map[s] || map.idle;
  setOrb(o); cpState(txt);
  $('#cpMic').classList.toggle('on', s === 'listening' || s === 'listening-voice');
  $('#askMic').classList.toggle('on', s === 'listening' || s === 'listening-voice');
};
function setOrb(s) { Orb.setAll(s); }

/* =========================================================
   1. DÉMARRAGE
   ========================================================= */
if (/demo=1/.test(location.search)) document.documentElement.classList.add('demo-lite');
(async function boot() {
  const o = new Orb($('#splashOrb'), { points: 1500, full: true, scale: 0.2, cy: 0.4 });
  o.vy = 0.03;
  try { DEMO = await window.nova.isDemo(); } catch {}
  try { KEYS = await window.nova.getKeys(); } catch { KEYS = {}; }
  if (DEMO) { localStorage.removeItem('nova.cfg'); cfg = load(); }
  try { await window.nova.setShield(cfg.shield); } catch {}
  setTimeout(() => o.setState('speaking'), 1200);
  setTimeout(() => {
    $('#splash').classList.add('out');
    setTimeout(() => { o.destroy(); $('#splash').remove(); }, 900);
    cfg.onboarded ? startBrowser() : startWizard();
  }, 3000);
})();

/* =========================================================
   2. ASSISTANT DE CONFIGURATION
   ========================================================= */
let step = 0, wzOrb = null;
const STEPS = [stepWelcome, stepShield, stepAI, stepVoice, stepMail, stepStyle, stepDone];

function startWizard() {
  $('#wizard').classList.remove('hidden');
  if (!wzOrb) { wzOrb = new Orb($('#wzOrb'), { points: 600, interactive: true, scale: 0.42 }); wzOrb.onClick = () => Voice.speak(wzSay()); }
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
function wzSay() { const s = $('#wzBody .say'); return s ? s.textContent : ''; }
function renderStep() {
  $$('#wzDots i').forEach((d, i) => d.classList.toggle('on', i <= step));
  $('#wzBack').style.visibility = step ? 'visible' : 'hidden';
  $('#wzNext').textContent = step === STEPS.length - 1 ? 'Ouvrir Clipia Nova ✦' : 'Continuer →';
  STEPS[step]();
  $('#wizard').scrollTop = 0;
}

function stepWelcome() {
  $('#wzBody').innerHTML = `
    <h2>Bonjour, je suis <span class="grad">Clipia</span></h2>
    <p class="lead">Votre compagnon, dans votre navigateur. Je vous parle, je vous écoute, et je protège votre vie privée.</p>
    <div class="say">Je vais vous guider pendant 2 minutes : votre sécurité, votre intelligence artificielle, ma voix et vos messageries. Touchez la sphère pour m'entendre.</div>
    <div class="field"><label>Comment voulez-vous que je vous appelle ?</label><input id="wName" placeholder="Votre prénom" value="${esc(cfg.name)}"></div>`;
  $('#wName').focus();
  stepWelcome.leave = () => { cfg.name = $('#wName').value.trim(); save(); return true; };
}

function stepShield() {
  $('#wzBody').innerHTML = `
    <h2>🛡 Votre bouclier est actif</h2>
    <p class="lead">${cfg.name ? esc(cfg.name) + ', v' : 'V'}oici ce que Clipia Nova fait pour vous, en permanence.</p>
    <div class="say">Ici, vos données restent entre vos mains. Pas d'extensions venues de partout, pas de collecte, pas de compte obligatoire.</div>
    <div class="shield-list">
      <div>🚫<p><b>Traqueurs bloqués</b><span>Les mouchards qui suivent votre navigation de site en site sont stoppés.</span></p></div>
      <div>🔒<p><b>HTTPS automatique</b><span>Les sites s'ouvrent en version chiffrée dès que possible.</span></p></div>
      <div>🧅<p><b>Mode Tor intégré</b><span>Les adresses .onion s'ouvrent dans un onglet isolé qui passe par le réseau Tor.</span></p></div>
      <div>🔑<p><b>Clés chiffrées sur votre machine</b><span>Protégées par le coffre-fort du système, envoyées seulement à l'IA que vous choisissez.</span></p></div>
      <div>🧩<p><b>Aucun plugin tiers</b><span>Tout est intégré : rien d'installé dans votre dos.</span></p></div>
      <div>🙈<p><b>Zéro collecte</b><span>Ni historique, ni e-mails, ni mots de passe envoyés à CLENDAX ou à qui que ce soit.</span></p></div>
    </div>`;
  stepShield.leave = () => true;
}

let wzProv = null;
function stepAI() {
  wzProv = wzProv || cfg.provider;
  $('#wzBody').innerHTML = `
    <h2>✦ Choisissez mon intelligence</h2>
    <div class="say">Un abonnement grand public (ChatGPT Plus, Claude Pro, Gemini Advanced…) ne donne pas de clé : créez une clé API sur la console du fournisseur. C'est gratuit à créer, l'usage coûte souvent quelques centimes. Les moteurs « Gratuit » ont une offre sans frais.</div>
    <div class="grid-prov">${provButtons(wzProv)}</div>
    <div id="provBox"></div>`;
  $$('#wzBody .prov').forEach(b => b.onclick = () => { wzProv = b.dataset.p; stepAI(); });
  providerForm($('#provBox'), wzProv, true);
  stepAI.leave = () => { cfg.provider = wzProv; save(); if (!hasKey(wzProv)) toast('Vous pourrez ajouter la clé plus tard dans ⚙ Réglages'); return true; };
}
function provButtons(sel) {
  return Object.entries(D.providers).map(([id, p]) => `<button class="prov ${id === sel ? 'on' : ''}" data-p="${id}"><b>${p.name}</b><small>${p.by}</small>${p.free ? '<br><small class="free">Gratuit possible</small>' : ''}${KEYS[id] || (p.noKey && id === sel) ? '<br><span class="ok">● prêt</span>' : ''}</button>`).join('');
}

function providerForm(box, id, guide) {
  const p = D.providers[id];
  box.innerHTML = `
    ${guide ? `<div class="say" style="margin-top:1.2rem">${p.noKey
      ? `Ollama fait tourner l'IA <b>sur votre ordinateur</b>, sans clé ni internet. 1) Installez Ollama. 2) Dans un terminal : <code>ollama pull ${p.model}</code>. 3) Cliquez sur « Tester ».`
      : `1) Cliquez sur « Obtenir ma clé ${p.name} ». 2) Créez une clé. 3) Collez-la ci-dessous. 4) Cliquez sur « Tester ».`}</div>` : ''}
    <div class="row" style="margin-top:.8rem"><button class="btn2" id="getKey">🔗 ${p.noKey ? 'Télécharger Ollama' : 'Obtenir ma clé ' + p.name}</button></div>
    ${p.noKey ? `<div class="field"><label>Adresse d'Ollama (laisser vide sur ce PC)</label><input id="hIn" placeholder="http://localhost:11434" value="${esc(cfg.ollamaHost)}"></div>`
      : `<div class="field"><label>Clé API ${p.name}</label><input id="kIn" type="password" placeholder="Collez votre clé ici" value="${esc(KEYS[id] || '')}" autocomplete="off"></div>`}
    <div class="field"><label>Modèle</label><div class="row"><input id="mIn" list="mList" value="${esc(modelOf(id))}" style="flex:1"><datalist id="mList"></datalist><button class="btn2" id="loadM">⟳ Mes modèles</button></div></div>
    <div class="row" style="margin-top:1rem"><button class="primary" id="testP">Tester ${p.name}</button></div>
    <div class="status" id="pStatus"></div>`;
  $('#getKey', box).onclick = () => window.nova.openExternal(p.keyUrl);
  const persist = async () => {
    const k = $('#kIn', box); if (k) KEYS[id] = k.value.trim();
    const h = $('#hIn', box); if (h) cfg.ollamaHost = h.value.trim();
    cfg.models[id] = $('#mIn', box).value.trim() || p.model; save();
    return window.nova.setKeys(KEYS);
  };
  $('#loadM', box).onclick = async () => {
    await persist(); const st = $('#pStatus', box); st.className = 'status'; st.textContent = 'Recherche des modèles disponibles…';
    const r = await window.nova.aiModels({ provider: id, apiKey: KEYS[id], host: cfg.ollamaHost });
    if (r.error) { st.className = 'status bad'; st.textContent = '✕ ' + r.error; return; }
    $('#mList', box).innerHTML = r.models.map(m => `<option value="${esc(m)}">`).join('');
    st.className = 'status good'; st.textContent = `✓ ${r.models.length} modèles disponibles avec votre compte. Cliquez dans le champ Modèle pour choisir.`;
  };
  $('#testP', box).onclick = async () => {
    const r0 = await persist(); const st = $('#pStatus', box); st.className = 'status'; st.textContent = 'Test en cours…'; setOrb('thinking');
    const r = await window.nova.aiChat({ provider: id, apiKey: KEYS[id], model: modelOf(id), host: cfg.ollamaHost, system: 'Réponds en une phrase courte, en français.', messages: [{ role: 'user', content: 'Dis bonjour et présente-toi en tant que Clipia.' }] });
    setOrb('idle');
    if (r.error) { st.className = 'status bad'; st.textContent = '✕ ' + r.error; return; }
    st.className = 'status good';
    st.textContent = '✓ ' + p.name + ' répond : « ' + r.text.trim().slice(0, 180) + ' »' + (r0 && r0.encrypted === false ? '\n⚠ Coffre-fort système indisponible : clé stockée localement sans chiffrement.' : '');
    const b = document.querySelector(`.prov[data-p="${id}"]`); if (b && !b.querySelector('.ok')) b.insertAdjacentHTML('beforeend', '<br><span class="ok">● prêt</span>');
    if (cfg.voice) Voice.speak(r.text);
  };
}

function voiceForm(box, guide) {
  const voices = Voice.voices();
  box.innerHTML = `
    ${guide ? `<div class="say">Pour que je vous comprenne à l'oral, j'utilise la transcription Whisper. La clé <b>Groq est gratuite</b> : cliquez sur « Obtenir ma clé », créez-la, collez-la ici. Pour vous répondre, j'utilise les voix déjà installées sur votre ordinateur.</div>` : ''}
    <div class="grid-prov">${Object.entries(D.stt).map(([id, s]) => `<button class="prov ${cfg.sttEngine === id ? 'on' : ''}" data-stt="${id}"><b>${s.name}</b>${KEYS[id] ? '<br><span class="ok">● clé présente</span>' : ''}</button>`).join('')}</div>
    <div class="row" style="margin-top:.8rem"><button class="btn2" id="sttKeyBtn">🔗 Obtenir ma clé ${cfg.sttEngine === 'groq' ? 'Groq' : 'OpenAI'}</button></div>
    <div class="field"><label>Clé ${cfg.sttEngine === 'groq' ? 'Groq' : 'OpenAI'} (voix)</label><input id="sttKey" type="password" value="${esc(KEYS[cfg.sttEngine] || '')}" placeholder="Collez votre clé ici" autocomplete="off"></div>
    <div class="field"><label>Ma voix</label><div class="row"><select id="vName" style="flex:1">${voices.length ? voices.map(v => `<option ${v.name === cfg.voiceName ? 'selected' : ''}>${esc(v.name)}</option>`).join('') : '<option value="">Voix française du système</option>'}</select>
      <input id="vRate" type="range" min="0.8" max="1.3" step="0.02" value="${cfg.voiceRate}" title="Vitesse"></div></div>
    <label class="row" style="margin-top:.8rem"><input type="checkbox" id="vOn" ${cfg.voice ? 'checked' : ''}> Clipia répond à voix haute</label>
    <div class="row" style="margin-top:1rem"><button class="primary" id="vTest">🔊 Écouter Clipia</button><button class="btn2" id="mTest">🎤 Tester le micro</button></div>
    <div class="status" id="vStatus"></div>`;
  const persist = () => { KEYS[cfg.sttEngine] = $('#sttKey', box).value.trim() || KEYS[cfg.sttEngine]; cfg.voiceName = $('#vName', box).value; cfg.voiceRate = +$('#vRate', box).value; cfg.voice = $('#vOn', box).checked; save(); window.nova.setKeys(KEYS); };
  $$('[data-stt]', box).forEach(b => b.onclick = () => { persist(); cfg.sttEngine = b.dataset.stt; save(); voiceForm(box, guide); });
  $('#sttKeyBtn', box).onclick = () => window.nova.openExternal(D.stt[cfg.sttEngine].keyUrl);
  ['#vName', '#vRate', '#vOn', '#sttKey'].forEach(s => $(s, box).onchange = persist);
  $('#vTest', box).onclick = () => { persist(); Voice.speak(`Bonjour${cfg.name ? ' ' + cfg.name : ''} ! Voici ma voix. Je suis prête à discuter avec vous.`); };
  $('#mTest', box).onclick = async () => {
    persist(); const st = $('#vStatus', box); st.className = 'status'; st.textContent = 'Parlez maintenant…';
    const prev = Voice.onCommand; Voice.onCommand = (t) => { st.className = 'status good'; st.textContent = '✓ J\'ai entendu : « ' + t + ' »'; Voice.onCommand = prev; Voice.onState('idle'); };
    const prevErr = Voice.onError; Voice.onError = (m) => { st.className = 'status bad'; st.textContent = '✕ ' + m; Voice.onError = prevErr; };
    await Voice.listenOnce(); Voice.onCommand = prev; Voice.onError = prevErr;
  };
  return persist;
}
function stepVoice() {
  $('#wzBody').innerHTML = `<h2>🎙 Ma voix et mon écoute</h2><p class="lead">Parlez-moi, je vous réponds à voix haute, sur toutes vos machines.</p><div id="vBox"></div>`;
  const persist = voiceForm($('#vBox'), true);
  stepVoice.leave = () => { persist(); return true; };
}

function stepMail() {
  $('#wzBody').innerHTML = `
    <h2>✉ Vos messageries</h2>
    <div class="say">Sélectionnez vos boîtes mail : elles s'ouvrent sur leur site officiel et vous restez connecté. Clipia Nova ne voit jamais votre mot de passe et ne copie pas vos e-mails.</div>
    <div class="mails">${D.mails.map(m => `<button data-m="${m.id}" class="${cfg.mails.includes(m.id) ? 'on' : ''}">${m.ic} ${m.name}${cfg.mails.includes(m.id) ? '<br><small style="color:var(--ok)">✓ ajoutée</small>' : ''}</button>`).join('')}</div>`;
  $$('#wzBody [data-m]').forEach(b => b.onclick = () => { toggleMail(b.dataset.m); stepMail(); });
  stepMail.leave = () => true;
}
function toggleMail(id) { cfg.mails = cfg.mails.includes(id) ? cfg.mails.filter(x => x !== id) : [...cfg.mails, id]; save(); }

function stepStyle() {
  $('#wzBody').innerHTML = `
    <h2>Comment veux-tu que nous discutions ?</h2>
    <p class="lead">Choisissez ma personnalité. Vous pourrez en changer à tout moment.</p>
    <div class="modes">${Object.entries(D.modes).map(([id, m]) => `<button class="prov ${cfg.mode === id ? 'on' : ''}" data-mode="${id}"><b>${m.label}</b></button>`).join('')}</div>
    <div class="field ${cfg.mode === 'perso' ? '' : 'hidden'}"><label>Décrivez votre style (ex. : « Parle-moi comme un coach, avec humour »)</label><textarea id="persoIn" rows="3">${esc(cfg.customPrompt)}</textarea></div>`;
  $$('#wzBody [data-mode]').forEach(b => b.onclick = () => { cfg.mode = b.dataset.mode; save(); stepStyle(); });
  stepStyle.leave = () => { const t = $('#persoIn'); if (t) cfg.customPrompt = t.value.trim(); save(); return true; };
}

function stepDone() {
  const p = D.providers[cfg.provider];
  $('#wzBody').innerHTML = `
    <h2>Tout est prêt${cfg.name ? ', ' + esc(cfg.name) : ''} ✦</h2>
    <div class="say">À tout moment, appuyez sur Ctrl + Espace pour me parler. En mode mains libres, dites simplement « Clipia » suivi de votre demande.</div>
    <div class="shield-list">
      <div>✦<p><b>Intelligence : ${p.name}</b><span>${hasKey(cfg.provider) ? 'Configurée' : 'Clé à ajouter dans ⚙ Réglages'} · modèle ${esc(modelOf(cfg.provider))}</span></p></div>
      <div>🎙<p><b>Voix</b><span>${Voice.engine() || DEMO ? 'Écoute et parole prêtes' : 'Parole prête · écoute : ajoutez une clé Groq gratuite'}</span></p></div>
      <div>✉<p><b>Messageries</b><span>${cfg.mails.length ? cfg.mails.map(id => D.mails.find(m => m.id === id).name).join(', ') : 'Aucune pour le moment'}</span></p></div>
      <div>🎭<p><b>Style</b><span>${D.modes[cfg.mode].label}</span></p></div>
    </div>
    <p class="note">F1 affiche tous les raccourcis clavier.</p>`;
  stepDone.leave = () => true;
}

/* =========================================================
   3. NAVIGATEUR
   ========================================================= */
let tabs = [], active = null, uid = 0, blocked = 0, closed = [], started = false;
let miniOrb, panelOrb, bigOrb;

function startBrowser() {
  $('#browser').classList.remove('hidden');
  if (started) { updEngine(); $('#aiMode').value = cfg.mode; tabs.filter(t => !isWeb(t)).forEach(renderInternal); return; }
  started = true;
  miniOrb = new Orb($('#miniOrb'), { points: 160, scale: 0.42 });
  panelOrb = new Orb($('#panelOrb'), { points: 160, scale: 0.42 });
  newTab('home');
  $('#orbMini').onclick = () => toggleCompanion(true);
  $('#newTab').onclick = () => newTab('home');
  $('#newTor').onclick = () => newTab('tor');
  $('#back').onclick = () => { const t = cur(); if (t?.wv?.canGoBack()) t.wv.goBack(); };
  $('#fwd').onclick = () => { const t = cur(); if (t?.wv?.canGoForward()) t.wv.goForward(); };
  $('#reload').onclick = () => { const t = cur(); if (t?.wv) t.wv.reload(); else renderInternal(t); };
  $('#home').onclick = () => navigate('nova://accueil');
  $('#fav').onclick = toggleFav;
  $('#btnStore').onclick = () => openInternal('store');
  $('#btnMail').onclick = openMails;
  $('#btnSettings').onclick = () => openInternal('settings');
  $('#btnKeys').onclick = () => toggleKeys();
  $('#btnAI').onclick = () => $('#ai').classList.toggle('closed');
  $('#aiClose').onclick = () => $('#ai').classList.add('closed');
  $('#url').addEventListener('keydown', e => { if (e.key === 'Enter') { navigate($('#url').value); $('#url').blur(); } });
  $('#url').addEventListener('focus', () => $('#url').select());
  window.nova.onOpenTab(({ url, tor }) => newTab(tor ? 'tor' : 'web', url));
  window.nova.onBlocked(n => { blocked = n; $('#lock').title = n + ' traqueur(s) bloqué(s)'; const b = $('#blockedN'); if (b) b.textContent = n; });
  window.nova.onDownload(d => d.state === 'completed' ? toast('⬇ ' + d.name + ' téléchargé', { label: 'Afficher', run: () => window.nova.showFile(d.path) }) : toast('Téléchargement interrompu : ' + d.name));
  window.nova.onTor(torUpdate);
  window.nova.onKey(k => handleKey(k));
  document.addEventListener('keydown', e => { if (handleKey({ key: e.key, code: e.code, ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey, alt: e.altKey })) e.preventDefault(); });
  initFind(); initAI(); initCompanion(); renderKeys(); initSocial(); initTools();
  setInterval(sleepTabs, 60000);
}
const cur = () => tabs.find(t => t.id === active);
const isWeb = (t) => t.kind === 'web' || t.kind === 'tor';

function newTab(kind, url) {
  const t = { id: ++uid, kind, url: url || '', title: kind === 'tor' ? 'Onglet Tor' : 'Nouvel onglet', zoom: 0 };
  tabs.push(t);
  if (kind === 'web') makeWebview(t, url);
  else if (kind === 'tor') { if (url) torOpen(t, url); else { t.el = el('div', 'view'); $('#views').appendChild(t.el); pageTor(t); } }
  else { t.el = el('div', 'view'); $('#views').appendChild(t.el); renderInternal(t); }
  activate(t.id);
  return t;
}
function el(tag, cls) { const e = document.createElement(tag); e.className = cls; return e; }
function makeWebview(t, url, tor) {
  if (t.el) t.el.remove();
  const wv = document.createElement('webview');
  wv.className = 'view' + (tor ? ' torview' : '');
  wv.setAttribute('partition', tor ? 'tor-nova' : 'persist:nova');
  wv.setAttribute('allowpopups', '');
  wv.src = url;
  t.wv = wv; t.el = wv; t.kind = tor ? 'tor' : 'web'; t.url = url;
  wv.addEventListener('page-title-updated', e => { t.title = e.title; drawTabs(); });
  const upd = e => { t.url = e.url; if (t.id === active) { $('#url').value = e.url; lockIcon(t); favIcon(t); } if (!tor) addHistory(t.url, t.title); };
  wv.addEventListener('did-navigate', upd);
  wv.addEventListener('did-navigate-in-page', e => { if (e.isMainFrame) upd(e); });
  wv.addEventListener('did-fail-load', e => { if (e.errorCode !== -3 && e.isMainFrame) toast((tor ? 'Tor : ' : '') + 'Impossible de charger la page (' + e.errorDescription + ')'); });
  wv.addEventListener('found-in-page', e => { const r = e.result; if (r.finalUpdate) $('#findCount').textContent = r.matches ? `${r.activeMatchOrdinal}/${r.matches}` : '0'; });
  wv.addEventListener('dom-ready', () => { if (t.zoom) wv.setZoomLevel(t.zoom); });
  $('#views').appendChild(wv);
  if (t.id === active) wv.classList.add('on');
}
function activate(id) {
  active = id;
  { const t0 = tabs.find(t => t.id === id); if (t0) { t0.last = Date.now(); if (t0.sleeping) wake(t0); } }
  tabs.forEach(t => t.el && t.el.classList.toggle('on', t.id === id));
  const t = cur();
  $('#url').value = isWeb(t) ? t.url : (t.kind === 'tor' ? '' : 'nova://' + ({ home: 'accueil', store: 'store', settings: 'reglages', history: 'historique', repair: 'depannage' }[t.kind] || ''));
  $('#url').placeholder = t.kind === 'tor' ? '🧅 Adresse .onion ou recherche via Tor…' : 'Rechercher, saisir une adresse ou un .onion…';
  document.body.classList.toggle('in-tor', t.kind === 'tor');
  $('#torBar').classList.toggle('hidden', t.kind !== 'tor' || torState.state === 'ready');
  lockIcon(t); favIcon(t); zoomInfo(t);
  drawTabs();
}
function lockIcon(t) { $('#lock').textContent = t.kind === 'tor' ? '🧅' : isWeb(t) ? (t.url.startsWith('https') ? '🔒' : '⚠') : '✦'; }
function closeTab(id) {
  const i = tabs.findIndex(t => t.id === id); if (i < 0) return;
  const t = tabs[i];
  if (t.kind === 'web' && t.url) closed.push(t.url);
  t.el.remove(); tabs.splice(i, 1);
  if (!tabs.length) return newTab('home');
  if (active === id) activate(tabs[Math.max(0, i - 1)].id); else drawTabs();
}
function drawTabs() {
  $('#tabs').innerHTML = tabs.map((t, i) => `<div class="tab ${t.id === active ? 'on' : ''} ${t.kind === 'tor' ? 'tor' : ''}" data-id="${t.id}" title="${esc(t.title)} — Ctrl+${i + 1}"><span>${t.kind === 'tor' ? '🧅 ' : ''}${esc(t.kind === 'store' ? '🛍 Store' : t.kind === 'settings' ? '⚙ Réglages' : t.kind === 'history' ? '🕘 Historique' : t.kind === 'repair' ? '🛠 Dépannage' : t.title)}</span><b class="x" data-x="${t.id}">✕</b></div>`).join('');
  $$('#tabs .tab').forEach(e => {
    e.onclick = ev => { if (ev.target.dataset.x) closeTab(+ev.target.dataset.x); else activate(+e.dataset.id); };
    e.onauxclick = ev => { if (ev.button === 1) closeTab(+e.dataset.id); };
  });
}
function navigate(input) {
  const s = (input || '').trim(); if (!s) return;
  const t = cur();
  if (/^nova:\/\//.test(s)) return toInternal(t, s.includes('store') ? 'store' : s.includes('reglages') ? 'settings' : s.includes('historique') ? 'history' : s.includes('depannage') ? 'repair' : 'home');
  let url;
  if (/^https?:\/\//i.test(s)) url = s;
  else if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?$/.test(s) && !s.includes(' ')) url = (/\.onion(\/|:|$)/.test(s) ? 'http://' : 'https://') + s;
  else url = t.kind === 'tor' ? 'https://duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion/?q=' + encodeURIComponent(s) : D.engines[cfg.engine].url + encodeURIComponent(s);
  let onion = false; try { onion = new URL(url).hostname.endsWith('.onion'); } catch {}
  if (t.kind === 'tor') return torOpen(t, url);
  if (onion) { toast('🧅 Adresse .onion : ouverture dans un onglet Tor'); return newTab('tor', url); }
  if (t.kind === 'web') t.wv.loadURL(url); else { makeWebview(t, url); activate(t.id); }
}
function toInternal(t, kind) {
  if (t.wv) { t.wv.remove(); t.wv = null; t.el = el('div', 'view'); $('#views').appendChild(t.el); }
  t.kind = kind; t.title = 'Nouvel onglet'; renderInternal(t); activate(t.id);
}
function openInternal(kind) { const ex = tabs.find(t => t.kind === kind); ex ? activate(ex.id) : newTab(kind); }
function openMails() {
  if (!cfg.mails.length) { openInternal('settings'); toast('Choisissez vos messageries dans la section ✉'); return; }
  cfg.mails.forEach(id => newTab('web', D.mails.find(m => m.id === id).url));
}
function addHistory(url, title) {
  if (!url || url.startsWith('about:')) return;
  cfg.history = [{ url, title: title || url, at: Date.now() }, ...cfg.history.filter(h => h.url !== url)].slice(0, 200); save();
}
function favIcon(t) { const on = isWeb(t) && cfg.favorites.some(f => f.url === t.url); $('#fav').textContent = on ? '★' : '☆'; $('#fav').classList.toggle('on', on); }
function toggleFav() {
  const t = cur(); if (!t || t.kind !== 'web') return toast('Ouvrez une page pour l\'ajouter aux favoris');
  const i = cfg.favorites.findIndex(f => f.url === t.url);
  if (i >= 0) { cfg.favorites.splice(i, 1); toast('Favori retiré'); } else { cfg.favorites.unshift({ url: t.url, title: t.title }); toast('★ Ajouté aux favoris'); }
  save(); favIcon(t);
}

/* ---------- Tor ---------- */
let torState = { state: 'off', progress: 0 };
function torUpdate(s) {
  torState = s;
  $('#torTxt').textContent = s.state === 'starting' ? `🧅 Connexion au réseau Tor… ${s.progress}%` : s.state === 'error' ? '🧅 ' + s.error : s.state === 'ready' ? '🧅 Connecté à Tor' : '';
  $('#torProg').style.width = (s.progress || 0) + '%';
  const t = cur();
  $('#torBar').classList.toggle('hidden', !t || t.kind !== 'tor' || s.state === 'ready');
  $('#torBar').classList.toggle('err', s.state === 'error');
  tabs.filter(x => x.kind === 'tor' && !x.wv).forEach(pageTor);
}
async function torOpen(t, url) {
  if (torState.state !== 'ready') {
    if (!t.el) { t.el = el('div', 'view'); $('#views').appendChild(t.el); }
    t.pending = url; pageTor(t); activate(t.id);
    const s = await window.nova.torStart(); torUpdate(s);
    if (s.state !== 'ready') return;
  }
  const u = t.pending || url; t.pending = null;
  if (t.wv) t.wv.loadURL(u); else { makeWebview(t, u, true); activate(t.id); }
}
function pageTor(t) {
  if (t.wv) return;
  const s = torState;
  t.el.innerHTML = `<div class="page tor-page"><div class="tor-hero"><div class="onion">🧅</div><h1>Onglet <span class="grad">Tor</span></h1>
    <p>Cet onglet passe par le réseau Tor : les sites ne voient pas votre adresse IP, et les adresses <b>.onion</b> sont accessibles. Rien n'est enregistré sur votre disque : tout disparaît à la fermeture.</p>
    <div class="tor-status ${s.state}">${s.state === 'ready' ? '✓ Connecté au réseau Tor (' + esc(s.source || '') + ')' : s.state === 'starting' ? `Connexion au réseau Tor… ${s.progress}%` : s.state === 'error' ? '✕ ' + esc(s.error) : 'Tor n\'est pas encore démarré'}</div>
    <form class="search" id="torSearch"><input placeholder="Adresse .onion ou recherche (DuckDuckGo via Tor)"><button class="primary">Ouvrir</button></form>
    <div class="row" style="justify-content:center;margin-top:1rem">${s.state !== 'ready' ? '<button class="btn2" id="torGo">🧅 Se connecter à Tor</button>' : '<button class="btn2" id="torOff">Arrêter Tor</button>'}</div>
    <div class="tor-warn">⚠ Clipia Nova fait passer cet onglet par Tor, bloque WebRTC, la caméra, le micro et la position. Pour un anonymat maximal face à un adversaire puissant, utilisez aussi le Tor Browser officiel, qui masque l'empreinte du navigateur. N'ouvrez pas de fichiers téléchargés via Tor en étant connecté, et ne vous identifiez pas avec vos comptes habituels.</div>
  </div></div>`;
  $('#torSearch', t.el).onsubmit = e => { e.preventDefault(); const v = $('#torSearch input', t.el).value.trim(); if (v) { activate(t.id); navigate(v); } };
  const go = $('#torGo', t.el); if (go) go.onclick = async () => torUpdate(await window.nova.torStart());
  const off = $('#torOff', t.el); if (off) off.onclick = async () => { torUpdate(await window.nova.torStop()); tabs.filter(x => x.kind === 'tor').forEach(x => x.wv && closeTab(x.id)); };
  if (t.pending && s.state === 'starting') $('#torSearch input', t.el).value = t.pending;
}

/* ---------- Recherche dans la page, zoom ---------- */
function initFind() {
  const go = (fwd) => { const t = cur(), v = $('#findIn').value; if (t?.wv && v) t.wv.findInPage(v, { forward: fwd, findNext: true }); };
  $('#findIn').addEventListener('input', () => { const t = cur(), v = $('#findIn').value; if (t?.wv) v ? t.wv.findInPage(v) : t.wv.stopFindInPage('clearSelection'); });
  $('#findIn').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(!e.shiftKey); } if (e.key === 'Escape') closeFind(); });
  $('#findNext').onclick = () => go(true); $('#findPrev').onclick = () => go(false); $('#findClose').onclick = closeFind;
}
function openFind() { if (!cur()?.wv) return; $('#findBar').classList.remove('hidden'); $('#findIn').focus(); $('#findIn').select(); }
function closeFind() { $('#findBar').classList.add('hidden'); const t = cur(); if (t?.wv) t.wv.stopFindInPage('clearSelection'); }
function zoom(d) { const t = cur(); if (!t?.wv) return; t.zoom = d === 0 ? 0 : Math.max(-4, Math.min(5, t.zoom + d)); t.wv.setZoomLevel(t.zoom); zoomInfo(t); }
function zoomInfo(t) { const z = $('#zoomInfo'); if (!t?.zoom) return z.classList.add('hidden'); z.classList.remove('hidden'); z.textContent = Math.round(Math.pow(1.2, t.zoom) * 100) + ' %'; }

/* ---------- Raccourcis clavier ---------- */
function handleKey({ key, ctrl, shift, alt }) {
  const k = (key || '').toLowerCase();
  if (k === 'escape') {
    if (!$('#keys').classList.contains('hidden')) { toggleKeys(false); return true; }
    if (Voice.speaking) { Voice.stop(); Voice.onState(Voice.handsFree ? 'listening' : 'idle'); return true; }
    if (!$('#companion').classList.contains('hidden')) { toggleCompanion(false); return true; }
    if (!$('#findBar').classList.contains('hidden')) { closeFind(); return true; }
    return false;
  }
  if (k === 'f1') { toggleKeys(); return true; }
  if (k === 'f5') { $('#reload').click(); return true; }
  if (k === 'f11') { window.nova.toggleFullscreen(); return true; }
  if (k === 'browserback' || (alt && k === 'arrowleft')) { $('#back').click(); return true; }
  if (k === 'browserforward' || (alt && k === 'arrowright')) { $('#fwd').click(); return true; }
  if (alt && k === 'home') { navigate('nova://accueil'); return true; }
  if (alt && k === 'r') { openReader(); return true; }
  if (!ctrl) return false;
  if (k === ' ' || k === 'spacebar') { toggleCompanion(); return true; }
  if (k === 'tab') { const i = tabs.findIndex(t => t.id === active); activate(tabs[(i + (shift ? -1 : 1) + tabs.length) % tabs.length].id); return true; }
  if (/^[1-9]$/.test(k)) { const t = k === '9' ? tabs[tabs.length - 1] : tabs[+k - 1]; if (t) activate(t.id); return true; }
  if (shift) {
    if (k === 'n') { newTab('tor'); return true; }
    if (k === 'e') { toggleShare(); return true; }
    if (k === 'd') { openInternal('repair'); return true; }
    if (k === 'x') { screenshot(); return true; }
    if (k === 'p') { pip(); return true; }
    if (k === 't') { const u = closed.pop(); if (u) newTab('web', u); return true; }
    if (k === 's') { openInternal('store'); return true; }
    if (k === 'm') { openMails(); return true; }
    if (k === 'h') { toggleCompanion(true); setHands(!Voice.handsFree); return true; }
    if (k === 'v') { cfg.voice = !cfg.voice; save(); $('#aiVoice').textContent = cfg.voice ? '🔊' : '🔈'; toast(cfg.voice ? '🔊 Clipia parle' : '🔈 Clipia se tait'); if (!cfg.voice) Voice.stop(); return true; }
    return false;
  }
  switch (k) {
    case 't': newTab('home'); return true;
    case 'b': toggleSocial(); return true;
    case 'w': closeTab(active); return true;
    case 'l': $('#url').focus(); return true;
    case 'j': $('#ai').classList.toggle('closed'); return true;
    case 'r': $('#reload').click(); return true;
    case 'd': toggleFav(); return true;
    case 'h': openInternal('history'); return true;
    case 'f': openFind(); return true;
    case 'p': { const t = cur(); if (t?.wv) t.wv.print(); return true; }
    case ',': openInternal('settings'); return true;
    case '/': toggleKeys(); return true;
    case 'm': toggleCompanion(true); Voice.listenOnce(); return true;
    case 'k': toggleCompanion(true); setTimeout(() => $('#cpIn').focus(), 50); return true;
    case '=': case '+': zoom(1); return true;
    case '-': zoom(-1); return true;
    case '0': zoom(0); return true;
  }
  return false;
}
function renderKeys() {
  $('#keysList').innerHTML = D.shortcuts.map(([g, list]) => `<div class="kgroup"><h3>${g}</h3>${list.map(([k, d]) => `<div class="krow"><span>${d}</span><kbd>${k}</kbd></div>`).join('')}</div>`).join('');
  $('#keys').onclick = e => { if (e.target.id === 'keys') toggleKeys(false); };
}
function toggleKeys(force) { const k = $('#keys'); const show = force ?? k.classList.contains('hidden'); k.classList.toggle('hidden', !show); }

/* ---------- Pages internes ---------- */
function renderInternal(t) {
  ({ home: pageHome, store: pageStore, settings: pageSettings, history: pageHistory, tor: pageTor, repair: pageRepair })[t.kind]?.(t.kind === 'tor' ? t : t.el);
}

function pageHome(el) {
  const apps = cfg.installed.map(id => D.store.find(a => a.id === id) || cfg.devApps.find(a => a.id === id)).filter(Boolean);
  const h = new Date().getHours();
  const hello = (h < 6 ? 'Bonne nuit' : h < 18 ? 'Bonjour' : 'Bonsoir') + (cfg.name ? ', ' + esc(cfg.name) : '');
  el.innerHTML = `<div class="page">
    <div class="home-hero"><canvas class="hs" title="Touchez la sphère pour parler à Clipia"></canvas><h1>CLIPIA <span>NOVA</span></h1><p>${hello} — que faisons-nous aujourd'hui ?</p>
      <form class="search"><input placeholder="Rechercher sur le web, ou une adresse .onion…"><select>${Object.entries(D.engines).map(([id, e]) => `<option value="${id}" ${id === cfg.engine ? 'selected' : ''}>${e.name}</option>`).join('')}</select><button class="primary">Rechercher</button></form>
      <div class="row" style="justify-content:center;gap:.6rem;margin-top:1rem"><button class="chip" id="hTalk">🎤 Parler à Clipia</button><button class="chip" id="hAsk">✦ Demander à Clipia</button><button class="chip" id="hTor">🧅 Onglet Tor</button><button class="chip" id="hCom">💬 Communauté</button></div>
      <div class="safe-badge">🛡 Bouclier actif · <b id="blockedN">${blocked}</b> traqueur(s) bloqué(s) · aucun plugin tiers · vos données restent chez vous</div>
    </div>
    <h3 class="sec">Mes applications</h3>
    <div class="tiles">${apps.map(a => `<div class="tile" data-url="${esc(a.url)}"><span class="rm" data-rm="${a.id}">✕</span><div class="ic">${a.ic}</div><small>${esc(a.name)}</small></div>`).join('')}
      <div class="tile" data-store="1"><div class="ic">＋</div><small>Ajouter</small></div></div>
    ${cfg.favorites.length ? `<h3 class="sec">Favoris</h3><div class="hist">${cfg.favorites.slice(0, 8).map(x => `<button data-url="${esc(x.url)}">★ ${esc(x.title)}</button>`).join('')}</div>` : ''}
    ${cfg.history.length ? `<h3 class="sec">Récemment visité</h3><div class="hist">${cfg.history.slice(0, 6).map(x => `<button data-url="${esc(x.url)}">🕘 ${esc(x.title)}</button>`).join('')}</div>` : ''}
  </div>`;
  const o = new Orb($('.hs', el), { points: 700, interactive: true, scale: 0.42 }); o.onClick = () => { toggleCompanion(true); Voice.listenOnce(); };
  const f = $('.search', el);
  $('select', f).onchange = e => { cfg.engine = e.target.value; save(); };
  f.onsubmit = e => { e.preventDefault(); navigate($('input', f).value); };
  $('#hTalk', el).onclick = () => { toggleCompanion(true); Voice.listenOnce(); };
  $('#hAsk', el).onclick = () => { const q = $('input', f).value.trim(); if (q) ask(q, {}); else { toggleCompanion(true); $('#cpIn').focus(); } };
  $('#hTor', el).onclick = () => newTab('tor');
  $('#hCom', el).onclick = () => openSocial('communaute');
  $$('[data-url]', el).forEach(x => x.onclick = e => { if (e.target.dataset.rm) return; navigate(x.dataset.url); });
  $$('[data-rm]', el).forEach(x => x.onclick = () => { cfg.installed = cfg.installed.filter(i => i !== x.dataset.rm); save(); pageHome(el); });
  $('[data-store]', el).onclick = () => openInternal('store');
}

function pageHistory(el) {
  el.innerHTML = `<div class="page"><div class="settings"><h1>🕘 Historique et favoris</h1>
    <div class="card"><h2>★ Favoris</h2>${cfg.favorites.length ? `<div class="hist">${cfg.favorites.map((x, i) => `<div class="hrow"><button data-url="${esc(x.url)}">★ ${esc(x.title)}<small>${esc(x.url)}</small></button><b data-fdel="${i}">✕</b></div>`).join('')}</div>` : '<p class="note">Ctrl+D ajoute la page ouverte aux favoris.</p>'}</div>
    <div class="card"><h2>Historique</h2><input id="hq" placeholder="🔍 Rechercher dans l'historique" style="width:100%;background:#0b0926;border:1px solid var(--line);border-radius:10px;padding:.6rem;margin:.6rem 0">
      <div class="hist" id="hl">${cfg.history.map(x => `<div class="hrow"><button data-url="${esc(x.url)}">${esc(x.title)}<small>${new Date(x.at).toLocaleString('fr-FR')} · ${esc(x.url)}</small></button></div>`).join('') || '<p class="note">Aucune page visitée.</p>'}</div>
      <button class="btn2" id="hclr" style="margin-top:1rem">🧹 Tout effacer</button></div></div></div>`;
  $$('[data-url]', el).forEach(b => b.onclick = () => navigate(b.dataset.url));
  $$('[data-fdel]', el).forEach(b => b.onclick = () => { cfg.favorites.splice(+b.dataset.fdel, 1); save(); pageHistory(el); });
  $('#hq', el).oninput = e => { const q = e.target.value.toLowerCase(); $$('#hl .hrow', el).forEach(r => r.style.display = r.textContent.toLowerCase().includes(q) ? '' : 'none'); };
  $('#hclr', el).onclick = async () => { cfg.history = []; save(); await window.nova.clearPrivacy(); pageHistory(el); toast('✓ Historique effacé'); };
}

let storeCat = 'Tout';
function pageStore(el) {
  const all = [...D.store, ...cfg.devApps];
  const cats = ['Tout', ...new Set(all.map(a => a.cat))];
  const list = all.filter(a => storeCat === 'Tout' || a.cat === storeCat);
  el.innerHTML = `<div class="page">
    <div class="store-head"><div><h1>Clipia <span>Store</span></h1><p style="color:var(--muted)">Des applications web, pas de plugins : rien ne s'installe dans votre navigateur.</p></div>
    <input id="sq" placeholder="🔍 Rechercher une application"></div>
    <div class="cats">${cats.map(c => `<button class="${c === storeCat ? 'on' : ''}" data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div>
    <div class="apps">${list.map(appCard).join('')}</div>
    <div class="dev"><h2>👩‍💻 Publiez votre application — gratuit</h2>
      <p style="color:var(--muted);margin:.4rem 0 1rem">Développeurs : proposez votre application web au Clipia Store.</p>
      <div class="row"><input id="dName" placeholder="Nom" style="flex:1"><input id="dUrl" placeholder="https://…" style="flex:2"><input id="dIc" placeholder="Emoji" style="width:90px"></div>
      <div class="field"><input id="dDesc" placeholder="Description courte"></div>
      <button class="primary" id="dSend" style="margin-top:1rem">Soumettre</button>
      <p class="note">L'application est ajoutée à votre Store, marquée « en attente de validation ».</p>
    </div></div>`;
  $$('.cats button', el).forEach(b => b.onclick = () => { storeCat = b.dataset.c; pageStore(el); });
  $('#sq', el).oninput = e => { const q = e.target.value.toLowerCase(); $$('.app', el).forEach(c => c.style.display = c.textContent.toLowerCase().includes(q) ? '' : 'none'); };
  $$('[data-inst]', el).forEach(b => b.onclick = () => {
    const id = b.dataset.inst, on = cfg.installed.includes(id);
    cfg.installed = on ? cfg.installed.filter(i => i !== id) : [...cfg.installed, id]; save();
    toast(on ? 'Application retirée' : '✓ Ajoutée à votre accueil'); pageStore(el);
    tabs.filter(t => t.kind === 'home').forEach(renderInternal);
  });
  $$('[data-open]', el).forEach(b => b.onclick = () => newTab('web', b.dataset.open));
  $('#dSend', el).onclick = () => {
    const name = $('#dName', el).value.trim(), url = $('#dUrl', el).value.trim();
    if (!name || !/^https:\/\//.test(url)) return toast('Nom et adresse https:// obligatoires');
    cfg.devApps.push({ id: 'dev-' + Date.now(), cat: 'Développeurs', ic: $('#dIc', el).value.trim() || '🧩', name, by: 'En attente de validation', desc: $('#dDesc', el).value.trim(), url });
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
    <div class="card"><h2>✦ Intelligence artificielle</h2><p class="note">Moteur principal de Clipia. Configurez autant de moteurs que vous voulez.</p>
      <div class="grid-prov" style="margin-top:1rem">${provButtons(cfg.provider)}</div><div id="sProv"></div></div>
    <div class="card"><h2>🎙 Voix</h2><div id="sVoice"></div></div>
    <div class="card"><h2>🧠 Ce que Clipia retient de vous</h2><p class="note">Dites « Clipia, souviens-toi que… » ou ajoutez-le ici. Tout reste sur cet ordinateur.</p>
      <div class="mem">${cfg.memory.map((m, i) => `<div class="hrow"><span>${esc(m)}</span><b data-mdel="${i}">✕</b></div>`).join('') || '<p class="note">Rien pour le moment.</p>'}</div>
      <div class="row" style="margin-top:.8rem"><input id="memIn" placeholder="Ex. : je préfère les réponses courtes" style="flex:1;background:#0b0926;border:1px solid var(--line);border-radius:10px;padding:.6rem"><button class="btn2" id="memAdd">Ajouter</button></div></div>
    <div class="card"><h2>✉ Messageries</h2><p class="note">Connexion directe sur le site officiel de chaque messagerie.</p>
      <div class="mails" style="margin-top:1rem">${D.mails.map(m => `<button data-m="${m.id}" class="${cfg.mails.includes(m.id) ? 'on' : ''}">${m.ic} ${m.name}${cfg.mails.includes(m.id) ? ' ✓' : ''}</button>`).join('')}</div></div>
    <div class="card"><h2>🛡 Bouclier, vie privée et Tor</h2>
      <label class="row" style="margin-top:.8rem"><input type="checkbox" id="shT" ${cfg.shield.trackers ? 'checked' : ''}> Bloquer les traqueurs publicitaires</label>
      <label class="row" style="margin-top:.5rem"><input type="checkbox" id="shH" ${cfg.shield.https ? 'checked' : ''}> Ouvrir les sites en HTTPS automatiquement</label>
      <p class="note">🧅 Tor : ${torState.state === 'ready' ? 'connecté' : 'arrêté'} — Ctrl+Maj+N ouvre un onglet Tor. Les adresses .onion ne sortent jamais hors de Tor.</p>
      <div class="row" style="margin-top:1rem"><button class="btn2" id="clr">🧹 Effacer cookies, cache et historique</button><button class="btn2" id="wipe">🔑 Supprimer toutes mes clés</button></div></div>
    <div class="card"><h2>🎭 Style de Clipia</h2><div class="row" style="margin-top:.6rem"><select id="sMode">${Object.entries(D.modes).map(([id, m]) => `<option value="${id}" ${id === cfg.mode ? 'selected' : ''}>${m.label}</option>`).join('')}</select></div>
      <div class="field"><label>Mon style personnalisé</label><textarea id="sPerso" rows="2">${esc(cfg.customPrompt)}</textarea></div></div>
    <div class="card"><h2>⚡ Performances</h2><label class="row" style="margin-top:.6rem"><input type="checkbox" id="slp" ${cfg.tabSleep ? 'checked' : ''}> Mettre en veille les onglets inutilisés depuis <input id="slpMin" type="number" min="2" max="120" value="${cfg.sleepMin}" style="width:70px;background:#0b0926;border:1px solid var(--line);border-radius:8px;padding:.3rem"> min (libère la mémoire, la page se recharge quand vous y revenez)</label></div>
    <div class="card"><h2>⌨ Clavier</h2><p class="note">Plus de 30 raccourcis, comme dans l'application Clipia.</p><button class="btn2" id="sKeys" style="margin-top:.6rem">Voir les raccourcis (F1)</button></div>
    <div class="card"><h2>À propos</h2><p class="note">Clipia Nova 2.2 — moteur Chromium · conçu par Clin Fabrice, CLENDAX (Flize, Ardennes).</p>
      <button class="btn2" id="rewz" style="margin-top:.8rem">Relancer l'assistant de configuration</button></div>
  </div></div>`;
  let sel = cfg.provider;
  $$('.prov[data-p]', el).forEach(b => b.onclick = () => { sel = cfg.provider = b.dataset.p; save(); $$('.prov[data-p]', el).forEach(x => x.classList.toggle('on', x === b)); providerForm($('#sProv', el), sel, false); updEngine(); });
  providerForm($('#sProv', el), sel, false);
  voiceForm($('#sVoice', el), false);
  $$('[data-mdel]', el).forEach(b => b.onclick = () => { cfg.memory.splice(+b.dataset.mdel, 1); save(); pageSettings(el); });
  $('#memAdd', el).onclick = () => { const v = $('#memIn', el).value.trim(); if (v) { cfg.memory.push(v); save(); pageSettings(el); } };
  $$('[data-m]', el).forEach(b => b.onclick = () => { toggleMail(b.dataset.m); pageSettings(el); });
  const sh = async () => { cfg.shield = { trackers: $('#shT', el).checked, https: $('#shH', el).checked }; save(); await window.nova.setShield(cfg.shield); toast('Bouclier mis à jour'); };
  $('#shT', el).onchange = sh; $('#shH', el).onchange = sh;
  $('#clr', el).onclick = async () => { await window.nova.clearPrivacy(); cfg.history = []; save(); toast('✓ Données de navigation effacées'); };
  $('#wipe', el).onclick = async () => { await window.nova.wipeKeys(); KEYS = {}; toast('✓ Clés supprimées'); pageSettings(el); };
  $('#sMode', el).onchange = e => { cfg.mode = e.target.value; save(); $('#aiMode').value = cfg.mode; };
  $('#sPerso', el).onchange = e => { cfg.customPrompt = e.target.value.trim(); save(); };
  $('#sKeys', el).onclick = () => toggleKeys(true);
  $('#slp', el).onchange = e => { cfg.tabSleep = e.target.checked; save(); };
  $('#slpMin', el).onchange = e => { cfg.sleepMin = Math.max(2, +e.target.value || 10); save(); };
  $('#rewz', el).onclick = () => { step = 0; startWizard(); };
}

/* =========================================================
   4. CLIPIA : panneau + compagnon plein écran
   ========================================================= */
let convo = [];
function updEngine() { const p = D.providers[cfg.provider]; $('#aiEngine').textContent = p.name + ' · ' + modelOf(cfg.provider); }
function initAI() {
  $('#aiMode').innerHTML = Object.entries(D.modes).map(([id, m]) => `<option value="${id}">${m.label}</option>`).join('');
  $('#aiMode').value = cfg.mode;
  $('#aiMode').onchange = e => { cfg.mode = e.target.value; save(); };
  $('#aiVoice').textContent = cfg.voice ? '🔊' : '🔈';
  $('#aiVoice').onclick = () => handleKey({ key: 'v', ctrl: true, shift: true });
  $('#aiClear').onclick = () => { convo = []; $('#chat').innerHTML = ''; $('#cpLines').innerHTML = ''; hello(); };
  $('#ask').onsubmit = e => { e.preventDefault(); const v = $('#askIn').value.trim(); if (v) { $('#askIn').value = ''; ask(v, {}); } };
  $('#askIn').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#ask').requestSubmit(); } });
  $('#askMic').onclick = () => Voice.listenOnce();
  $$('.quick button').forEach(b => b.onclick = () => quick(b.dataset.q));
  updEngine(); hello();
}
function hello() { bubble('a', `Bonjour${cfg.name ? ' ' + cfg.name : ''} ! Je suis Clipia. Écrivez-moi, parlez-moi (🎤 ou Ctrl+M), ou appuyez sur Ctrl+Espace pour me voir en grand.`); }
function bubble(cls, text) { const d = el('div', 'msg ' + cls); d.textContent = text; $('#chat').appendChild(d); $('#chat').scrollTop = 1e9; return d; }

function initCompanion() {
  bigOrb = new Orb($('#bigOrb'), { points: 1600, full: true, interactive: true, scale: 0.2, cy: 0.36 });
  bigOrb.onClick = () => Voice.speaking ? Voice.stop() : Voice.listenOnce();
  $('#cpClose').onclick = () => toggleCompanion(false);
  $('#cpMic').onclick = () => Voice.listenOnce();
  $('#cpHands').onclick = () => setHands(!Voice.handsFree);
  $('#cpForm').onsubmit = e => { e.preventDefault(); const v = $('#cpIn').value.trim(); if (v) { $('#cpIn').value = ''; ask(v, { speak: cfg.voice }); } };
  Voice.onState('idle');
}
function toggleCompanion(force) {
  const c = $('#companion'); const show = force ?? c.classList.contains('hidden');
  c.classList.toggle('hidden', !show);
  $('#cpName').textContent = 'Clipia' + (cfg.name ? ' · ' + cfg.name : '');
  if (!show) { Voice.stop(); if (Voice.handsFree) setHands(false); }
}
function setHands(on) {
  Voice.setHandsFree(on);
  $('#cpHands').classList.toggle('on', on);
  $('#cpHands').textContent = on ? '🖐 Mains libres : activé' : '🖐 Mains libres';
  if (on) cpState('Mains libres : dites « Clipia » suivi de votre demande');
}
function cpState(t) { const s = $('#cpState'); if (s) s.textContent = t; }
function cpLine(who, text) {
  const d = el('div', 'cp-line ' + who); d.textContent = text; $('#cpLines').appendChild(d);
  while ($('#cpLines').children.length > 6) $('#cpLines').firstChild.remove();
}

async function pageText() {
  const t = cur(); if (!t || !t.wv) return null;
  try { return { title: t.title, url: t.url, text: (await t.wv.executeJavaScript('document.body.innerText')).slice(0, 14000) }; } catch { return null; }
}
async function quick(q) {
  $('#ai').classList.remove('closed');
  const SOC = { ig: 'Écris une légende Instagram percutante (avec emojis) + 15 hashtags pertinents', tt: 'Écris un script TikTok de 30 secondes : accroche des 2 premières secondes, 4 plans, texte à l\'écran, son conseillé et 8 hashtags', fb: 'Rédige un post Facebook engageant (3 courts paragraphes + appel à l\'action)' };
  if (SOC[q]) { const pg0 = await pageText(); return ask(pg0 ? `${SOC[q]}, à partir de cette page.\n\nTitre : ${pg0.title}\nContenu :\n${pg0.text}` : `${SOC[q]}. Demande-moi d'abord le sujet si tu ne le connais pas.`, { shown: { ig: '📸 Légende Instagram', tt: '🎵 Script TikTok', fb: '📘 Post Facebook' }[q] + (pg0 ? ' : ' + pg0.title : '') }); }
  if (q === 'clip') return ask("Propose-moi 3 idées de clip musical originales pour CLENDAX, avec pour chacune : l'ambiance, 5 plans clés et une accroche TikTok.", {});
  const pg = await pageText();
  if (q === 'post') return ask(pg ? `Rédige un post réseaux sociaux accrocheur à partir de cette page.\n\nTitre : ${pg.title}\nContenu :\n${pg.text}` : "Aide-moi à rédiger un post réseaux sociaux accrocheur. Pose-moi d'abord 2 questions.", { shown: pg ? '📣 Post à partir de : ' + pg.title : null });
  if (!pg) return bubble('t', 'Ouvrez d\'abord une page web dans l\'onglet actif.');
  const what = { sum: 'Résume cette page en 5 points clairs, en français.', tr: 'Traduis le contenu principal de cette page en français.', exp: 'Explique simplement le contenu de cette page.' }[q];
  ask(`${what}\n\nTitre : ${pg.title}\nAdresse : ${pg.url}\nContenu :\n${pg.text}`, { shown: `${{ sum: '📝 Résumer', tr: '🌍 Traduire', exp: '💡 Expliquer' }[q]} : ${pg.title}` });
}

/* Commandes vocales/texte simples, traitées sans IA */
async function command(text) {
  const t = text.trim(), low = t.toLowerCase().replace(/[.!?]+$/, '');
  let m;
  if ((m = low.match(/^(?:souviens-toi|souviens toi|retiens|n'oublie pas)(?: que| de)?\s+(.+)/i))) { cfg.memory.push(t.slice(t.length - m[1].length)); save(); return 'C\'est noté, je m\'en souviendrai. Tout reste sur votre ordinateur.'; }
  if ((m = low.match(/^(?:ouvre|lance|va sur|affiche)\s+(.+)/))) {
    const q = m[1].replace(/^(le site |la page |l'appli |l'application )/, '').trim();
    if (/^(un )?onglet tor|tor$/.test(q)) { newTab('tor'); return 'J\'ouvre un onglet Tor.'; }
    if (/store|boutique/.test(q)) { openInternal('store'); return 'Voici le Store.'; }
    const soc = D.socials.find(x => q.startsWith(x.name.toLowerCase()) || q.startsWith(x.id));
    if (soc) { openSocial(soc.id); return 'J\'ouvre ' + soc.name + '.'; }
    if (/r[ée]glages|param[eè]tres/.test(q)) { openInternal('settings'); return 'Voici les réglages.'; }
    if (/mails?|messagerie/.test(q)) { openMails(); return 'J\'ouvre vos mails.'; }
    if (/historique/.test(q)) { openInternal('history'); return 'Voici votre historique.'; }
    const app = [...D.store, ...cfg.devApps].find(a => a.name.toLowerCase() === q || a.id === q || a.name.toLowerCase().startsWith(q));
    if (app) { newTab('web', app.url); return 'J\'ouvre ' + app.name + '.'; }
    if (/^[\w-]+(\.[\w-]+)+$/.test(q.replace(/\s/g, ''))) { newTab('home'); navigate(q.replace(/\s/g, '')); return 'J\'ouvre ' + q + '.'; }
  }
  if ((m = low.match(/^(?:cherche|recherche|trouve)(?: moi)?\s+(.+)/))) { newTab('home'); navigate(m[1]); return 'Je lance la recherche : ' + m[1] + '.'; }
  if (/^(?:résume|resume)(?:-moi)? (?:la|cette) page/.test(low)) { quick('sum'); return null; }
  if (/^(?:traduis|traduit)(?:-moi)? (?:la|cette) page/.test(low)) { quick('tr'); return null; }
  if (/^(?:ferme|fermer) (?:l'|cet |l’)?onglet/.test(low)) { closeTab(active); return 'Onglet fermé.'; }
  if (/^(?:tais-toi|chut|stop|arrête de parler)/.test(low)) { Voice.stop(); return ''; }
  if (/^(?:mode lecture|lis(?:-moi)? (?:la|cette) page)/.test(low)) { openReader(/^lis/.test(low)); return null; }
  if (/(r[ée]pare|d[ée]panne|d[ée]pannage|(pc|ordi|ordinateur|windows|mac)\b.*\b(lent|rame|plante|bug|bloqu|probl[eè]me|marche pas|ne fonctionne)|(internet|wifi|connexion)\b.*\b(marche pas|coup|lent|probl))/.test(low)) { repairState.problem = t; openInternal('repair'); setTimeout(() => runRepair(), 300); return 'J\'analyse votre ordinateur. Je vous propose ensuite des réparations : rien ne sera fait sans votre accord.'; }
  if (/^(?:fais une |prends une )?capture/.test(low)) { screenshot(); return 'Capture enregistrée.'; }
  if (/^partage/.test(low)) { toggleShare(true); return 'Où voulez-vous partager ?'; }
  if (/^(?:quelle heure|il est quelle heure)/.test(low)) return 'Il est ' + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + '.';
  return undefined;
}

async function ask(text, { speak = false, shown = null, fromVoice = false } = {}) {
  const p = D.providers[cfg.provider];
  const talk = speak || (cfg.voice && fromVoice);
  bubble('u', shown || text); cpLine('u', shown || text);
  const direct = await command(text);
  if (direct !== undefined) {
    if (direct) { bubble('a', direct); cpLine('a', direct); if (talk || cfg.voice) await Voice.speak(direct); }
    return;
  }
  if (!hasKey(cfg.provider)) {
    const m = `Aucune clé ${p.name} n'est configurée. Ouvrez ⚙ Réglages → Intelligence artificielle (2 minutes).`;
    bubble('e', m); cpLine('e', m); return;
  }
  convo.push({ role: 'user', content: text });
  const wait = bubble('t', 'Clipia réfléchit…'); setOrb('thinking'); cpState('Je réfléchis…'); Voice.busy = true;
  const mode = D.modes[cfg.mode];
  const mem = cfg.memory.length ? ' Ce que tu sais de l\'utilisateur (il te l\'a demandé) : ' + cfg.memory.join(' ; ') + '.' : '';
  const system = (cfg.mode === 'perso' && cfg.customPrompt ? 'Tu es Clipia. ' + cfg.customPrompt : mode.prompt)
    + (cfg.name ? ` L'utilisateur s'appelle ${cfg.name}.` : '') + mem
    + ' Tu es la compagne intégrée au navigateur Clipia Nova (CLENDAX). Tes réponses peuvent être lues à voix haute : sois naturelle et va à l\'essentiel.';
  const r = await window.nova.aiChat({ provider: cfg.provider, apiKey: KEYS[cfg.provider], model: modelOf(cfg.provider), host: cfg.ollamaHost, system, messages: convo.slice(-20) });
  wait.remove(); Voice.busy = false;
  if (r.error) { convo.pop(); bubble('e', '✕ ' + r.error); cpLine('e', r.error); setOrb('idle'); cpState('Un souci est survenu'); return; }
  convo.push({ role: 'assistant', content: r.text });
  bubble('a', r.text); cpLine('a', r.text);
  if (talk || cfg.voice) await Voice.speak(r.text); else Voice.onState(Voice.handsFree ? 'listening' : 'idle');
}


/* =========================================================
   5. RÉSEAUX SOCIAUX INTÉGRÉS (pas des extensions : les sites officiels, dans un panneau)
   ========================================================= */
const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const socViews = {}; let socCur = null;
function initSocial() {
  $('#rail').innerHTML = D.socials.map(x => `<button class="rl" data-soc="${x.id}" title="${x.name}${x.wide ? ' (s\'ouvre dans un onglet)' : ''}"><span style="background:${x.color}">${x.ic}</span></button>`).join('')
    + `<button class="rl rl-ai" data-socai="1" title="Studio réseaux Clipia"><span>✦</span></button>`;
  $$('#rail [data-soc]').forEach(b => b.onclick = () => openSocial(b.dataset.soc));
  $('[data-socai]').onclick = () => { $('#ai').classList.remove('closed'); $('#chat').scrollTop = 1e9; toast('Studio réseaux : 📸 Instagram · 🎵 TikTok · 📘 Facebook'); };
  $('#socClose').onclick = () => toggleSocial(false);
  $('#socReload').onclick = () => socCur && socViews[socCur].reload();
  $('#socTab').onclick = () => { if (!socCur) return; newTab('web', socViews[socCur].getURL ? socViews[socCur].getURL() : D.socials.find(x => x.id === socCur).url); toggleSocial(false); };
}
function openSocial(id) {
  const x = D.socials.find(s => s.id === id); if (!x) return;
  if (x.wide) { newTab('web', x.url); return; }
  if (socCur === id && !$('#social').classList.contains('closed')) return toggleSocial(false);
  if (!socViews[id]) {
    const wv = document.createElement('webview');
    wv.setAttribute('partition', 'persist:nova'); if (!x.desktop) wv.setAttribute('useragent', MOBILE_UA); wv.setAttribute('allowpopups', '');
    wv.src = x.url; socViews[id] = wv; $('#socViews').appendChild(wv);
  }
  Object.entries(socViews).forEach(([k, v]) => v.classList.toggle('on', k === id));
  socCur = id;
  $('#socName').textContent = x.name; $('#socIc').textContent = x.ic; $('#socIc').style.background = x.color;
  $$('#rail .rl').forEach(b => b.classList.toggle('on', b.dataset.soc === id));
  $('#social').classList.remove('closed');
}
function toggleSocial(force) {
  const open = force ?? $('#social').classList.contains('closed');
  if (open) openSocial(socCur || 'facebook'); else { $('#social').classList.add('closed'); $$('#rail .rl').forEach(b => b.classList.remove('on')); }
}

/* ---------- Partage, lecture, capture, image dans l'image, veille ---------- */
function initTools() {
  $('#btnShare').onclick = (e) => { e.stopPropagation(); toggleShare(); };
  $('#btnReader').onclick = () => openReader();
  $('#btnShot').onclick = screenshot;
  $('#btnFix').onclick = () => openInternal('repair');
  document.addEventListener('click', e => { if (!e.target.closest('#shareMenu')) $('#shareMenu').classList.add('hidden'); });
  let fs = 1.15;
  $('#rdBigger').onclick = () => { fs = Math.min(1.8, fs + .1); $('#rdBody').style.fontSize = fs + 'rem'; };
  $('#rdSmaller').onclick = () => { fs = Math.max(.85, fs - .1); $('#rdBody').style.fontSize = fs + 'rem'; };
  $('#rdClose').onclick = () => { $('#reader').classList.add('hidden'); Voice.stop(); };
  $('#rdSpeak').onclick = () => Voice.speaking ? Voice.stop() : Voice.speak($('#rdBody').innerText.slice(0, 2400));
  $('#rdSum').onclick = () => { $('#reader').classList.add('hidden'); quick('sum'); };
}
function toggleShare(force) {
  const m = $('#shareMenu'), t = cur();
  const show = force ?? m.classList.contains('hidden');
  if (!show) return m.classList.add('hidden');
  if (!t || t.kind !== 'web') return toast('Ouvrez une page pour la partager');
  const u = encodeURIComponent(t.url), ti = encodeURIComponent(t.title || '');
  m.innerHTML = `<b>Partager « ${esc((t.title || '').slice(0, 40))} »</b>` + D.share.map((x, i) => `<button data-sh="${i}"><span>${x.ic}</span>${x.name}</button>`).join('') + `<button data-copy="1"><span>⧉</span>Copier le lien</button><button data-ai="1"><span>✦</span>Post rédigé par Clipia</button>`;
  $$('[data-sh]', m).forEach(b => b.onclick = () => { const x = D.share[+b.dataset.sh]; const url = x.url.replace(/\{u\}/g, u).replace(/\{t\}/g, ti); url.startsWith('mailto:') ? window.nova.openExternal(url) : newTab('web', url); m.classList.add('hidden'); });
  $('[data-copy]', m).onclick = async () => { try { await navigator.clipboard.writeText(t.url); toast('✓ Lien copié'); } catch { toast(t.url); } m.classList.add('hidden'); };
  $('[data-ai]', m).onclick = () => { m.classList.add('hidden'); quick('fb'); };
  m.classList.remove('hidden');
}
async function openReader(speakNow) {
  const t = cur(); if (!t?.wv) return toast('Ouvrez un article pour le mode lecture');
  let r = null;
  try {
    r = await t.wv.executeJavaScript(`(() => { const c=[...document.querySelectorAll('article,main,[role=main],.post,.article,.entry-content,.content,#content')]; let best=null,bl=0; for (const e of c){const l=(e.innerText||'').length; if(l>bl){best=e;bl=l}} const root=best||document.body; const items=[...root.querySelectorAll('h1,h2,h3,p,li,blockquote')].map(e=>({t:e.tagName,x:(e.innerText||'').trim()})).filter(o=>o.x.length>2&&o.x.length<4000).slice(0,500); return {title:document.title, host:location.hostname, items}; })()`);
  } catch {}
  if (!r || !r.items.length) return toast('Cette page n\'a pas de texte à lire');
  $('#rdBody').innerHTML = `<small>${esc(r.host)}</small><h1>${esc(r.title)}</h1>` + r.items.map(i => /^H/.test(i.t) ? `<h2>${esc(i.x)}</h2>` : i.t === 'LI' ? `<p class="li">• ${esc(i.x)}</p>` : i.t === 'BLOCKQUOTE' ? `<blockquote>${esc(i.x)}</blockquote>` : `<p>${esc(i.x)}</p>`).join('');
  $('#reader').classList.remove('hidden'); $('#reader').scrollTop = 0;
  if (speakNow) Voice.speak($('#rdBody').innerText.slice(0, 2400));
}
async function screenshot() {
  const t = cur(); if (!t?.wv) return toast('Ouvrez une page à capturer');
  try {
    const img = await t.wv.capturePage();
    const r = await window.nova.savePng({ data: img.toDataURL(), name: (t.title || 'page').replace(/[^\w\- ]+/g, '').slice(0, 40) });
    toast('📸 Capture enregistrée', { label: 'Afficher', run: () => window.nova.showFile(r.path) });
  } catch (e) { toast('Capture impossible : ' + e.message); }
}
async function pip() {
  const t = cur(); if (!t?.wv) return;
  const r = await t.wv.executeJavaScript(`(async()=>{const v=[...document.querySelectorAll('video')].sort((a,b)=>b.clientWidth*b.clientHeight-a.clientWidth*a.clientHeight)[0]; if(!v) return 'none'; if(document.pictureInPictureElement){await document.exitPictureInPicture();return 'off'} await v.requestPictureInPicture(); return 'on'})()`, true).catch(() => 'err');
  toast(r === 'on' ? '▣ Vidéo en image dans l\'image' : r === 'off' ? 'Image dans l\'image fermée' : 'Aucune vidéo sur cette page');
}
function sleepTabs() {
  if (!cfg.tabSleep) return;
  const limit = Date.now() - cfg.sleepMin * 60000;
  tabs.filter(t => t.kind === 'web' && t.id !== active && !t.sleeping && t.wv && (t.last || 0) < limit).forEach(t => {
    try { if (t.wv.isCurrentlyAudible()) return; } catch {}
    t.url = t.wv.getURL ? t.wv.getURL() || t.url : t.url;
    t.wv.remove(); t.wv = null; t.el = el('div', 'view'); t.el.innerHTML = '<div class="page" style="display:grid;place-items:center"><p style="color:var(--muted)">💤 Onglet en veille — il se recharge…</p></div>';
    $('#views').appendChild(t.el); t.sleeping = true;
  });
  drawTabs();
}
function wake(t) { t.sleeping = false; const u = t.url; t.el.remove(); t.el = null; makeWebview(t, u); }


/* =========================================================
   6. DÉPANNAGE DE L'ORDINATEUR (diagnostic + réparations avec accord)
   ========================================================= */
const repairState = { problem: '', diag: null, actions: [], text: '', busy: false, quick: null, convo: [] };
const bar = (pct, warn = 80) => `<div class="mbar"><i style="width:${Math.min(100, pct)}%;background:${pct >= warn ? '#f87171' : pct >= warn - 20 ? '#fbbf24' : '#34d399'}"></i></div>`;
async function pageRepair(el) {
  if (!repairState.quick) repairState.quick = await window.nova.sysQuick();
  const d = repairState.diag, Q = repairState.quick;
  el.innerHTML = `<div class="page"><div class="settings" style="max-width:980px">
    <h1>🛠 Dépannage par Clipia</h1>
    <p class="note" style="font-size:1rem">Clipia analyse votre ordinateur, explique ce qui ne va pas et propose des réparations. <b>Rien n'est exécuté sans votre accord</b> : chaque commande est affichée, et les commandes dangereuses sont bloquées par le bouclier.</p>
    <div class="card"><h2>Quel est le problème ?</h2>
      <textarea id="rpIn" rows="2" placeholder="Ex. : mon PC est très lent depuis ce matin, internet coupe souvent, le son ne marche plus…" style="width:100%;margin-top:.6rem;background:#0b0926;border:1px solid var(--line);border-radius:12px;padding:.8rem">${esc(repairState.problem)}</textarea>
      <div class="row" style="margin-top:.8rem"><button class="primary" id="rpGo">${repairState.busy ? '⏳ Analyse en cours…' : '🔍 Analyser mon ordinateur'}</button><button class="btn2" id="rpTalk">🎤 Le dire à Clipia</button></div></div>
    ${d ? `<div class="card"><h2>📊 État de l'ordinateur</h2><p class="note">${esc(d.systeme)} · ${esc(d.processeur)} · allumé depuis ${esc(d.allumeDepuis)}</p>
      <div class="diag">
        <div><b>Processeur</b><span>${d.cpuPct} %</span>${bar(d.cpuPct)}</div>
        <div><b>Mémoire</b><span>${d.ramPct} % · ${d.ramLibreGo} Go libres / ${d.ramTotGo}</span>${bar(d.ramPct, 85)}</div>
        ${d.disques.map(x => { const pct = Math.round((1 - x.libreGo / x.totGo) * 100); return `<div><b>Disque ${esc(x.nom)}</b><span>${x.libreGo} Go libres / ${x.totGo}</span>${bar(pct, 90)}</div>`; }).join('')}
        <div><b>Internet</b><span>${d.reseau.internet ? '✓ connecté' + (d.reseau.latenceMs ? ' · ' + d.reseau.latenceMs + ' ms' : '') : '✕ pas d\'accès'}${d.reseau.dns ? '' : ' · DNS en panne'}</span></div>
        <div><b>Fichiers temporaires</b><span>${d.tempMo >= 1024 ? (d.tempMo / 1024).toFixed(1) + ' Go' : d.tempMo + ' Mo'}</span></div>
        ${d.derniereMaj ? `<div><b>Dernière mise à jour Windows</b><span>${esc(d.derniereMaj)}</span></div>` : ''}
      </div>
      <h3 class="sec" style="margin:1.2rem 0 .5rem">Programmes les plus gourmands</h3>
      <div class="procs">${d.processus.map(p => `<span>${esc(p.nom)} <small>${p.memMo} Mo</small></span>`).join('')}</div>
      ${d.demarrage && d.demarrage.length ? `<h3 class="sec" style="margin:1.2rem 0 .5rem">Lancés au démarrage</h3><div class="procs">${d.demarrage.map(n => `<span>${esc(n)}</span>`).join('')}</div>` : ''}
    </div>` : ''}
    ${repairState.text || repairState.actions.length ? `<div class="card"><h2>✦ Le diagnostic de Clipia</h2><div class="rp-text">${esc(repairState.text)}</div>
      <div class="acts">${repairState.actions.map((a, i) => actCard(a, 'ai' + i)).join('') || ''}</div>
      ${repairState.actions.some(a => a.done) ? '<button class="btn2" id="rpFollow" style="margin-top:1rem">✦ Clipia, analyse les résultats</button>' : ''}</div>` : ''}
    <div class="card"><h2>⚡ Réparations rapides <small style="color:var(--muted);font-weight:400">(${esc(Q.shell)})</small></h2>
      <div class="acts">${Q.list.map((a, i) => actCard(a, 'q' + i)).join('')}</div></div>
    <p class="note">Historique des commandes : fichier « depannage.log » dans le dossier de Clipia Nova. Pour un problème matériel (écran, batterie, disque qui fait du bruit), Clipia vous conseillera un réparateur.</p>
  </div></div>`;
  $('#rpGo', el).onclick = () => { repairState.problem = $('#rpIn', el).value.trim(); runRepair(); };
  $('#rpTalk', el).onclick = () => { toggleCompanion(true); Voice.listenOnce(); };
  const f = $('#rpFollow', el); if (f) f.onclick = () => askRepair(true);
  $$('[data-act]', el).forEach(b => b.onclick = () => actClick(b));
}
function actCard(a, key) {
  return `<div class="act ${a.done ? (a.result && a.result.code === 0 ? 'ok' : 'ko') : ''}"><div class="act-h"><b>${esc(a.titre)}</b>${a.admin ? '<span class="tagx adm">administrateur</span>' : ''}<span class="tagx r-${esc(a.risque || 'faible')}">risque ${esc(a.risque || 'faible')}</span>${a.long ? '<span class="tagx">long</span>' : ''}</div>
    <p>${esc(a.pourquoi || '')}</p><code>${esc(a.cmd)}</code>
    ${a.result ? `<pre>${esc(((a.result.out || '') + (a.result.err ? '\n' + a.result.err : '')).trim() || (a.result.code === 0 ? 'Terminé.' : 'Échec (code ' + a.result.code + ')'))}</pre>` : ''}
    <div class="row">${a.running ? '<span class="note">⏳ En cours… ' + (a.admin ? '(acceptez la fenêtre administrateur)' : '') + '</span>' : a.done ? `<button class="btn2" data-act="${key}" data-mode="again">↻ Relancer</button>` : `<button class="primary" data-act="${key}">▶ Exécuter</button>`}</div></div>`;
}
function actOf(key) { return key[0] === 'q' ? repairState.quick.list[+key.slice(1)] : repairState.actions[+key.slice(2)]; }
async function actClick(b) {
  const a = actOf(b.dataset.act);
  if (await window.nova.sysBlocked(a.cmd)) { toast('⛔ Commande bloquée par le bouclier'); return; }
  if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = a.admin ? '✓ Confirmer (droits administrateur)' : '✓ Confirmer l\'exécution'; b.classList.add('warn'); setTimeout(() => { if (b.isConnected) { delete b.dataset.sure; b.textContent = '▶ Exécuter'; b.classList.remove('warn'); } }, 6000); return; }
  a.running = true; rerenderRepair();
  a.result = await window.nova.sysRun({ cmd: a.cmd, admin: !!a.admin });
  a.running = false; a.done = true; rerenderRepair();
  toast(a.result.blocked ? '⛔ Bloqué par le bouclier' : a.result.code === 0 ? '✓ ' + a.titre : '✕ ' + a.titre + ' : voir le détail');
}
function rerenderRepair() { tabs.filter(t => t.kind === 'repair').forEach(t => pageRepair(t.el)); }
async function runRepair() {
  if (repairState.busy) return;
  repairState.busy = true; rerenderRepair(); setOrb('thinking');
  repairState.diag = await window.nova.sysDiag();
  repairState.busy = false; rerenderRepair();
  await askRepair(false);
}
async function askRepair(followUp) {
  const p = D.providers[cfg.provider];
  if (!hasKey(cfg.provider)) { repairState.text = `Pour que je vous propose des réparations, ajoutez une clé ${p.name} dans ⚙ Réglages. En attendant, les réparations rapides ci-dessous fonctionnent sans IA.`; rerenderRepair(); return; }
  repairState.text = 'Clipia réfléchit…'; rerenderRepair(); setOrb('thinking');
  const Q = repairState.quick;
  const system = `Tu es Clipia, une technicienne informatique bienveillante intégrée au navigateur Clipia Nova. Système de l'utilisateur : ${Q.platform} ; les commandes s'exécutent dans ${Q.shell}. ` +
    `Réponds en français simple : d'abord le diagnostic en 3 à 6 phrases, puis au plus 4 actions dans un bloc \`\`\`actions contenant un tableau JSON [{"titre":"…","pourquoi":"…","cmd":"…","admin":false,"risque":"faible|moyen|élevé"}]. ` +
    `Règles : commandes non destructives et réversibles autant que possible ; jamais de formatage, de suppression de fichiers personnels ou système, d'arrêt de l'ordinateur, ni de téléchargement suivi d'exécution ; une commande par action, sur une ligne ; admin:true seulement si nécessaire. Si rien n'est utile ou si c'est un problème matériel, renvoie [] et explique quoi faire.`;
  const msg = followUp
    ? 'Voici les résultats des actions exécutées :\n' + repairState.actions.concat(Q.list).filter(a => a.done).map(a => `- ${a.titre} (code ${a.result.code}) :\n${(a.result.out || '').slice(0, 1500)}\n${(a.result.err || '').slice(0, 500)}`).join('\n') + '\nQue faut-il faire maintenant ?'
    : `Problème décrit : ${repairState.problem || '(aucun : fais un bilan de santé)'}\n\nDiagnostic automatique :\n${JSON.stringify(repairState.diag, null, 1)}`;
  repairState.convo.push({ role: 'user', content: msg });
  const r = await window.nova.aiChat({ provider: cfg.provider, apiKey: KEYS[cfg.provider], model: modelOf(cfg.provider), host: cfg.ollamaHost, system, messages: repairState.convo.slice(-8) });
  setOrb('idle');
  if (r.error) { repairState.text = '✕ ' + r.error; rerenderRepair(); return; }
  repairState.convo.push({ role: 'assistant', content: r.text });
  const m = r.text.match(/```actions\s*([\s\S]*?)```/);
  let acts = [];
  if (m) { try { acts = JSON.parse(m[1]); } catch {} }
  repairState.text = r.text.replace(/```actions[\s\S]*?```/, '').trim();
  const fresh = (Array.isArray(acts) ? acts : []).filter(a => a && a.cmd).slice(0, 4).map(a => ({ titre: String(a.titre || 'Action'), pourquoi: String(a.pourquoi || ''), cmd: String(a.cmd), admin: !!a.admin, risque: String(a.risque || 'faible') }));
  repairState.actions = followUp ? repairState.actions.filter(a => a.done).concat(fresh) : fresh;
  rerenderRepair();
  if (cfg.voice) Voice.speak(repairState.text.slice(0, 600));
}
