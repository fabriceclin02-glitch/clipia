/* =========================================================
   Clipia Communauté — chat en temps réel, multi-appareils
   Réseau ouvert Nostr : pas de serveur central, pas d'e-mail.
   Le compte = pseudo + mot de passe (clé dérivée localement par scrypt).
   ========================================================= */
const K = window.NostrKit;
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const qs = new URLSearchParams(location.search);
const RELAYS = qs.get('relay') ? qs.getAll('relay') : ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net', 'wss://relay.nostr.band'];
const CHANNELS = [
  { slug: 'general', name: 'Général', ic: '💬', desc: 'Bienvenue ! Présentez-vous et discutez de tout.' },
  { slug: 'musique', name: 'Musique & clips', ic: '🎵', desc: 'CLENDAX, vos morceaux, vos clips, vos idées.' },
  { slug: 'entraide', name: 'Entraide', ic: '🤝', desc: 'Questions, astuces, coups de main.' },
  { slug: 'projets', name: 'Projets & business', ic: '🚀', desc: 'Vos projets, vos entreprises, vos réussites.' },
  { slug: 'clipia', name: 'Clipia & Nova', ic: '🔮', desc: 'Tout sur Clipia et le navigateur Clipia Nova.' }
];
const EMOJIS = ['🦊', '🐼', '🦁', '🐺', '🐙', '🦄', '🐸', '🐯', '🦉', '🐬', '🎧', '🎸', '🚀', '⚡', '🔥', '🌙', '🌸', '💎', '👾', '🤖'];
const COLORS = ['#3b82f6', '#8b5cf6', '#d946ef', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#ef4444'];
const enc = new TextEncoder();
const hex = (b) => K.bytesToHex(b);
const chanId = (slug) => hex(K.sha256(enc.encode('clipia-communaute/v1/' + slug)));
CHANNELS.forEach(c => c.id = chanId(c.slug));

let SK = null, PK = null, ME = null, pool = null;
let view = { type: 'chan', id: CHANNELS[0].id };
const store = { chan: {}, dm: {} };          // id -> [events]
const seen = new Set();
const profiles = {};                          // pk -> profil
const pendingProfiles = new Set();
const unread = {};
const lastSeenAt = JSON.parse(localStorage.getItem('cc.seen') || '{}');
const muted = new Set(JSON.parse(localStorage.getItem('cc.muted') || '[]'));
let emojiPick = EMOJIS[0];

function toast(t) { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove('on'), 2800); }

/* ---------- Sphère animée (logo) ---------- */
(function orb() {
  const cv = $('#orb'), ctx = cv.getContext('2d'), N = 500, g = Math.PI * (3 - Math.sqrt(5)), pts = [];
  for (let i = 0; i < N; i++) { const y = 1 - i / (N - 1) * 2, r = Math.sqrt(1 - y * y); pts.push([Math.cos(g * i) * r, y, Math.sin(g * i) * r]); }
  let a = 0;
  (function f(t) {
    if ($('#login').classList.contains('hidden')) return;
    const d = devicePixelRatio || 1, W = cv.clientWidth * d, H = cv.clientHeight * d; if (cv.width !== W) { cv.width = W; cv.height = H; }
    ctx.clearRect(0, 0, W, H); a += .01; const R = W * .38 * (1 + Math.sin(t / 600) * .03), ca = Math.cos(a), sa = Math.sin(a);
    for (const [x0, y0, z0] of pts) { const x = x0 * ca - z0 * sa, z = x0 * sa + z0 * ca, dd = (z + 1.6) / 2.6; ctx.fillStyle = `hsla(${215 + (y0 + 1) * 45},90%,${55 + dd * 20}%,${.15 + dd * .85})`; ctx.beginPath(); ctx.arc(W / 2 + x * R, H / 2 + y0 * R, (.6 + dd * 1.6) * d, 0, 7); ctx.fill(); }
    requestAnimationFrame(f);
  })(0);
})();

/* ---------- Connexion ---------- */
let mode = 'create';
$('#emos').innerHTML = EMOJIS.map(e => `<button type="button" data-e="${e}" class="${e === emojiPick ? 'on' : ''}">${e}</button>`).join('');
$('#emos').onclick = e => { const b = e.target.closest('[data-e]'); if (!b) return; emojiPick = b.dataset.e; document.querySelectorAll('#emos button').forEach(x => x.classList.toggle('on', x === b)); };
function setMode(m) {
  mode = m; $('#tCreate').classList.toggle('on', m === 'create'); $('#tLogin').classList.toggle('on', m === 'login');
  $('#confBox').classList.toggle('hidden', m !== 'create'); $('#emoBox').classList.toggle('hidden', m !== 'create');
  $('#loginBtn').textContent = m === 'create' ? 'Créer mon compte' : 'Me connecter'; $('#lErr').textContent = '';
}
$('#tCreate').onclick = () => setMode('create'); $('#tLogin').onclick = () => setMode('login');
['#lName', '#lPass', '#lPass2'].forEach(s => $(s).addEventListener('keydown', e => { if (e.key === 'Enter') $('#loginBtn').click(); }));

async function deriveKey(name, pass) {
  const salt = enc.encode('clipia-communaute:v1:' + name.trim().toLowerCase());
  let k = await K.scryptAsync(enc.encode(pass), salt, { N: 2 ** 15, r: 8, p: 1, dkLen: 32 });
  for (let i = 0; i < 5; i++) { try { K.getPublicKey(k); return k; } catch { k = K.sha256(k); } }
  return k;
}
$('#loginBtn').onclick = async () => {
  const name = $('#lName').value.trim(), pass = $('#lPass').value, err = $('#lErr');
  err.textContent = '';
  if (!/^[\p{L}\p{N}_.\- ]{3,24}$/u.test(name)) return err.textContent = 'Pseudo : 3 à 24 caractères (lettres, chiffres, _ . -).';
  if (pass.length < 10) return err.textContent = 'Mot de passe : 10 caractères minimum.';
  if (mode === 'create' && pass !== $('#lPass2').value) return err.textContent = 'Les deux mots de passe ne sont pas identiques.';
  const btn = $('#loginBtn'); btn.disabled = true; btn.textContent = 'Sécurisation de votre compte…';
  try {
    const sk = await deriveKey(name, pass);
    startPool();
    const pk = K.getPublicKey(sk);
    btn.textContent = 'Recherche de votre compte…';
    const prof = await fetchProfile(pk, 4500);
    if (mode === 'login' && !prof) { err.textContent = 'Aucun compte trouvé avec ce pseudo et ce mot de passe. Vérifiez-les, ou créez votre compte.'; return; }
    SK = sk; PK = pk;
    if (prof) ME = prof;
    else { ME = { name, emoji: emojiPick, color: COLORS[Math.floor(Math.random() * COLORS.length)] }; await publishProfile(); }
    if (mode === 'create' && prof) toast('Ce compte existe déjà : vous êtes connecté.');
    localStorage.setItem('cc.sk', hex(SK));
    enterApp();
  } catch (e) { err.textContent = 'Erreur : ' + (e.message || e); }
  finally { btn.disabled = false; btn.textContent = mode === 'create' ? 'Créer mon compte' : 'Me connecter'; }
};
$('#logout').onclick = () => { if (!confirm('Se déconnecter de cet appareil ?')) return; localStorage.removeItem('cc.sk'); location.reload(); };

/* ---------- Réseau ---------- */
function startPool() {
  if (pool) return;
  pool = new K.SimplePool({ enablePing: true, enableReconnect: true });
  setInterval(netStatus, 3000);
}
function netStatus() {
  let n = 0; try { pool.listConnectionStatus().forEach(v => { if (v) n++; }); } catch {}
  $('#netDot').classList.toggle('ok', n > 0);
  $('#netTxt').textContent = n ? `Connecté en temps réel (${n} relais)` : 'Connexion au réseau…';
}
function parseProfile(ev) {
  try { const c = JSON.parse(ev.content); return { name: (c.display_name || c.name || 'Anonyme').slice(0, 30), emoji: c.clipia?.emoji || '👤', color: c.clipia?.color || '#4b5563', about: c.about || '', at: ev.created_at }; } catch { return null; }
}
function fetchProfile(pk, ms = 3000) {
  return new Promise(res => {
    let best = null; const sub = pool.subscribe(RELAYS, { kinds: [0], authors: [pk], limit: 2 }, {
      onevent(ev) { const p = parseProfile(ev); if (p && (!best || p.at > best.at)) best = p; },
      oneose() { if (best) { sub.close(); res(best); } }
    });
    setTimeout(() => { try { sub.close(); } catch {} res(best); }, ms);
  });
}
async function publishProfile() {
  const ev = K.finalizeEvent({ kind: 0, created_at: Math.floor(Date.now() / 1000), tags: [['t', 'clipia-communaute']], content: JSON.stringify({ name: ME.name, display_name: ME.name, about: 'Membre de Clipia Communauté', clipia: { emoji: ME.emoji, color: ME.color } }) }, SK);
  profiles[PK] = { ...ME, at: ev.created_at };
  await Promise.any(pool.publish(RELAYS, ev)).catch(() => toast('Profil enregistré localement, publication en attente du réseau'));
}
function wantProfile(pk) {
  if (profiles[pk] || pendingProfiles.has(pk)) return;
  pendingProfiles.add(pk); clearTimeout(wantProfile.t);
  wantProfile.t = setTimeout(() => {
    const list = [...pendingProfiles].filter(p => !profiles[p]); pendingProfiles.clear(); if (!list.length) return;
    const sub = pool.subscribe(RELAYS, { kinds: [0], authors: list }, {
      onevent(ev) { const p = parseProfile(ev); if (p && (!profiles[ev.pubkey] || p.at > profiles[ev.pubkey].at)) { profiles[ev.pubkey] = p; refresh(); } },
      oneose() { setTimeout(() => sub.close(), 500); }
    });
  }, 300);
}
const who = (pk) => profiles[pk] || { name: 'Membre ' + pk.slice(0, 4), emoji: '👤', color: '#374151' };
const tag = (pk) => '#' + pk.slice(-4);

/* ---------- Application ---------- */
function enterApp() {
  profiles[PK] = ME;
  $('#login').classList.add('hidden'); $('#app').classList.remove('hidden');
  $('#meAv').textContent = ME.emoji; $('#meAv').style.background = ME.color;
  $('#meName').textContent = ME.name; $('#meId').textContent = tag(PK) + ' · votre identifiant';
  const since = Math.floor(Date.now() / 1000) - 30 * 86400;
  pool.subscribe(RELAYS, { kinds: [42], '#e': CHANNELS.map(c => c.id), since, limit: 600 }, { onevent: onChan, oneose: () => { loaded.chan = true; refresh(); } });
  pool.subscribe(RELAYS, { kinds: [4], '#p': [PK], since: since - 60 * 86400, limit: 400 }, { onevent: onDm, oneose: () => { loaded.dm = true; refresh(); } });
  pool.subscribe(RELAYS, { kinds: [4], authors: [PK], since: since - 60 * 86400, limit: 400 }, { onevent: onDm });
  open('chan', CHANNELS[0].id);
  netStatus();
}
const loaded = { chan: false, dm: false };
function onChan(ev) {
  if (seen.has(ev.id) || !K.verifyEvent(ev)) return; seen.add(ev.id);
  const root = (ev.tags.find(t => t[0] === 'e') || [])[1]; if (!CHANNELS.some(c => c.id === root)) return;
  (store.chan[root] ||= []).push(ev); wantProfile(ev.pubkey);
  if (!(view.type === 'chan' && view.id === root) && ev.pubkey !== PK && ev.created_at > (lastSeenAt[root] || 0)) unread[root] = (unread[root] || 0) + 1;
  refresh();
}
async function onDm(ev) {
  if (seen.has(ev.id) || !K.verifyEvent(ev)) return; seen.add(ev.id);
  const other = ev.pubkey === PK ? (ev.tags.find(t => t[0] === 'p') || [])[1] : ev.pubkey; if (!other) return;
  let text; try { text = await K.nip04.decrypt(SK, other, ev.content); } catch { return; }
  ev._text = text; (store.dm[other] ||= []).push(ev); wantProfile(other);
  if (!(view.type === 'dm' && view.id === other) && ev.pubkey !== PK && ev.created_at > (lastSeenAt[other] || 0)) { unread[other] = (unread[other] || 0) + 1; notify(who(other).name, text); }
  refresh();
}
function notify(title, body) {
  if (document.hasFocus()) return;
  try { if (Notification.permission === 'granted') new Notification('💬 ' + title, { body: body.slice(0, 120), icon: 'icone.png' }); } catch {}
}

function open(type, id) {
  view = { type, id }; unread[id] = 0; lastSeenAt[id] = Math.floor(Date.now() / 1000); localStorage.setItem('cc.seen', JSON.stringify(lastSeenAt));
  $('#side').classList.remove('open');
  if (type === 'chan') { const c = CHANNELS.find(x => x.id === id); $('#cTitle').textContent = c.ic + ' ' + c.name; $('#cSub').textContent = c.desc; $('#muteBtn').classList.add('hidden'); $('#txt').placeholder = 'Écrire dans ' + c.name + '…'; }
  else { const p = who(id); $('#cTitle').textContent = p.emoji + ' ' + p.name + ' ' + tag(id); $('#cSub').textContent = '🔒 Conversation privée chiffrée'; $('#muteBtn').classList.remove('hidden'); $('#txt').placeholder = 'Message privé à ' + p.name + '…'; }
  refresh(true);
  if (window.Notification && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
}
let refreshT = null;
function refresh(scroll) { clearTimeout(refreshT); refreshT = setTimeout(() => render(scroll), 40); }
function render(forceScroll) {
  // salons
  $('#chans').innerHTML = CHANNELS.map(c => `<button class="item ${view.type === 'chan' && view.id === c.id ? 'on' : ''}" data-chan="${c.id}"><span>${c.ic}</span><span class="nm">${c.name}</span>${unread[c.id] ? `<span class="badge">${unread[c.id]}</span>` : ''}</button>`).join('');
  // conversations privées
  const dms = Object.entries(store.dm).filter(([pk]) => !muted.has(pk)).sort((a, b) => last(b[1]) - last(a[1]));
  $('#dms').innerHTML = dms.length ? dms.map(([pk]) => { const p = who(pk); return `<button class="item ${view.type === 'dm' && view.id === pk ? 'on' : ''}" data-dm="${pk}"><span class="av" style="background:${p.color}">${p.emoji}</span><span class="nm">${esc(p.name)}</span>${unread[pk] ? `<span class="badge">${unread[pk]}</span>` : ''}</button>`; }).join('') : '<p class="note" style="margin:.2rem .5rem">Touchez un membre pour lui écrire en privé.</p>';
  // membres actifs (auteurs récents)
  const recent = new Map();
  Object.values(store.chan).flat().forEach(ev => { if (ev.pubkey !== PK && !muted.has(ev.pubkey)) recent.set(ev.pubkey, Math.max(recent.get(ev.pubkey) || 0, ev.created_at)); });
  $('#members').innerHTML = [...recent.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([pk, t]) => { const p = who(pk); const on = Date.now() / 1000 - t < 900; return `<button class="item" data-dm="${pk}"><span class="av" style="background:${p.color}">${p.emoji}</span><span class="nm">${esc(p.name)} <small style="color:#7d78b3">${tag(pk)}</small></span>${on ? '<span class="dot ok"></span>' : ''}</button>`; }).join('') || '<p class="note" style="margin:.2rem .5rem">Les membres apparaissent ici dès qu\'ils écrivent.</p>';
  // messages
  const box = $('#msgs'); const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
  const list = (view.type === 'chan' ? store.chan[view.id] : store.dm[view.id]) || [];
  const evs = list.filter(e => !muted.has(e.pubkey)).sort((a, b) => a.created_at - b.created_at);
  let html = '', prevDay = '', prev = null;
  for (const ev of evs) {
    const d = new Date(ev.created_at * 1000), day = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    if (day !== prevDay) { html += `<div class="day">${day}</div>`; prevDay = day; prev = null; }
    const p = who(ev.pubkey), cont = prev && prev.pubkey === ev.pubkey && ev.created_at - prev.created_at < 300;
    const text = view.type === 'dm' ? ev._text : ev.content;
    html += `<div class="m ${cont ? 'cont' : ''} ${ev.pubkey === PK ? 'mine' : ''}"><div class="av" style="background:${p.color}" data-dm="${ev.pubkey}">${p.emoji}</div><div class="b"><div class="h"><b data-dm="${ev.pubkey}">${esc(p.name)}</b><small>${tag(ev.pubkey)} · ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</small></div><div class="t">${linkify(esc(text))}</div></div></div>`;
    prev = ev;
  }
  if (!evs.length) html = `<div class="empty">${(view.type === 'chan' ? loaded.chan : loaded.dm) ? (view.type === 'chan' ? 'Aucun message pour le moment.<br>Lancez la discussion ! 👋' : '🔒 Vos messages privés sont chiffrés : seuls vous et votre correspondant pouvez les lire.') : 'Chargement des messages…'}</div>`;
  box.innerHTML = html;
  if (forceScroll || atBottom) box.scrollTop = box.scrollHeight;
}
const last = (arr) => Math.max(0, ...arr.map(e => e.created_at));
const linkify = (s) => s.replace(/https?:\/\/[^\s<]+/g, u => `<a href="${u}" target="_blank" rel="noopener noreferrer" style="color:#93c5fd">${u}</a>`);

document.addEventListener('click', e => {
  const c = e.target.closest('[data-chan]'); if (c) return open('chan', c.dataset.chan);
  const d = e.target.closest('[data-dm]'); if (d && d.dataset.dm !== PK) return open('dm', d.dataset.dm);
});
$('#menuBtn').onclick = () => $('#side').classList.toggle('open');
$('#muteBtn').onclick = () => { if (view.type !== 'dm' || !confirm('Masquer cette personne ? Vous ne verrez plus ses messages sur cet appareil.')) return; muted.add(view.id); localStorage.setItem('cc.muted', JSON.stringify([...muted])); open('chan', CHANNELS[0].id); };
$('#emojiBtn').onclick = () => { const t = $('#txt'); const e = ['😀', '😂', '🔥', '❤️', '👍', '🙏', '🎵', '🚀', '✨', '😎'][Math.floor(Math.random() * 10)]; t.value += e; t.focus(); };
$('#txt').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#composer').requestSubmit(); } });
$('#txt').addEventListener('input', e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(140, e.target.scrollHeight) + 'px'; });
$('#composer').onsubmit = async e => {
  e.preventDefault(); const t = $('#txt'), text = t.value.trim(); if (!text) return;
  t.value = ''; t.style.height = 'auto';
  let ev;
  if (view.type === 'chan') ev = K.finalizeEvent({ kind: 42, created_at: Math.floor(Date.now() / 1000), tags: [['e', view.id, RELAYS[0], 'root'], ['t', 'clipia-communaute']], content: text }, SK);
  else ev = K.finalizeEvent({ kind: 4, created_at: Math.floor(Date.now() / 1000), tags: [['p', view.id]], content: await K.nip04.encrypt(SK, view.id, text) }, SK);
  if (view.type === 'chan') onChan(ev); else { ev._text = text; seen.add(ev.id); (store.dm[view.id] ||= []).push(ev); refresh(true); }
  try { await Promise.any(pool.publish(RELAYS, ev)); } catch { toast('⚠ Message non envoyé : vérifiez votre connexion'); }
};

/* ---------- Session mémorisée ---------- */
(async function resume() {
  const s = localStorage.getItem('cc.sk'); if (!s) return;
  try {
    SK = K.hexToBytes(s); PK = K.getPublicKey(SK); startPool();
    $('#login').classList.add('hidden');
    ME = await fetchProfile(PK, 4000) || { name: 'Moi', emoji: '👤', color: '#4b5563' };
    profiles[PK] = ME; enterApp();
  } catch { localStorage.removeItem('cc.sk'); $('#login').classList.remove('hidden'); }
})();
